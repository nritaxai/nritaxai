import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import ChatHistory from "../Models/chatHistoryModel.js";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const MAX_CONTEXT_MESSAGES = 8;
const MAX_STORED_MESSAGES = 100;
const chatSessionMemory = new Map();
const chatSessionStore = new Map();
const RAG_TOP_K = Number(process.env.RAG_TOP_K || 3);
const RAG_LEXICAL_CANDIDATES = Number(process.env.RAG_LEXICAL_CANDIDATES || 16);
const RAG_LEXICAL_MIN_SCORE = 1.05;
const RAG_EMBEDDING_MIN_SIMILARITY = 0.12;
const RAG_EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || "openai/text-embedding-3-small";
const RAG_MAX_PER_PAGE = 1;
const RAG_ENABLE_EMBEDDING_RERANK = String(process.env.RAG_ENABLE_EMBEDDING_RERANK || "false").toLowerCase() === "true";
const CHAT_MAX_TOKENS = Number(process.env.CHAT_MAX_TOKENS || 220);
const OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 20000);
let dtaaChunksCache = null;

const modelMap = {
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4o": "openai/gpt-4o",
};
const DEFAULT_CHAT_MODEL = modelMap["gpt-4o-mini"];

const STORAGE_DIR = path.resolve("storage");
const PDF_DIR = path.join(STORAGE_DIR, "pdfs");
const INDEX_PATH = path.join(STORAGE_DIR, "pdf_index.json");

const tokenize = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

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

const searchChunks = (question, chunks, limit = RAG_TOP_K) => {
  const qTokens = tokenize(question);
  if (!qTokens.length) return [];

  const qSet = new Set(qTokens);
  const normalizedQuestion = question.toLowerCase();

  const scored = chunks
    .map((chunk) => {
      const chunkTokens = tokenize(chunk.text);
      const tokenSet = new Set(chunkTokens);
      let overlap = 0;
      qSet.forEach((token) => {
        if (tokenSet.has(token)) overlap += 1;
      });

      let score = overlap;
      if (chunk.text.toLowerCase().includes(normalizedQuestion)) score += 2;
      if (overlap >= 2) score += 0.6;
      if (/\barticle\s+\d+/i.test(normalizedQuestion) && /\barticle\s+\d+/i.test(chunk.text)) score += 1.2;
      if (chunkTokens.length > 0) score += overlap / Math.sqrt(chunkTokens.length);

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
  const lexicalCandidates = uniqueByText(
    queryVariants.flatMap((query) => searchChunks(query, chunks, Math.ceil(RAG_LEXICAL_CANDIDATES / queryVariants.length)))
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

const loadPdfFilesFromDirectories = () => {
  const dirsToScan = [
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), ".."),
    PDF_DIR,
  ];

  const files = [];
  const seen = new Set();

  dirsToScan.forEach((dirPath) => {
    if (!fs.existsSync(dirPath)) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
      .forEach((entry) => {
        const absPath = path.join(dirPath, entry.name);
        if (seen.has(absPath)) return;
        seen.add(absPath);
        files.push(absPath);
      });
  });

  return files;
};

const loadDtaaChunks = async () => {
  if (Array.isArray(dtaaChunksCache)) return dtaaChunksCache;

  const indexed = loadIndexChunks();
  if (indexed.length > 0) {
    dtaaChunksCache = indexed.map((row) => ({
      file: row.file,
      page: row.page,
      text: row.text,
    }));
    return dtaaChunksCache;
  }

  const pdfFiles = loadPdfFilesFromDirectories();
  if (!pdfFiles.length) return [];

  const chunks = [];

  for (const pdfPath of pdfFiles) {
    const buffer = fs.readFileSync(pdfPath);
    const pageTexts = await extractPageTexts(buffer);
    const file = path.basename(pdfPath);

    pageTexts.forEach(({ page, text }) => {
      chunkText(text).forEach((chunk) => {
        chunks.push({ file, page, text: chunk });
      });
    });
  }

  dtaaChunksCache = chunks;
  return chunks;
};

const dtaaNoAnswerByLanguage = {
  english: "I don't have enough information to answer that confidently.",
  tamil: "இதற்கு நம்பிக்கையுடன் பதில் அளிக்க போதுமான தகவல் இல்லை.",
  hindi: "इसका भरोसेमंद उत्तर देने के लिए पर्याप्त जानकारी नहीं है।",
  indonesian: "Saya tidak memiliki informasi yang cukup untuk menjawab itu dengan yakin.",
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
          "Keep the reply under 170 words unless user asks for full detail. " +
          "Return markdown with only these headings:\n" +
          "### Answer\n" +
          "### Key Tax Points\n" +
          "### Next Steps\n" +
          "### Follow-up Questions\n" +
          "Use at most 3 bullets per section and exactly 2 follow-up questions.",
      },
      ...contextualMessages,
    ],
  });

  return response?.choices?.[0]?.message?.content || "I’m unable to answer right now.";
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
  try {
    const rawMessage = req.body?.message ?? req.body?.messages;
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
    const rawLanguage = typeof req.body?.language === "string" ? req.body.language.toLowerCase() : "english";
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

    if (knowledgeSource === "dtaa") {
      const dtaaChunks = await loadDtaaChunks();
      const matches = await getRagMatches(message, dtaaChunks);

      if (!matches.length) {
        const priorSessionMessages = toAssistantMessages(sessionMessages);
        const fallbackMessages = [...priorSessionMessages, { role: "user", content: message }].slice(
          -MAX_CONTEXT_MESSAGES
        );
        const noAnswerReply = await generateGeneralTaxReply({
          model,
          selectedLanguage,
          contextualMessages: fallbackMessages,
        });
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

        return res.status(200).json({
          reply: noAnswerReply,
        });
      }

      const context = matches.map((match) => `[ref ${match.page}] ${match.text}`).join("\n\n");
      const priorTurns = sessionMessages
        .slice(-4)
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
        "Keep the reply under 190 words unless user asks for detailed analysis. " +
        "Return markdown with only these headings:\n" +
        "### Answer\n" +
        "### Key Tax Points\n" +
        "### Next Steps\n" +
        "### Follow-up Questions\n" +
        "Use at most 3 bullets per section and exactly 2 follow-up questions.";

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

      const dtaaReply = dtaaResponse?.choices?.[0]?.message?.content || dtaaNoAnswerByLanguage.english;
      const updatedContext = [
        ...sessionMessages,
        { role: "user", content: message },
        { role: "ai", content: dtaaReply },
      ].slice(-MAX_STORED_MESSAGES);
      syncSessionStoresAsync({
        userId,
        language: rawLanguage,
        knowledgeSource,
        sessionKey,
        messages: updatedContext,
      });

      return res.status(200).json({
        reply: dtaaReply,
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

    res.status(200).json({
      reply,
    });
  } catch (error) {
    console.error("OpenRouter Error:", error);
    res.status(500).json({
      error: "AI response failed",
    });
  }
};

