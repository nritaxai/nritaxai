import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import ChatHistory from "../Models/chatHistoryModel.js";
import User from "../Models/userModel.js";
import { CHAT_MODEL_KEYS, PLAN_KEYS } from "../../shared/subscriptionConfig.js";
import {
  checkAndConsumeChatUsage,
  getSubscriptionSummary,
  normalizeUserSubscriptionState,
} from "../Utils/subscriptionAccess.js";
import { appendTimelineToAnswer, getTaxRuleTimelinesForQuery } from "../Utils/taxRuleTimelines.js";
import { buildHiddenContextFromMatches } from "../Utils/chatPromptContext.js";
import { generateChatResponse } from "../Config/openaiService.js";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434/api/generate";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const USE_GEMINI_PRIMARY =
  GEMINI_API_KEY && String(process.env.USE_GEMINI_PRIMARY || "false") === "true";
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "gemma:2b";
const OLLAMA_TIMEOUT_MS = Math.max(Number(process.env.OLLAMA_TIMEOUT_MS || 45000), 45000);
const NON_TAX_QUERY_REPLY = "Please ask a tax-related question.";
const SYSTEM_PROMPT = `
You are a professional NRI tax assistant.

Rules:
- Answer ONLY tax-related questions (India, NRI, DTAA, FEMA, income tax)
- If question is not tax-related, respond: "Please ask a tax-related question."
- Always give accurate, legally correct answers
- Keep answers SHORT and CLEAR (3-6 lines max)
- Prefer bullet points where useful
- Always expand abbreviations (e.g., DTAA = Double Taxation Avoidance Agreement)
- Do NOT hallucinate or guess
- If unsure, say: "This requires professional review."

Focus Areas:
- DTAA (Double Taxation Avoidance Agreements)
- NRI taxation
- Residential status
- Foreign income taxation
- Capital gains, salary, TDS
- India ↔ other country tax rules
`.trim();
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.3);
const OLLAMA_TOP_P = Number(process.env.OLLAMA_TOP_P || 0.9);
const OLLAMA_TOP_K = Number(process.env.OLLAMA_TOP_K || 40);
const OLLAMA_REPEAT_PENALTY = Number(process.env.OLLAMA_REPEAT_PENALTY || 1.2);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 220);
const OLLAMA_PROMPT_MAX_CHARS = Number(process.env.OLLAMA_PROMPT_MAX_CHARS || 6000);

const MAX_CONTEXT_MESSAGES = Math.max(Number(process.env.CHAT_CONTEXT_MESSAGES || 8), 6);
const MAX_STORED_MESSAGES = 100;
const chatSessionMemory = new Map();
const chatSessionStore = new Map();
const RAG_TOP_K = Number(process.env.RAG_TOP_K || 4);
const RAG_LEXICAL_CANDIDATES = Number(process.env.RAG_LEXICAL_CANDIDATES || 12);
const RAG_LEXICAL_MIN_SCORE = 1.05;
const RAG_EMBEDDING_MIN_SIMILARITY = 0.12;
const RAG_EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || "openai/text-embedding-3-small";
const RAG_MAX_PER_PAGE = Number(process.env.RAG_MAX_PER_PAGE || 2);
const RAG_ENABLE_EMBEDDING_RERANK = String(process.env.RAG_ENABLE_EMBEDDING_RERANK || "false").toLowerCase() === "true";
const CHAT_MAX_TOKENS = Math.max(Number(process.env.CHAT_MAX_TOKENS || 1000), 700);
let dtaaChunksCache = null;
let dtaaTokenIndexCache = null;
let dtaaIndexMtimeCache = null;
const TOKEN_REGEX = /[^a-z0-9\s]/g;
const RAG_INDEX_MAX_CANDIDATES = Number(process.env.RAG_INDEX_MAX_CANDIDATES || 140);
const RESPONSE_CACHE_TTL_MS = Number(process.env.RESPONSE_CACHE_TTL_MS || 120000);
const RESPONSE_CACHE_MAX_ITEMS = Number(process.env.RESPONSE_CACHE_MAX_ITEMS || 500);
const CHAT_DISABLE_PDF_DIR_FALLBACK = String(process.env.CHAT_DISABLE_PDF_DIR_FALLBACK || "true").toLowerCase() === "true";
const responseCache = new Map();
const GUEST_SESSION_HEADER = "x-guest-session-id";
const DEFAULT_CHAT_MODEL = OLLAMA_CHAT_MODEL;
const TAX_TOPIC_KEYWORDS = [
  "nri",
  "non resident",
  "non-resident",
  "resident but not ordinarily resident",
  "rnor",
  "tax",
  "taxation",
  "income tax",
  "itr",
  "tds",
  "withholding",
  "dtaa",
  "double tax",
  "double taxation",
  "tax treaty",
  "foreign tax credit",
  "ftc",
  "trc",
  "form 10f",
  "pan",
  "ais",
  "26as",
  "capital gain",
  "capital gains",
  "rental income",
  "property sale",
  "salary",
  "dividend",
  "interest income",
  "royalty",
  "fees for technical services",
  "remittance",
  "repatriation",
  "nre",
  "nro",
  "nre account",
  "nro account",
  "fcnr",
  "resident foreign currency",
  "fema",
  "section 195",
  "section 194",
  "advance tax",
  "self assessment tax",
  "refund",
  "india tax",
];
const BASIC_RAG_CONTEXT = {
  dtaa: [
    "DTAA helps prevent the same income from being taxed twice in India and the country of tax residence.",
    "DTAA relief often depends on the relevant treaty article, Tax Residency Certificate (TRC), Form 10F, and beneficial ownership conditions.",
    "Common DTAA topics for NRIs include interest, dividends, royalties, fees for technical services, capital gains, and foreign tax credit.",
  ],
  nriTaxation: [
    "NRI taxability in India depends on residential status, source of income, and whether income accrues or arises in India.",
    "Typical NRI taxable items in India include salary for services rendered in India, rental income from Indian property, capital gains on Indian assets, and some interest income.",
    "Return filing may still be required even when TDS is deducted, especially when claiming refunds, treaty relief, losses, or exemptions.",
    "NRE and NRO accounts are valid NRI tax-related topics because taxability, TDS, interest exemptions, and repatriation rules differ between them.",
    "Interest on NRE accounts is generally exempt in India for eligible NRIs, while NRO account interest is generally taxable in India and may be subject to TDS.",
  ],
  tds: [
    "TDS is tax deducted at source and may apply to salary, rent, interest, property sale proceeds, professional fees, and many cross-border payments.",
    "For NRIs, TDS rates can be higher than final tax liability, so return filing may be needed to claim a refund or apply treaty relief.",
    "For lower withholding or treaty benefit, supporting documents may include PAN, TRC, Form 10F, and payer-side documentation.",
  ],
};

const STORAGE_DIR = path.resolve("storage");
const PDF_DIR = path.join(STORAGE_DIR, "pdfs");
const INDEX_PATH = path.join(STORAGE_DIR, "pdf_index.json");
const ROOT_DIR = path.resolve(".");

const CHAT_MODEL_BY_TIER = {
  [CHAT_MODEL_KEYS.BASIC]: OLLAMA_CHAT_MODEL,
  [CHAT_MODEL_KEYS.STANDARD]: OLLAMA_CHAT_MODEL,
  [CHAT_MODEL_KEYS.PREMIUM]: OLLAMA_CHAT_MODEL,
};

const tokenize = (text = "") =>
  text
    .toLowerCase()
    .replace(TOKEN_REGEX, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

const preprocessChunk = (chunk, index) => {
  const normalizedText = String(chunk.text || "").toLowerCase();
  const tokens = tokenize(chunk.text);
  return {
    ...chunk,
    _id: index,
    _normalizedText: normalizedText,
    _tokens: tokens,
    _tokenSet: new Set(tokens),
  };
};

const buildTokenIndex = (chunks = []) => {
  const index = new Map();
  chunks.forEach((chunk, chunkIndex) => {
    const seenInChunk = new Set();
    chunk._tokens.forEach((token) => {
      if (seenInChunk.has(token)) return;
      seenInChunk.add(token);
      const bucket = index.get(token);
      if (!bucket) {
        index.set(token, [chunkIndex]);
      } else {
        bucket.push(chunkIndex);
      }
    });
  });
  return index;
};

const QUERY_EXPANSIONS = {
  dtaa: ["double taxation avoidance agreement", "tax treaty", "treaty relief", "article"],
  trc: ["tax residency certificate", "residency certificate"],
  form10f: ["form 10f", "10f"],
  royalty: ["royalties", "withholding tax"],
  dividend: ["dividends", "withholding tax"],
  interest: ["interest income", "withholding tax"],
  pe: ["permanent establishment"],
  fts: ["fees for technical services", "technical services"],
  resident: ["tax resident", "residency status"],
  nre: ["non resident external"],
  nro: ["non resident ordinary"],
  fcnr: ["foreign currency non resident", "fcnr account"],
};

const compact = (text = "") => text.toLowerCase().replace(/[^a-z0-9]/g, "");
const sanitizeGuestSessionId = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 80);

const getSessionActorId = (req) => {
  const userId = req.user?._id?.toString?.();
  if (userId) return userId;

  const guestSessionId = sanitizeGuestSessionId(req.headers?.[GUEST_SESSION_HEADER]);
  if (guestSessionId) return `guest:${guestSessionId}`;

  return "guest:anonymous";
};

const sanitizeAiReply = (text = "") =>
  String(text)
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/###\s*Note[\s\S]*?uploaded\s*pdfs?[\s\S]*?(?=\n###\s|\s*$)/im, "")
    .replace(/^\s*Note:\s*.*uploaded\s*pdfs?.*$/gim, "")
    .replace(/^\s*.*uploaded\s*pdfs?.*$/gim, "")
    .replace(/^\s*###\s*Note\s*$/gim, "")
    .replace(/^\s*Note\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const buildSectionDefaults = (language = "english") => {
  const key = String(language || "english").toLowerCase();
  if (key === "hindi") {
    return {
      answer: "Kripya apna specific scenario share karein, main madad karta hoon.",
      keyTaxPoints: "- Tax treatment income type par depend karta hai.\n- DTAA se double taxation kam ho sakta hai.",
      nextSteps: "1. Apna resident country aur income type batayein.\n2. DTAA article, TRC aur Form 10F verify karein.",
      followUpQuestions: "- Aap kis country pair ke liye puch rahe hain?\n- Income kaunsa hai: salary, interest, rental, ya capital gains?",
    };
  }
  if (key === "tamil") {
    return {
      answer: "Ungal specific scenario-ai share pannunga, naan clear guidance kudukiren.",
      keyTaxPoints: "- Tax treatment income type-ai poruththu maarum.\n- DTAA moolam double taxation kuraiya vendum.",
      nextSteps: "1. Ungal resident country matrum income type-ai sollunga.\n2. DTAA article, TRC, Form 10F documents-ai verify pannunga.",
      followUpQuestions: "- Neenga entha country pair pathi ketkireenga?\n- Income type salary, interest, rental, illa capital gains-a?",
    };
  }
  if (key === "indonesian") {
    return {
      answer: "Silakan bagikan skenario Anda agar saya dapat memberi panduan yang tepat.",
      keyTaxPoints: "- Perlakuan pajak tergantung jenis penghasilan.\n- DTAA dapat membantu mengurangi pajak berganda.",
      nextSteps: "1. Sebutkan negara domisili dan jenis penghasilan Anda.\n2. Verifikasi pasal DTAA, TRC, dan Form 10F.",
      followUpQuestions: "- Pasangan negara mana yang Anda gunakan?\n- Jenis penghasilannya apa: gaji, bunga, sewa, atau capital gain?",
    };
  }
  return {
    answer:
      "I can help with that. The right tax treatment depends on your residential status, the type of income or transaction involved, and whether DTAA relief or FEMA/RBI rules apply.",
    keyTaxPoints:
      "- Tax treatment depends on the exact income type, holding period, and your country of tax residence.\n- DTAA relief, withholding tax rules, and compliance documents can materially change the final tax outcome.",
    nextSteps:
      "1. Confirm your resident country, transaction type, and whether tax was already withheld in India.\n2. Check the relevant documents, tax forms, and remittance or DTAA conditions before proceeding.",
    followUpQuestions:
      "- Which country are you currently tax resident in?\n- Is this about salary, interest, rental income, capital gains, or property sale proceeds?",
  };
};

const upsertSection = (markdown = "", title = "", fallbackBody = "") => {
  const sectionPattern = new RegExp(`(###\\s*${title}\\s*\\n)([\\s\\S]*?)(?=\\n###\\s*|$)`, "i");
  const match = markdown.match(sectionPattern);
  if (!match) {
    return `${markdown.trim()}\n\n### ${title}\n${fallbackBody}`.trim();
  }
  const currentBody = String(match[2] || "").trim();
  if (currentBody) return markdown;
  return markdown.replace(sectionPattern, `$1${fallbackBody}\n`);
};

const getSectionBody = (markdown = "", title = "") => {
  const sectionPattern = new RegExp(`###\\s*${title}\\s*\\n([\\s\\S]*?)(?=\\n###\\s*|$)`, "i");
  const match = String(markdown || "").match(sectionPattern);
  return String(match?.[1] || "").trim();
};

const stripEmbeddedHeadings = (body = "") =>
  String(body || "")
    .replace(/\n?###\s*(Answer|Key Tax Points|Next Steps|Follow-up Questions)\b[\s\S]*$/i, "")
    .trim();

const replaceSectionBody = (markdown = "", title = "", body = "") => {
  const sectionPattern = new RegExp(`(###\\s*${title}\\s*\\n)([\\s\\S]*?)(?=\\n###\\s*|$)`, "i");
  if (!sectionPattern.test(markdown)) {
    return `${String(markdown || "").trim()}\n\n### ${title}\n${String(body || "").trim()}`.trim();
  }
  return String(markdown || "").replace(sectionPattern, `$1${String(body || "").trim()}\n`);
};

const normalizeLines = (body = "", prefixPattern = /^[-*]\s+|^\d+[.)]\s+/) =>
  stripEmbeddedHeadings(body)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && prefixPattern.test(line));

const looksTruncated = (line = "") => {
  const text = String(line || "").trim();
  if (!text) return true;
  if (/[,:;/-]$/.test(text)) return true;
  return /\b(and|or|under|for|with|to|of|in|on|at|by|from|if|when|unless|without|including)\s*$/i.test(text);
};

const normalizeAnswerSection = (body = "", fallback = "") => {
  const cleaned = stripEmbeddedHeadings(body);
  if (!cleaned || looksTruncated(cleaned)) return fallback;
  return cleaned;
};

const normalizeBulletSection = (body = "", fallback = "") => {
  const fallbackLines = normalizeLines(fallback, /^[-*]\s+/);
  const lines = normalizeLines(body, /^[-*]\s+/)
    .filter((line) => !looksTruncated(line))
    .slice(0, 2);
  while (lines.length < 2 && fallbackLines[lines.length]) {
    lines.push(fallbackLines[lines.length]);
  }
  return lines.join("\n").trim() || fallback;
};

const normalizeNumberedSection = (body = "", fallback = "") => {
  const fallbackLines = normalizeLines(fallback, /^\d+[.)]\s+/);
  const lines = normalizeLines(body, /^\d+[.)]\s+/)
    .filter((line) => !looksTruncated(line))
    .slice(0, 2)
    .map((line, index) => `${index + 1}. ${line.replace(/^\d+[.)]\s+/, "")}`);
  while (lines.length < 2 && fallbackLines[lines.length]) {
    lines.push(`${lines.length + 1}. ${fallbackLines[lines.length].replace(/^\d+[.)]\s+/, "")}`);
  }
  return lines.join("\n").trim() || fallback;
};

const repairStructuredSections = (markdown = "", language = "english") => {
  const defaults = buildSectionDefaults(language);
  let out = String(markdown || "").trim();
  out = replaceSectionBody(out, "Answer", normalizeAnswerSection(getSectionBody(out, "Answer"), defaults.answer));
  out = replaceSectionBody(
    out,
    "Key Tax Points",
    normalizeBulletSection(getSectionBody(out, "Key Tax Points"), defaults.keyTaxPoints)
  );
  out = replaceSectionBody(
    out,
    "Next Steps",
    normalizeNumberedSection(getSectionBody(out, "Next Steps"), defaults.nextSteps)
  );
  out = replaceSectionBody(
    out,
    "Follow-up Questions",
    normalizeBulletSection(getSectionBody(out, "Follow-up Questions"), defaults.followUpQuestions)
  );
  return out.replace(/\n{3,}/g, "\n\n").trim();
};

const ensureStructuredSections = (text = "", language = "english") => {
  const defaults = buildSectionDefaults(language);
  let out = String(text || "").trim();
  const hasKnownHeadings = /###\s*(Answer|Key Tax Points|Next Steps|Follow-up Questions)\b/i.test(out);
  if (!out) {
    out = `### Answer\n${defaults.answer}`;
  } else if (!hasKnownHeadings) {
    out = `### Answer\n${out}`;
  }
  out = upsertSection(out, "Answer", defaults.answer);
  out = upsertSection(out, "Key Tax Points", defaults.keyTaxPoints);
  out = upsertSection(out, "Next Steps", defaults.nextSteps);
  out = upsertSection(out, "Follow-up Questions", defaults.followUpQuestions);
  return repairStructuredSections(out, language);
};

const buildContextFingerprint = (messages = []) =>
  normalizeStoredMessages(messages)
    .slice(-6)
    .map((msg) => `${msg.role}:${String(msg.content || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 180)}`)
    .join("|");

const getResponseCacheKey = ({
  userId = "",
  language = "",
  knowledgeSource = "",
  message = "",
  contextFingerprint = "",
}) =>
  `${String(userId)}|${String(language)}|${String(knowledgeSource)}|${String(contextFingerprint)}|${String(message)
    .trim()
    .toLowerCase()}`;

const getCachedResponse = (cacheKey) => {
  const row = responseCache.get(cacheKey);
  if (!row) return null;
  if (Date.now() - row.createdAt > RESPONSE_CACHE_TTL_MS) {
    responseCache.delete(cacheKey);
    return null;
  }
  return row.reply;
};

const setCachedResponse = (cacheKey, reply, language = "english") => {
  const cleanedReply = ensureStructuredSections(sanitizeAiReply(reply), language);
  if (!cacheKey || !String(cleanedReply || "").trim()) return;
  responseCache.set(cacheKey, { reply: cleanedReply, createdAt: Date.now() });
  if (responseCache.size <= RESPONSE_CACHE_MAX_ITEMS) return;
  const oldestKey = responseCache.keys().next().value;
  if (oldestKey) responseCache.delete(oldestKey);
};

const ensureStorage = () => {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
};

const buildQueryVariants = (question = "") => {
  const base = question.trim();
  if (!base) return [];

  const variants = new Set([base]);
  const tokens = tokenize(base);
  const extras = new Set();

  tokens.forEach((token) => {
    const key = compact(token);
    const mapped = QUERY_EXPANSIONS[key];
    if (Array.isArray(mapped)) {
      mapped.forEach((phrase) => extras.add(phrase));
    }
  });

  if (extras.size > 0) {
    variants.add(`${base} ${Array.from(extras).join(" ")}`);
  }

  const articleMatch = base.match(/\barticle\s+(\d+[a-z]?)\b/i);
  if (articleMatch) {
    variants.add(`article ${articleMatch[1]} tax treaty`);
  }

  return Array.from(variants).slice(0, 3);
};

const chunkText = (text, size = 900, overlap = 150) => {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    start += Math.max(1, size - overlap);
  }
  return chunks;
};

const extractPageTexts = async (buffer) => {
  const pageTexts = [];
  let pageCounter = 0;

  await pdfParse(buffer, {
    pagerender: async (pageData) => {
      pageCounter += 1;
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
      if (text) pageTexts.push({ page: pageCounter, text });
      return text;
    },
  });

  return pageTexts;
};

const indexPdfBuffer = async (buffer, fileName) => {
  const pageTexts = await extractPageTexts(buffer);
  const rows = [];

  pageTexts.forEach(({ page, text }) => {
    const chunks = chunkText(text);
    chunks.forEach((chunk) => {
      rows.push({
        file: fileName,
        page,
        text: chunk,
      });
    });
  });

  return rows;
};

const getIndexedCandidateIndices = (queryTokens = [], tokenIndex = null, maxCandidates = RAG_INDEX_MAX_CANDIDATES) => {
  if (!tokenIndex || !queryTokens.length) return [];
  const hitCounts = new Map();

  queryTokens.forEach((token) => {
    const chunkIndices = tokenIndex.get(token);
    if (!chunkIndices) return;
    chunkIndices.forEach((chunkIndex) => {
      hitCounts.set(chunkIndex, (hitCounts.get(chunkIndex) || 0) + 1);
    });
  });

  return Array.from(hitCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCandidates)
    .map(([chunkIndex]) => chunkIndex);
};

const searchChunks = (question, chunks, limit = RAG_TOP_K, candidateIndices = null) => {
  const qTokens = tokenize(question);
  if (!qTokens.length) return [];

  const qSet = new Set(qTokens);
  const normalizedQuestion = question.toLowerCase();
  const scanPool = Array.isArray(candidateIndices) && candidateIndices.length
    ? candidateIndices.map((idx) => chunks[idx]).filter(Boolean)
    : chunks;

  const scored = scanPool
    .map((chunk) => {
      let overlap = 0;
      qSet.forEach((token) => {
        if (chunk._tokenSet.has(token)) overlap += 1;
      });

      let score = overlap;
      if (chunk._normalizedText.includes(normalizedQuestion)) score += 2;
      if (overlap >= 2) score += 0.6;
      if (/\barticle\s+\d+/i.test(normalizedQuestion) && /\barticle\s+\d+/i.test(chunk.text)) score += 1.2;
      if (chunk._tokens.length > 0) score += overlap / Math.sqrt(chunk._tokens.length);

      return { ...chunk, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
};

const uniqueByText = (rows = []) => {
  const out = [];
  const seen = new Set();
  rows.forEach((row) => {
    const key = `${row.file}|${row.page}|${row.text.slice(0, 180)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  });
  return out;
};

const diversifyByPage = (rows = [], limit = RAG_TOP_K) => {
  const counts = new Map();
  const selected = [];

  for (const row of rows) {
    const key = `${row.file}|${row.page}`;
    const count = counts.get(key) || 0;
    if (count >= RAG_MAX_PER_PAGE) continue;
    selected.push(row);
    counts.set(key, count + 1);
    if (selected.length >= limit) break;
  }
  return selected;
};

const cosineSimilarity = (a = [], b = []) => {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return -1;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denom) return -1;
  return dot / denom;
};

const rerankWithEmbeddings = async (question, lexicalCandidates) => {
  if (!lexicalCandidates.length) return [];

  try {
    const inputs = [question, ...lexicalCandidates.map((chunk) => chunk.text)];
    const emb = await client.embeddings.create({
      model: RAG_EMBEDDING_MODEL,
      input: inputs,
    });

    const vectors = Array.isArray(emb?.data) ? emb.data.map((row) => row.embedding) : [];
    if (vectors.length !== inputs.length) return [];

    const queryVector = vectors[0];
    const ranked = lexicalCandidates
      .map((chunk, idx) => ({
        ...chunk,
        semanticScore: cosineSimilarity(queryVector, vectors[idx + 1]),
      }))
      .filter((chunk) => Number.isFinite(chunk.semanticScore))
      .sort((a, b) => b.semanticScore - a.semanticScore);

    return ranked;
  } catch (error) {
    console.error("RAG embedding rerank failed, using lexical retrieval:", error?.message || error);
    return [];
  }
};

const getRagMatches = async (question, chunks) => {
  const queryVariants = buildQueryVariants(question);
  const variantTokenUnion = Array.from(
    new Set(queryVariants.flatMap((query) => tokenize(query)))
  );
  const candidateIndices = getIndexedCandidateIndices(variantTokenUnion, dtaaTokenIndexCache);
  const perVariantLimit = Math.max(4, Math.ceil(RAG_LEXICAL_CANDIDATES / Math.max(1, queryVariants.length)));
  const lexicalCandidates = uniqueByText(
    queryVariants.flatMap((query) => searchChunks(query, chunks, perVariantLimit, candidateIndices))
  )
    .sort((a, b) => b.score - a.score)
    .slice(0, RAG_LEXICAL_CANDIDATES);

  if (!lexicalCandidates.length) return [];

  if (!RAG_ENABLE_EMBEDDING_RERANK) {
    return diversifyByPage(
      lexicalCandidates
        .filter((chunk) => chunk.score >= RAG_LEXICAL_MIN_SCORE)
        .sort((a, b) => b.score - a.score),
      RAG_TOP_K
    );
  }

  const semanticRanked = await rerankWithEmbeddings(question, lexicalCandidates);

  if (semanticRanked.length) {
    return diversifyByPage(
      semanticRanked
      .filter((chunk) => chunk.semanticScore >= RAG_EMBEDDING_MIN_SIMILARITY)
      .sort((a, b) => {
        const aCombined = (a.semanticScore || 0) + 0.12 * (a.score || 0);
        const bCombined = (b.semanticScore || 0) + 0.12 * (b.score || 0);
        return bCombined - aCombined;
      }),
      RAG_TOP_K
    );
  }

  return diversifyByPage(
    lexicalCandidates
    .filter((chunk) => chunk.score >= RAG_LEXICAL_MIN_SCORE)
    .sort((a, b) => b.score - a.score),
    RAG_TOP_K
  );
};

const loadIndexChunks = () => {
  try {
    if (!fs.existsSync(INDEX_PATH)) return [];
    const raw = fs.readFileSync(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) =>
        row &&
        typeof row.file === "string" &&
        Number.isFinite(row.page) &&
        typeof row.text === "string" &&
        row.text.trim()
    );
  } catch {
    return [];
  }
};

const saveIndexChunks = (rows = []) => {
  ensureStorage();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(rows, null, 2), "utf8");
};

const getBootstrapPdfFiles = () => {
  const directories = [ROOT_DIR, PDF_DIR];
  const found = new Map();

  directories.forEach((dirPath) => {
    if (!fs.existsSync(dirPath)) return;
    const files = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"));

    files.forEach((entry) => {
      const absolutePath = path.join(dirPath, entry.name);
      if (!found.has(absolutePath)) {
        found.set(absolutePath, entry.name);
      }
    });
  });

  return Array.from(found.entries()).map(([absolutePath, fileName]) => ({
    absolutePath,
    fileName,
  }));
};

const bootstrapIndexFromLocalPdfs = async () => {
  const pdfFiles = getBootstrapPdfFiles();
  if (!pdfFiles.length) return [];

  const allRows = [];
  for (const pdfFile of pdfFiles) {
    try {
      const buffer = fs.readFileSync(pdfFile.absolutePath);
      const rows = await indexPdfBuffer(buffer, pdfFile.fileName);
      allRows.push(...rows);
    } catch (error) {
      console.error(`Failed to index local PDF ${pdfFile.fileName}:`, error?.message || error);
    }
  }

  if (allRows.length) {
    saveIndexChunks(allRows);
  }

  return allRows;
};

const loadDtaaChunks = async () => {
  ensureStorage();
  const hasIndexFile = fs.existsSync(INDEX_PATH);
  const indexMtime = hasIndexFile ? fs.statSync(INDEX_PATH).mtimeMs : null;

  if (Array.isArray(dtaaChunksCache) && dtaaIndexMtimeCache === indexMtime) {
    if (!dtaaTokenIndexCache) dtaaTokenIndexCache = buildTokenIndex(dtaaChunksCache);
    return dtaaChunksCache;
  }

  if (hasIndexFile) {
    const indexed = loadIndexChunks();
    if (indexed.length > 0) {
      dtaaChunksCache = indexed
        .map((row) => ({
          file: row.file,
          page: row.page,
          text: row.text,
        }))
        .map((row, idx) => preprocessChunk(row, idx));
      dtaaTokenIndexCache = buildTokenIndex(dtaaChunksCache);
      dtaaIndexMtimeCache = indexMtime;
      return dtaaChunksCache;
    }
  }

  const bootstrapped = await bootstrapIndexFromLocalPdfs();
  if (bootstrapped.length > 0) {
    dtaaChunksCache = bootstrapped.map((row, idx) => preprocessChunk(row, idx));
    dtaaTokenIndexCache = buildTokenIndex(dtaaChunksCache);
    dtaaIndexMtimeCache = fs.existsSync(INDEX_PATH) ? fs.statSync(INDEX_PATH).mtimeMs : indexMtime;
    return dtaaChunksCache;
  }

  // Avoid expensive cold-start scans/parsing from arbitrary folders on chat requests.
  if (CHAT_DISABLE_PDF_DIR_FALLBACK) {
    dtaaChunksCache = [];
    dtaaTokenIndexCache = buildTokenIndex(dtaaChunksCache);
    dtaaIndexMtimeCache = indexMtime;
    return dtaaChunksCache;
  }

  return [];
};

const dtaaNoAnswerByLanguage = {
  english: "I can share general NRI tax guidance while specific treaty text is unavailable.",
  tamil: "இதற்கு நம்பிக்கையுடன் பதில் அளிக்க போதுமான தகவல் இல்லை.",
  hindi: "इसका भरोसेमंद उत्तर देने के लिए पर्याप्त जानकारी नहीं है।",
  indonesian: "Saya tidak memiliki informasi yang cukup untuk menjawab itu dengan yakin.",
};


const ragFallbackDisclaimerByLanguage = {
  english:
    "Note: I could not find directly relevant content in the uploaded PDFs, so the response below is general NRI tax guidance.",
  tamil:
    "Kurippu: Upload seydha PDF-galil direct-a relevant content kidaikkavillai; keezhe ulladhu general NRI tax guidance.",
  hindi:
    "Note: Upload ki gayi PDFs me seedha relevant content nahi mila, isliye neeche diya gaya jawab general NRI tax guidance hai.",
  indonesian:
    "Catatan: Saya tidak menemukan konten yang langsung relevan di PDF yang diunggah, jadi jawaban di bawah adalah panduan pajak NRI umum.",
};

const buildRagSourcesSection = (matches = []) => {
  if (!Array.isArray(matches) || !matches.length) return "";
  const unique = [];
  const seen = new Set();

  matches.forEach((match) => {
    const file = String(match?.file || "").trim();
    const page = Number(match?.page || 0);
    if (!file || page <= 0) return;
    const key = `${file}|${page}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push({ file, page });
  });

  if (!unique.length) return "";
  return `\n\n### Sources\n${unique.map((src) => `- ${src.file} (p.${src.page})`).join("\n")}`;
};

const appendSourcesIfMissing = (reply = "", matches = []) => {
  const safeReply = String(reply || "").trim();
  if (!safeReply) return buildRagSourcesSection(matches).trim();
  if (/^###\s*sources\b/im.test(safeReply)) return safeReply;
  return `${safeReply}${buildRagSourcesSection(matches)}`;
};


const getInstantRepeatReply = (messages = [], question = "") => {
  const normalizedQuestion = String(question || "").trim().toLowerCase();
  if (!normalizedQuestion || !Array.isArray(messages) || !messages.length) return "";

  for (let i = messages.length - 2; i >= 0; i -= 1) {
    const current = messages[i];
    const next = messages[i + 1];
    if (!current || !next) continue;
    if (current.role !== "user" || next.role !== "ai") continue;

    if (String(current.content || "").trim().toLowerCase() === normalizedQuestion) {
      return String(next.content || "").trim();
    }
  }

  return "";
};

const isGreetingMessage = (text) => {
  const normalized = text.toLowerCase().trim();
  return /^(hi+|hello+|hey+|hii+|hlo+|namaste+|salam+|vanakkam+)\b[!. ]*$/.test(normalized);
};

const toAssistantRole = (role) => (role === "user" ? "user" : "assistant");
const toClientRole = (role) => (role === "user" ? "user" : "ai");

const normalizeStoredMessages = (messages = []) =>
  messages
    .filter(
      (msg) =>
        msg &&
        typeof msg.role === "string" &&
        typeof msg.content === "string" &&
        msg.content.trim().length > 0
    )
    .map((msg) => ({
      role: toClientRole(msg.role),
      content: sanitizeAiReply(msg.content.trim()),
      taxRuleTimelines: Array.isArray(msg.taxRuleTimelines) ? msg.taxRuleTimelines : [],
    }));

const loadPersistedMessages = async (userId, language, knowledgeSource) => {
  if (!userId || userId.startsWith("guest:")) return [];
  const history = await ChatHistory.findOne({
    user: userId,
    language,
    knowledgeSource,
  })
    .lean()
    .exec();

  return normalizeStoredMessages(history?.messages || []);
};

const savePersistedMessages = async (userId, language, knowledgeSource, messages) => {
  if (!userId || userId.startsWith("guest:")) return;

  const normalized = normalizeStoredMessages(messages).slice(-MAX_STORED_MESSAGES);
  await ChatHistory.findOneAndUpdate(
    { user: userId, language, knowledgeSource },
    {
      $set: {
        messages: normalized,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const getMemoryMessages = (sessionKey) => {
  const rows = Array.isArray(chatSessionMemory.get(sessionKey)) ? chatSessionMemory.get(sessionKey) : [];
  return normalizeStoredMessages(rows);
};

const getCachedSessionMessages = (sessionKey) => {
  const rows = Array.isArray(chatSessionStore.get(sessionKey)) ? chatSessionStore.get(sessionKey) : [];
  return normalizeStoredMessages(rows);
};

const mergeSessionMessages = (persistedMessages = [], memoryMessages = []) => {
  const merged = normalizeStoredMessages([...persistedMessages, ...memoryMessages]).slice(-MAX_STORED_MESSAGES);
  const deduped = [];
  for (const msg of merged) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.role === msg.role && prev.content === msg.content) continue;
    deduped.push(msg);
  }
  return deduped.slice(-MAX_STORED_MESSAGES);
};

const toAssistantMessages = (messages = []) =>
  messages.map((msg) => ({ role: toAssistantRole(msg.role), content: msg.content }));

const buildContextualMessages = (sessionMessages = [], message = "") =>
  [...toAssistantMessages(sessionMessages), { role: "user", content: message }].slice(-MAX_CONTEXT_MESSAGES);

const formatMessagesForPrompt = (messages = []) =>
  messages
    .map((msg) => {
      const role = msg?.role === "assistant" ? "Assistant" : "User";
      const content = String(msg?.content || "").trim();
      return content ? `${role}: ${content}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

const containsTaxSignals = (text = "") => {
  const normalized = String(text || "").toLowerCase();
  if (!normalized.trim()) return false;
  return TAX_TOPIC_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const isFollowUpToTaxContext = (sessionMessages = []) =>
  normalizeStoredMessages(sessionMessages)
    .slice(-6)
    .some((message) => containsTaxSignals(message.content));

const isTaxRelatedQuery = (message = "", sessionMessages = []) =>
  containsTaxSignals(message) || isFollowUpToTaxContext(sessionMessages);

const buildBasicRagContext = (message = "") => {
  const normalized = String(message || "").toLowerCase();
  const sections = [];

  if (/\b(dtaa|double tax|double taxation|treaty|foreign tax credit|ftc|trc|form 10f)\b/i.test(normalized)) {
    sections.push(`DTAA Context:\n- ${BASIC_RAG_CONTEXT.dtaa.join("\n- ")}`);
  }
  if (/\b(nri|non resident|non-resident|rnor|residential status|india tax|return filing|capital gain|capital gains|rental income|nre|nro|fema|repatriation)\b/i.test(normalized)) {
    sections.push(`NRI Taxation Context:\n- ${BASIC_RAG_CONTEXT.nriTaxation.join("\n- ")}`);
  }
  if (/\b(tds|withholding|section 195|section 194|26as|ais|lower deduction|refund)\b/i.test(normalized)) {
    sections.push(`TDS Context:\n- ${BASIC_RAG_CONTEXT.tds.join("\n- ")}`);
  }

  if (!sections.length && containsTaxSignals(normalized)) {
    sections.push(
      `NRI Taxation Context:\n- ${BASIC_RAG_CONTEXT.nriTaxation.join("\n- ")}`,
      `TDS Context:\n- ${BASIC_RAG_CONTEXT.tds.join("\n- ")}`
    );
  }

  return sections.join("\n\n").trim();
};

const buildGemmaPrompt = ({ selectedLanguage, contextualMessages, hiddenContext = "" }) => {
  const safeHiddenContext = String(hiddenContext || "").trim();
  const conversation = formatMessagesForPrompt(contextualMessages);

  return [
    SYSTEM_PROMPT,
    "==================================================",
    "=== RETRIEVED CONTEXT (HIGHEST PRIORITY) ===",
    safeHiddenContext || "[no retrieved context available]",
    "CRITICAL INSTRUCTIONS:",
    "- You MUST use the above context to answer.",
    "- DO NOT create your own definitions.",
    "- DO NOT guess or hallucinate.",
    '- If context contains the answer, use it EXACTLY.',
    '- If context does NOT contain the answer, say: "Please consult a tax professional for accurate guidance."',
    "==================================================",
    "=== DOMAIN RESTRICTION ===",
    "You are ONLY allowed to answer:",
    "- NRI (Non-Resident Indian)",
    "- Indian Income Tax",
    "- DTAA (Double Tax Avoidance Agreement)",
    "- TDS (Tax Deducted at Source)",
    "- FEMA / RBI rules",
    "- Foreign income",
    "- Repatriation",
    "- Capital gains",
    "- ITR / tax compliance",
    `If a query is outside NRI or tax scope, respond EXACTLY: ${NON_TAX_QUERY_REPLY}`,
    "==================================================",
    "=== VERIFIED DEFINITIONS (USE THESE FIRST) ===",
    "NRI:",
    "NRI stands for Non-Resident Indian.",
    "It refers to a person residing outside India as per Section 6 of the Income Tax Act.",
    "NRIs are taxed only on income earned or received in India.",
    "DTAA:",
    "DTAA stands for Double Tax Avoidance Agreement.",
    "It prevents double taxation of the same income in two countries.",
    "TDS:",
    "TDS stands for Tax Deducted at Source.",
    "Section 195 applies to payments made to NRIs.",
    selectedLanguage.instruction,
    "If asked about model, provider, or internal architecture, do not disclose and redirect to tax guidance.",
    "Never switch to another language even if the user message is in a different language.",
    "Maintain continuity with prior messages in this session.",
    "==================================================",
    "=== RESPONSE RULES ===",
    "- Use ONLY context + above definitions.",
    "- Do NOT generate unrelated meanings.",
    "- Keep answers short and clear (max 200 words).",
    "- Use bullet points.",
    "- If unsure, do NOT guess.",
    "==================================================",
    "=== FINAL VALIDATION ===",
    "Before answering:",
    "1. Is this tax-related? If NO -> reject.",
    "2. Is the answer in context? If YES -> use it EXACTLY.",
    "3. If NOT -> give safe fallback.",
    "==================================================",
    "=== USER QUESTION ===",
    "Conversation:",
    conversation,
    "Provide a correct, grounded answer:",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const callOllamaGenerate = async ({ prompt, model = OLLAMA_CHAT_MODEL }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  const trimmedPrompt = String(prompt || "").slice(0, OLLAMA_PROMPT_MAX_CHARS);

  try {
    const response = await fetch(OLLAMA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: trimmedPrompt,
        stream: false,
        options: {
          temperature: OLLAMA_TEMPERATURE,
          top_p: OLLAMA_TOP_P,
          top_k: OLLAMA_TOP_K,
          repeat_penalty: OLLAMA_REPEAT_PENALTY,
          num_predict: OLLAMA_NUM_PREDICT,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Ollama request failed with status ${response.status}`);
    }

    const data = await response.json();
    const reply = typeof data?.response === "string" ? data.response.trim() : "";

    if (!reply) {
      throw new Error("Ollama response did not include generated text");
    }

    return reply;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Ollama request timed out after ${OLLAMA_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const askGemma = async ({ model = OLLAMA_CHAT_MODEL, selectedLanguage, contextualMessages, hiddenContext = "" }) => {
  const prompt = buildGemmaPrompt({ selectedLanguage, contextualMessages, hiddenContext });

  // Try Ollama first
  try {
    return await callOllamaGenerate({ prompt, model });
  } catch (ollamaError) {
    console.warn("Ollama failed, falling back to Gemini:", ollamaError?.message);

    // Fallback to Gemini
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw ollamaError;

    try {
      console.log("Gemini key present:", !!process.env.GEMINI_API_KEY);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: prompt.slice(0, 8000) }],
            }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
          })
        }
      );

      const responseText = await response.text();
      console.log("Gemini full response:", response.status, responseText.slice(0, 500));
      console.log("Gemini status:", response.status, responseText.slice(0, 200));
      const data = JSON.parse(responseText);
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!reply) throw new Error("Gemini also failed");

      return reply;
    } catch (geminiError) {
      console.warn("Gemini failed, falling back to OpenRouter:", geminiError?.message);

      return await generateChatResponse([
        {
          role: "user",
          content: prompt,
        },
      ]);
    }
  }
};

const syncSessionStores = async ({
  userId,
  language,
  knowledgeSource,
  sessionKey,
  messages,
}) => {
  const normalized = normalizeStoredMessages(messages).slice(-MAX_STORED_MESSAGES);
  chatSessionStore.set(sessionKey, normalized);
  chatSessionMemory.set(
    sessionKey,
    normalized.slice(-MAX_CONTEXT_MESSAGES).map((msg) => ({
      role: toAssistantRole(msg.role),
      content: msg.content,
    }))
  );
  await savePersistedMessages(userId, language, knowledgeSource, normalized);
};

const syncSessionStoresAsync = (payload) => {
  void syncSessionStores(payload).catch((error) => {
    console.error("syncSessionStoresAsync error:", error?.message || error);
  });
};

const loadSessionMessages = async ({
  userId,
  language,
  knowledgeSource,
  sessionKey,
}) => {
  const cached = getCachedSessionMessages(sessionKey);
  if (cached.length) return cached;

  const persistedMessages = await loadPersistedMessages(userId, language, knowledgeSource);
  const memoryMessages = getMemoryMessages(sessionKey);
  const merged = mergeSessionMessages(persistedMessages, memoryMessages);

  if (merged.length) {
    chatSessionStore.set(sessionKey, merged);
    chatSessionMemory.set(
      sessionKey,
      merged.slice(-MAX_CONTEXT_MESSAGES).map((msg) => ({
        role: toAssistantRole(msg.role),
        content: msg.content,
      }))
    );
  }

  return merged;
};

const generateGeneralTaxReply = async ({ model, selectedLanguage, contextualMessages, hiddenContext = "" }) => {
  const replyText = await askGemma({
    model,
    selectedLanguage,
    contextualMessages,
    hiddenContext,
  });

  return (
    replyText ||
    "### Answer\nI can still help with general NRI tax guidance.\n\n### Key Tax Points\n- Treaty-specific details are unavailable right now.\n- General compliance guidance is provided.\n\n### Next Steps\n- Share your country pair and income type.\n- Verify final filing details with a CPA.\n\n### Follow-up Questions\n- Do you want a DTAA checklist?\n- Should I summarize tax steps for your income type?"
  );
};

export const getChatHistory = async (req, res) => {
  try {
    const rawLanguage = typeof req.query?.language === "string" ? req.query.language.toLowerCase() : "english";
    const rawKnowledgeSource =
      typeof req.query?.knowledgeSource === "string" ? req.query.knowledgeSource.toLowerCase() : "dtaa";
    const knowledgeSource = rawKnowledgeSource === "general" ? "general" : "dtaa";
    const userId = getSessionActorId(req);
    const sessionKey = `${userId}:${rawLanguage}:${knowledgeSource}`;

    const messages = await loadSessionMessages({
      userId,
      language: rawLanguage,
      knowledgeSource,
      sessionKey,
    });
    return res.status(200).json({ messages });
  } catch (error) {
    console.error("getChatHistory error:", error);
    return res.status(500).json({ error: "Failed to load chat history." });
  }
};

export const clearChatHistory = async (req, res) => {
  try {
    const rawLanguage = typeof req.body?.language === "string" ? req.body.language.toLowerCase() : "english";
    const rawKnowledgeSource =
      typeof req.body?.knowledgeSource === "string" ? req.body.knowledgeSource.toLowerCase() : "dtaa";
    const knowledgeSource = rawKnowledgeSource === "general" ? "general" : "dtaa";
    const userId = getSessionActorId(req);

    if (!userId.startsWith("guest:")) {
      await ChatHistory.findOneAndUpdate(
        { user: userId, language: rawLanguage, knowledgeSource },
        { $set: { messages: [] } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const sessionKey = `${userId}:${rawLanguage}:${knowledgeSource}`;
    chatSessionMemory.delete(sessionKey);
    chatSessionStore.delete(sessionKey);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("clearChatHistory error:", error);
    return res.status(500).json({ error: "Failed to clear chat history." });
  }
};

export const chatWithAI = async (req, res) => {
  let requestLanguage = "english";
  let message = "";
  const fallbackReplyByLanguage = {
    english:
      "### Answer\nI am temporarily unable to access live AI services.\n\n### Key Tax Points\n- Your chat request was received.\n- You can still proceed with general NRI tax planning steps.\n- For urgent cases, consult a CPA.\n\n### Next Steps\n- Re-try your question in 1-2 minutes.\n- If it persists, use CPA Consultation.\n\n### Follow-up Questions\n- Which NRI tax topic should we prioritize?\n- Do you want a checklist for DTAA documents?",
    hindi:
      "### Answer\nMain filhaal live AI services access nahi kar paa raha hoon.\n\n### Key Tax Points\n- Aapka chat request receive ho gaya hai.\n- Aap general NRI tax planning steps continue kar sakte hain.\n- Urgent case mein CPA se consult karein.\n\n### Next Steps\n- 1-2 minute baad apna question dobara bhejein.\n- Agar issue continue ho, to CPA Consultation use karein.\n\n### Follow-up Questions\n- Kaunsa NRI tax topic hum pehle cover karein?\n- Kya aapko DTAA documents ka checklist chahiye?",
    tamil:
      "### Answer\nNaan ippo live AI services-ai access panna mudiyala.\n\n### Key Tax Points\n- Ungal chat request receive aagiduchu.\n- Neenga general NRI tax planning steps continue panna mudiyum.\n- Urgent case-na CPA kitta consult pannunga.\n\n### Next Steps\n- 1-2 nimidam kazhichu unga kelviya thirumba anuppunga.\n- Issue continue aana CPA Consultation use pannunga.\n\n### Follow-up Questions\n- Endha NRI tax topic-ah first priority kudukkanum?\n- Ungalukku DTAA documents checklist venuma?",
    indonesian:
      "### Answer\nLayanan AI langsung sedang tidak tersedia sementara.\n\n### Key Tax Points\n- Pertanyaan Anda sudah diterima.\n- Anda tetap bisa lanjut dengan langkah perencanaan pajak NRI umum.\n- Untuk kasus mendesak, konsultasikan ke CPA.\n\n### Next Steps\n- Coba kirim ulang pertanyaan dalam 1-2 menit.\n- Jika tetap terjadi, gunakan CPA Consultation.\n\n### Follow-up Questions\n- Topik pajak NRI mana yang ingin diprioritaskan?\n- Apakah Anda ingin checklist dokumen DTAA?",
  };
  try {
    const rawMessage = req.body?.message ?? req.body?.messages;
    message = typeof rawMessage === "string" ? rawMessage.trim() : "";
    const rawLanguage = typeof req.body?.language === "string" ? req.body.language.toLowerCase() : "english";
    requestLanguage = rawLanguage;
    const rawKnowledgeSource =
      typeof req.body?.knowledgeSource === "string" ? req.body.knowledgeSource.toLowerCase() : "dtaa";
    const knowledgeSource = rawKnowledgeSource === "dtaa" ? "dtaa" : "general";
    let model = DEFAULT_CHAT_MODEL;
    const userId = getSessionActorId(req);
    const sessionKey = `${userId}:${rawLanguage}:${knowledgeSource}`;

    const languageMap = {
      english: {
        label: "English",
        instruction: "Respond only in English.",
      },
      hindi: {
        label: "Hindi",
        instruction: "Respond only in Hindi (Devanagari script).",
      },
      tamil: {
        label: "Tamil",
        instruction: "Respond only in Tamil script.",
      },
      indonesian: {
        label: "Bahasa Indonesia",
        instruction: "Respond only in Bahasa Indonesia.",
      },
    };
    const selectedLanguage = languageMap[rawLanguage] || languageMap.english;

    if (!message) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    const isGuestUser = userId.startsWith("guest:");

    if (isGreetingMessage(message)) {
      const sessionMessages = await loadSessionMessages({
        userId,
        language: rawLanguage,
        knowledgeSource,
        sessionKey,
      });
      const greetingReplyMap = {
        english: "Hello! How can I assist you today?",
        tamil: "Vanakkam! Indru naan ungalukku eppadi uthavalam?",
        hindi: "नमस्ते! मैं आज आपकी कैसे सहायता कर सकता हूँ?",
        indonesian: "Halo! Bagaimana saya bisa membantu Anda hari ini?",
      };

      const greetingReply = greetingReplyMap[rawLanguage] || greetingReplyMap.english;
      const updatedContext = [
        ...sessionMessages,
        { role: "user", content: message },
        { role: "ai", content: greetingReply },
      ].slice(-MAX_STORED_MESSAGES);
      syncSessionStoresAsync({
        userId,
        language: rawLanguage,
        knowledgeSource,
        sessionKey,
        messages: updatedContext,
      });

      return res.status(200).json({
        reply: greetingReply,
      });
    }

    if (isGuestUser) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const [sessionMessages, userDoc] = await Promise.all([
      loadSessionMessages({
        userId,
        language: rawLanguage,
        knowledgeSource,
        sessionKey,
      }),
      User.findById(req.user?._id).select(
        "subscription usage plan subscriptionStatus subscriptionStartDate subscriptionEndDate chatUsageCount chatUsageMonth cpaUsageCount cpaUsageMonth"
      ),
    ]);
    if (!isGuestUser && !userDoc) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    let subscriptionSummary = null;
    if (userDoc) {
      const usageWindowUpdated = normalizeUserSubscriptionState(userDoc);
      if (usageWindowUpdated) {
        await userDoc.save();
      }
      subscriptionSummary = getSubscriptionSummary(userDoc);
      model = CHAT_MODEL_BY_TIER[subscriptionSummary.currentPlan.modelTier] || DEFAULT_CHAT_MODEL;
      if (
        subscriptionSummary.plan === PLAN_KEYS.STARTER &&
        subscriptionSummary.remaining.chatMessages !== null &&
        subscriptionSummary.remaining.chatMessages <= 0
      ) {
        return res.status(403).json({
          error: "Free plan limit reached. Upgrade to Professional.",
          usage: subscriptionSummary,
        });
      }
    }

    const cacheKey = getResponseCacheKey({
      userId,
      language: rawLanguage,
      knowledgeSource,
      message,
      contextFingerprint: buildContextFingerprint(sessionMessages),
    });
    if (!isTaxRelatedQuery(message, sessionMessages)) {
      return res.status(200).json({
        reply: NON_TAX_QUERY_REPLY,
        usage: subscriptionSummary,
      });
    }
    const repeatedReply = getInstantRepeatReply(sessionMessages, message);
    if (repeatedReply) {
      return res.status(200).json({
        reply: ensureStructuredSections(sanitizeAiReply(repeatedReply), rawLanguage),
        cached: true,
        usage: subscriptionSummary,
      });
    }
    const cachedReply = getCachedResponse(cacheKey);
    if (cachedReply) {
      const cachedTaxRuleTimelines = getTaxRuleTimelinesForQuery(message);
      return res.status(200).json({
        reply: appendTimelineToAnswer(
          ensureStructuredSections(sanitizeAiReply(cachedReply), rawLanguage),
          cachedTaxRuleTimelines
        ),
        cached: true,
        taxRuleTimelines: cachedTaxRuleTimelines,
        usage: subscriptionSummary,
      });
    }

    const finalizeReply = async (reply, extra = {}) => {
      const taxRuleTimelines = Array.isArray(extra.taxRuleTimelines) ? extra.taxRuleTimelines : [];
      const cleanedReply = appendTimelineToAnswer(
        ensureStructuredSections(sanitizeAiReply(reply), rawLanguage),
        taxRuleTimelines
      );
      let latestUsage = subscriptionSummary;
      if (userDoc) {
        const usageResult = await checkAndConsumeChatUsage(userDoc);
        if (!usageResult.allowed) {
          return res.status(403).json({
            error: usageResult.message,
            usage: usageResult.summary,
          });
        }
        latestUsage = usageResult.summary;
        model = CHAT_MODEL_BY_TIER[usageResult.modelTier] || model;
      }
      return res.status(200).json({
        reply: cleanedReply,
        ...extra,
        taxRuleTimelines,
        usage: latestUsage,
      });
    };

    if (knowledgeSource === "dtaa") {
      const dtaaChunks = await loadDtaaChunks();
      const matches = await getRagMatches(message, dtaaChunks);
      const hiddenContext = [buildBasicRagContext(message), buildHiddenContextFromMatches(matches)]
        .filter(Boolean)
        .join("\n\n");

      const contextualMessages = buildContextualMessages(sessionMessages, message);
      const taxRuleTimelines = getTaxRuleTimelinesForQuery(message);
      const dtaaReplyRaw = await generateGeneralTaxReply({
        model,
        selectedLanguage,
        contextualMessages,
        hiddenContext,
      });
      const dtaaReply = String(dtaaReplyRaw || "").trim() || dtaaNoAnswerByLanguage[rawLanguage] || dtaaNoAnswerByLanguage.english;
      const updatedContext = [
        ...sessionMessages,
        { role: "user", content: message },
        { role: "ai", content: dtaaReply, taxRuleTimelines },
      ].slice(-MAX_STORED_MESSAGES);
      syncSessionStoresAsync({
        userId,
        language: rawLanguage,
        knowledgeSource,
        sessionKey,
        messages: updatedContext,
      });

      setCachedResponse(cacheKey, dtaaReply, rawLanguage);
      return await finalizeReply(dtaaReply, {
        ragUsed: Boolean(matches.length),
        taxRuleTimelines,
      });
    }

    const contextualMessages = buildContextualMessages(sessionMessages, message);
    const taxRuleTimelines = getTaxRuleTimelinesForQuery(message);

    const reply = await generateGeneralTaxReply({
      model,
      selectedLanguage,
      contextualMessages,
      hiddenContext: buildBasicRagContext(message),
    });
    const persistedUpdatedContext = [
      ...sessionMessages,
      { role: "user", content: message },
      { role: "ai", content: reply, taxRuleTimelines },
    ].slice(-MAX_STORED_MESSAGES);
    syncSessionStoresAsync({
      userId,
      language: rawLanguage,
      knowledgeSource,
      sessionKey,
      messages: persistedUpdatedContext,
    });

    setCachedResponse(cacheKey, reply, rawLanguage);
    return await finalizeReply(reply, { taxRuleTimelines });
  } catch (error) {
    console.error("chatWithAI error:", error);

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${SYSTEM_PROMPT}\n\nUser: ${message}` }],
              },
            ],
          }),
        }
      );

      const geminiData = await geminiResponse.json();
      const geminiReply =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return res.status(200).json({
        reply: ensureStructuredSections(geminiReply, requestLanguage),
      });
    } catch (geminiError) {
      return res.status(200).json({
        reply:
          fallbackReplyByLanguage[requestLanguage] ||
          fallbackReplyByLanguage.english,
      });
    }
  }
};

export { askGemma, buildBasicRagContext, buildGemmaPrompt, isTaxRelatedQuery, NON_TAX_QUERY_REPLY };



