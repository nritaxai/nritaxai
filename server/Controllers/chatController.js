import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import OpenAI from "openai";
import ChatHistory from "../Models/chatHistoryModel.js";
import User from "../Models/userModel.js";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const MAX_CONTEXT_MESSAGES = Number(process.env.CHAT_CONTEXT_MESSAGES || 2);
const MAX_STORED_MESSAGES = 100;
const chatSessionMemory = new Map();
const chatSessionStore = new Map();
const RAG_TOP_K = Number(process.env.RAG_TOP_K || 2);
const RAG_LEXICAL_CANDIDATES = Number(process.env.RAG_LEXICAL_CANDIDATES || 8);
const RAG_LEXICAL_MIN_SCORE = 1.05;
const RAG_EMBEDDING_MIN_SIMILARITY = 0.12;
const RAG_EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || "openai/text-embedding-3-small";
const RAG_MAX_PER_PAGE = 1;
const RAG_ENABLE_EMBEDDING_RERANK = String(process.env.RAG_ENABLE_EMBEDDING_RERANK || "false").toLowerCase() === "true";
const CHAT_MAX_TOKENS = Number(process.env.CHAT_MAX_TOKENS || 96);
const OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 12000);
const FREE_MONTHLY_QUERY_LIMIT = Number(process.env.FREE_MONTHLY_QUERY_LIMIT || 10);
let dtaaChunksCache = null;
let dtaaTokenIndexCache = null;
let dtaaIndexMtimeCache = null;
const TOKEN_REGEX = /[^a-z0-9\s]/g;
const RAG_INDEX_MAX_CANDIDATES = Number(process.env.RAG_INDEX_MAX_CANDIDATES || 140);
const RESPONSE_CACHE_TTL_MS = Number(process.env.RESPONSE_CACHE_TTL_MS || 120000);
const RESPONSE_CACHE_MAX_ITEMS = Number(process.env.RESPONSE_CACHE_MAX_ITEMS || 500);
const CHAT_DISABLE_PDF_DIR_FALLBACK = String(process.env.CHAT_DISABLE_PDF_DIR_FALLBACK || "true").toLowerCase() === "true";
const responseCache = new Map();

const modelMap = {
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4o": "openai/gpt-4o",
};
const DEFAULT_CHAT_MODEL = modelMap["gpt-4o-mini"];

const STORAGE_DIR = path.resolve("storage");
const PDF_DIR = path.join(STORAGE_DIR, "pdfs");
const INDEX_PATH = path.join(STORAGE_DIR, "pdf_index.json");

const isSameMonthYear = (a, b) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

const normalizeUsageWindow = (userDoc) => {
  const now = new Date();
  const lastResetRaw = userDoc?.usage?.lastReset;
  const lastReset = lastResetRaw ? new Date(lastResetRaw) : null;
  const hasValidLastReset = lastReset && !Number.isNaN(lastReset.getTime());

  if (!userDoc.usage) {
    userDoc.usage = { queriesUsed: 0, lastReset: now };
    return true;
  }

  if (!hasValidLastReset || !isSameMonthYear(lastReset, now)) {
    userDoc.usage.queriesUsed = 0;
    userDoc.usage.lastReset = now;
    return true;
  }

  if (!Number.isFinite(userDoc.usage.queriesUsed) || userDoc.usage.queriesUsed < 0) {
    userDoc.usage.queriesUsed = 0;
    return true;
  }

  return false;
};

const buildUsagePayload = (userDoc) => {
  const queriesUsed = Number(userDoc?.usage?.queriesUsed || 0);
  const plan = String(userDoc?.subscription?.plan || "FREE").toUpperCase();
  const isFreePlan = plan === "FREE";

  return {
    plan,
    queriesUsed,
    monthlyLimit: isFreePlan ? FREE_MONTHLY_QUERY_LIMIT : null,
    remaining: isFreePlan ? Math.max(0, FREE_MONTHLY_QUERY_LIMIT - queriesUsed) : null,
    lastReset: userDoc?.usage?.lastReset || null,
  };
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
};

const compact = (text = "") => text.toLowerCase().replace(/[^a-z0-9]/g, "");
const sanitizeAiReply = (text = "") => String(text).replace(/\*\*/g, "").replace(/__/g, "");

const getResponseCacheKey = ({ userId = "", language = "", knowledgeSource = "", message = "" }) =>
  `${String(userId)}|${String(language)}|${String(knowledgeSource)}|${String(message).trim().toLowerCase()}`;

const getCachedResponse = (cacheKey) => {
  const row = responseCache.get(cacheKey);
  if (!row) return null;
  if (Date.now() - row.createdAt > RESPONSE_CACHE_TTL_MS) {
    responseCache.delete(cacheKey);
    return null;
  }
  return row.reply;
};

const setCachedResponse = (cacheKey, reply) => {
  if (!cacheKey || !String(reply || "").trim()) return;
  responseCache.set(cacheKey, { reply, createdAt: Date.now() });
  if (responseCache.size <= RESPONSE_CACHE_MAX_ITEMS) return;
  const oldestKey = responseCache.keys().next().value;
  if (oldestKey) responseCache.delete(oldestKey);
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

const loadDtaaChunks = async () => {
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
      content: msg.content.trim(),
    }));

const loadPersistedMessages = async (userId, language, knowledgeSource) => {
  if (!userId || userId === "guest") return [];
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
  if (!userId || userId === "guest") return;

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

const generateGeneralTaxReply = async ({ model, selectedLanguage, contextualMessages }) => {
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: CHAT_MAX_TOKENS,
    timeout: OPENROUTER_TIMEOUT_MS,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful tax assistant for NRITAX.AI. " +
          "Always provide practical, accurate, and concise tax guidance for NRIs. " +
          `${selectedLanguage.instruction} ` +
          "If asked about model, provider, or internal architecture, do not disclose and redirect to tax guidance. " +
          "Never switch to another language even if the user message is in a different language. " +
          "Maintain continuity with prior messages in this session. " +
          "Prefer concise, direct answers unless detail is explicitly asked. " +
          "Keep key tax acronyms like DTAA, ITR, PAN, NRE, and NRO as-is. " +
          "Keep the reply under 120 words unless user asks for full detail. " +
          "Return markdown with only these headings:\n" +
          "### Answer\n" +
          "### Key Tax Points\n" +
          "### Next Steps\n" +
          "### Follow-up Questions\n" +
          "Use at most 2 bullets per section and exactly 2 follow-up questions.",
      },
      ...contextualMessages,
    ],
  });

  return (
    response?.choices?.[0]?.message?.content ||
    "### Answer\nI can still help with general NRI tax guidance.\n\n### Key Tax Points\n- Treaty-specific details are unavailable right now.\n- General compliance guidance is provided.\n\n### Next Steps\n- Share your country pair and income type.\n- Verify final filing details with a CPA.\n\n### Follow-up Questions\n- Do you want a DTAA checklist?\n- Should I summarize tax steps for your income type?"
  );
};

export const getChatHistory = async (req, res) => {
  try {
    const rawLanguage = typeof req.query?.language === "string" ? req.query.language.toLowerCase() : "english";
    const rawKnowledgeSource =
      typeof req.query?.knowledgeSource === "string" ? req.query.knowledgeSource.toLowerCase() : "dtaa";
    const knowledgeSource = rawKnowledgeSource === "general" ? "general" : "dtaa";
    const userId = req.user?._id?.toString?.() || "guest";
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
    const userId = req.user?._id?.toString?.() || "guest";

    if (userId !== "guest") {
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
  try {
    const rawMessage = req.body?.message ?? req.body?.messages;
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
    const rawLanguage = typeof req.body?.language === "string" ? req.body.language.toLowerCase() : "english";
    requestLanguage = rawLanguage;
    const rawKnowledgeSource =
      typeof req.body?.knowledgeSource === "string" ? req.body.knowledgeSource.toLowerCase() : "dtaa";
    const knowledgeSource = rawKnowledgeSource === "dtaa" ? "dtaa" : "general";
    const model = DEFAULT_CHAT_MODEL;
    const userId = req.user?._id?.toString?.() || "guest";
    const sessionKey = `${userId}:${rawLanguage}:${knowledgeSource}`;
    const sessionMessages = await loadSessionMessages({
      userId,
      language: rawLanguage,
      knowledgeSource,
      sessionKey,
    });

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

    if (isGreetingMessage(message)) {
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

    if (!message) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    const userDoc = await User.findById(req.user?._id).select("subscription usage");
    if (!userDoc) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const usageWindowUpdated = normalizeUsageWindow(userDoc);
    const userPlan = String(userDoc?.subscription?.plan || "FREE").toUpperCase();
    const isFreePlan = userPlan === "FREE";

    if (usageWindowUpdated) {
      await userDoc.save();
    }

    if (isFreePlan && Number(userDoc?.usage?.queriesUsed || 0) >= FREE_MONTHLY_QUERY_LIMIT) {
      return res.status(429).json({
        error: "Free usage limit reached for this month. Upgrade to PRO for unlimited access.",
        usage: buildUsagePayload(userDoc),
      });
    }

    const cacheKey = getResponseCacheKey({
      userId,
      language: rawLanguage,
      knowledgeSource,
      message,
    });
    const repeatedReply = getInstantRepeatReply(sessionMessages, message);
    if (repeatedReply) {
      return res.status(200).json({
        reply: repeatedReply,
        cached: true,
        usage: buildUsagePayload(userDoc),
      });
    }
    const cachedReply = getCachedResponse(cacheKey);
    if (cachedReply) {
      return res.status(200).json({
        reply: cachedReply,
        cached: true,
        usage: buildUsagePayload(userDoc),
      });
    }

    const finalizeReply = async (reply, extra = {}) => {
      userDoc.usage.queriesUsed = Number(userDoc.usage.queriesUsed || 0) + 1;
      await userDoc.save();
      return res.status(200).json({
        reply,
        ...extra,
        usage: buildUsagePayload(userDoc),
      });
    };

    if (knowledgeSource === "dtaa") {
      const dtaaChunks = await loadDtaaChunks();
      const matches = await getRagMatches(message, dtaaChunks);

      if (!matches.length) {
        const priorSessionMessages = toAssistantMessages(sessionMessages);
        const fallbackMessages = [...priorSessionMessages, { role: "user", content: message }].slice(
          -MAX_CONTEXT_MESSAGES
        );
        const generalFallbackReply = await generateGeneralTaxReply({
          model,
          selectedLanguage,
          contextualMessages: fallbackMessages,
        });
        const disclaimer = ragFallbackDisclaimerByLanguage[rawLanguage] || ragFallbackDisclaimerByLanguage.english;
        const noAnswerReply = `### Note\n${disclaimer}\n\n${generalFallbackReply}`;
        const updatedContext = [
          ...sessionMessages,
          { role: "user", content: message },
          { role: "ai", content: noAnswerReply },
        ].slice(-MAX_STORED_MESSAGES);
        syncSessionStoresAsync({
          userId,
          language: rawLanguage,
          knowledgeSource,
          sessionKey,
          messages: updatedContext,
        });

        return await finalizeReply(noAnswerReply, {
          ragUsed: false,
          sources: [],
        });
      }

      const context = matches.map((match) => `[ref ${match.page}] ${match.text}`).join("\n\n");
      const priorTurns = sessionMessages
        .slice(-2)
        .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
        .join("\n");
      const dtaaPrompt =
        "You are a tax assistant for NRITAX.AI. " +
        "Prefer the provided CONTEXT first. " +
        "Do not reveal implementation details, retrieval pipelines, or internal data sources. " +
        "If asked about model, provider, or internal architecture, refuse and continue with tax guidance only. " +
        "If CONTEXT is missing or unclear, provide safe general NRI-tax guidance and clearly label it as general guidance. " +
        `${selectedLanguage.instruction} ` +
        "Never switch to another language even if the user message is in a different language. " +
        "Keep key tax acronyms like DTAA, ITR, PAN, NRE, and NRO as-is. " +
        "Prefer exact treaty/article wording when present in context. " +
        "If rates, conditions, thresholds, forms, or exceptions are present, include only the most relevant ones. " +
        "If context is partial, clearly state assumptions and what is missing. " +
        "Keep the reply under 120 words unless user asks for detailed analysis. " +
        "Return markdown with only these headings:\n" +
        "### Answer\n" +
        "### Key Tax Points\n" +
        "### Next Steps\n" +
        "### Follow-up Questions\n" +
        "Use at most 2 bullets per section and exactly 2 follow-up questions.";

      const dtaaResponse = await client.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: CHAT_MAX_TOKENS,
        messages: [
          {
            role: "system",
            content: dtaaPrompt,
          },
          {
            role: "user",
            content: `${priorTurns ? `PRIOR_MESSAGES:\n${priorTurns}\n\n` : ""}CONTEXT:\n${context}\n\nQUESTION:\n${message}`,
          },
        ],
        timeout: OPENROUTER_TIMEOUT_MS,
      });

      const dtaaReplyRaw = String(dtaaResponse?.choices?.[0]?.message?.content || "").trim();
      const dtaaReply = dtaaReplyRaw || dtaaNoAnswerByLanguage[rawLanguage] || dtaaNoAnswerByLanguage.english;
      const dtaaReplyWithSources = appendSourcesIfMissing(dtaaReply, matches);
      const updatedContext = [
        ...sessionMessages,
        { role: "user", content: message },
        { role: "ai", content: dtaaReplyWithSources },
      ].slice(-MAX_STORED_MESSAGES);
      syncSessionStoresAsync({
        userId,
        language: rawLanguage,
        knowledgeSource,
        sessionKey,
        messages: updatedContext,
      });

      setCachedResponse(cacheKey, dtaaReplyWithSources);
      return await finalizeReply(dtaaReplyWithSources, {
        ragUsed: true,
        sources: matches.map((m) => ({ file: m.file, page: m.page })),
      });
    }

    const priorSessionMessages = toAssistantMessages(sessionMessages);
    const contextualMessages = [...priorSessionMessages, { role: "user", content: message }].slice(
      -MAX_CONTEXT_MESSAGES
    );

    const reply = await generateGeneralTaxReply({
      model,
      selectedLanguage,
      contextualMessages,
    });
    const persistedUpdatedContext = [
      ...sessionMessages,
      { role: "user", content: message },
      { role: "ai", content: reply },
    ].slice(-MAX_STORED_MESSAGES);
    syncSessionStoresAsync({
      userId,
      language: rawLanguage,
      knowledgeSource,
      sessionKey,
      messages: persistedUpdatedContext,
    });

    setCachedResponse(cacheKey, reply);
    return await finalizeReply(reply);
  } catch (error) {
    console.error("OpenRouter Error:", error);

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
    return res.status(200).json({
      reply: fallbackReplyByLanguage[requestLanguage] || fallbackReplyByLanguage.english,
      warning: "AI provider temporarily unavailable. Fallback response returned.",
    });
  }
};



