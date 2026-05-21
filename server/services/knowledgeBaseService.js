import crypto from "crypto";
import fs from "fs";

import KnowledgeChunk from "../Models/knowledgeChunkModel.js";
import KnowledgeDocument from "../Models/knowledgeDocumentModel.js";
import KnowledgeIngestionLog from "../Models/knowledgeIngestionLogModel.js";
import { buildPdfIndexRowsFromFile } from "./pdfIndexService.js";
import { recordDocumentProcessingMetric } from "./metrics.js";

const GEMINI_EMBED_MODEL = String(process.env.GEMINI_EMBED_MODEL || "text-embedding-004").trim();
const KNOWLEDGE_TOP_K = Math.max(Number(process.env.KNOWLEDGE_BASE_TOP_K || 6), 1);

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");
const sha256File = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const cosineSimilarity = (left = [], right = []) => {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index] || 0);
    const b = Number(right[index] || 0);
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const tokenize = (text = "") =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);

const lexicalScore = (query = "", candidate = "") => {
  const queryTokens = new Set(tokenize(query));
  if (!queryTokens.size) return 0;
  const candidateTokens = new Set(tokenize(candidate));
  let overlap = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(queryTokens.size, 1);
};

const getGeminiApiKey = () =>
  sanitizeString(process.env.GEMINI_API_KEY) ||
  sanitizeString(process.env.GOOGLE_API_KEY) ||
  sanitizeString(process.env.GEMINI_KEY);

const embedTextWithGemini = async (text = "") => {
  const apiKey = getGeminiApiKey();
  if (!apiKey || !sanitizeString(text)) return [];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBED_MODEL}`,
        content: {
          parts: [{ text }],
        },
      }),
    }
  );

  if (!response.ok) {
    const textResponse = await response.text();
    throw new Error(textResponse || `Gemini embedding request failed with status ${response.status}`);
  }

  const json = await response.json();
  return Array.isArray(json?.embedding?.values)
    ? json.embedding.values.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [];
};

export const logKnowledgeIngestionEvent = async ({
  documentId = null,
  fileName = "",
  fileHash = "",
  jobId = "",
  stage = "ingest",
  status = "started",
  message = "",
  metadata = {},
}) =>
  KnowledgeIngestionLog.create({
    document: documentId || null,
    fileName,
    fileHash,
    jobId,
    stage,
    status,
    message,
    metadata,
  });

export const ingestKnowledgeDocumentFromFile = async ({
  fileName,
  filePath,
  sourceType = "other_pdf",
  jobId = "",
}) => {
  const startedAt = Date.now();
  const fileHash = sha256File(filePath);
  let document = await KnowledgeDocument.findOne({ fileHash });

  if (document) {
    document.status = "skipped_duplicate";
    document.lastIngestedAt = new Date();
    await document.save();
    await logKnowledgeIngestionEvent({
      documentId: document._id,
      fileName,
      fileHash,
      jobId,
      stage: "dedupe",
      status: "skipped",
      message: "Skipped duplicate knowledge document based on file hash.",
      metadata: { sourceType },
    });
    return {
      skipped: true,
      duplicate: true,
      documentId: String(document._id),
      fileHash,
    };
  }

  document = await KnowledgeDocument.create({
    fileName,
    fileHash,
    sourceType,
    status: "processing",
    sizeBytes: fs.statSync(filePath).size,
    storagePath: filePath,
  });

  await logKnowledgeIngestionEvent({
    documentId: document._id,
    fileName,
    fileHash,
    jobId,
    stage: "ingest",
    status: "started",
    message: "Knowledge document ingestion started.",
    metadata: { sourceType },
  });

  try {
    const { rows, stats } = await buildPdfIndexRowsFromFile(filePath, fileName);
    await KnowledgeChunk.deleteMany({ document: document._id });

    const chunkDocs = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const embedding = await embedTextWithGemini(row.text).catch(() => []);
      chunkDocs.push({
        document: document._id,
        documentHash: fileHash,
        chunkId: `${fileHash}:${row.page}:${index}`,
        fileName,
        page: row.page,
        chunkIndex: index,
        sourceType,
        text: row.text,
        embedding,
        tokenCount: tokenize(row.text).length,
        metadata: {
          sourceReference: `${fileName}#page=${row.page}`,
        },
      });
    }

    if (chunkDocs.length) {
      await KnowledgeChunk.insertMany(chunkDocs, { ordered: false });
    }

    document.status = "completed";
    document.pageCount = stats.pages;
    document.chunkCount = chunkDocs.length;
    document.extractionMode = stats.extractionMode;
    document.lastIngestedAt = new Date();
    document.metadata = {
      ...(document.metadata || {}),
      parseDurationMs: stats.parseDurationMs,
      textChars: stats.textChars,
    };
    await document.save();

    await logKnowledgeIngestionEvent({
      documentId: document._id,
      fileName,
      fileHash,
      jobId,
      stage: "ingest",
      status: "completed",
      message: "Knowledge document ingestion completed.",
      metadata: {
        chunkCount: chunkDocs.length,
        pageCount: stats.pages,
        sourceType,
      },
    });

    recordDocumentProcessingMetric({
      workflow: "knowledge-ingestion",
      extractionMode: stats.extractionMode,
      status: "completed",
      durationMs: Date.now() - startedAt,
      fileSizeBytes: document.sizeBytes,
      pages: stats.pages,
    });

    return {
      skipped: false,
      duplicate: false,
      documentId: String(document._id),
      chunkCount: chunkDocs.length,
      pageCount: stats.pages,
      fileHash,
    };
  } catch (error) {
    document.status = "failed";
    document.lastIngestedAt = new Date();
    document.metadata = {
      ...(document.metadata || {}),
      lastError: error?.message || String(error),
    };
    await document.save();
    await logKnowledgeIngestionEvent({
      documentId: document._id,
      fileName,
      fileHash,
      jobId,
      stage: "ingest",
      status: "failed",
      message: error?.message || "Knowledge document ingestion failed.",
      metadata: { sourceType },
    });
    recordDocumentProcessingMetric({
      workflow: "knowledge-ingestion",
      extractionMode: "native_text",
      status: "failed",
      durationMs: Date.now() - startedAt,
      fileSizeBytes: document.sizeBytes,
      pages: 0,
    });
    throw error;
  }
};

export const retrieveKnowledgeContext = async (query, { topK = KNOWLEDGE_TOP_K, sourceTypes = [] } = {}) => {
  const normalizedQuery = sanitizeString(query);
  if (!normalizedQuery) {
    return {
      context: "",
      sources: [],
      matches: [],
    };
  }

  const filters = { sourceType: sourceTypes.length ? { $in: sourceTypes } : { $exists: true } };
  const chunks = await KnowledgeChunk.find(filters)
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();

  if (!chunks.length) {
    return {
      context: "",
      sources: [],
      matches: [],
    };
  }

  const queryEmbedding = await embedTextWithGemini(normalizedQuery).catch(() => []);
  const ranked = chunks
    .map((chunk) => {
      const semantic = queryEmbedding.length && Array.isArray(chunk.embedding) && chunk.embedding.length
        ? cosineSimilarity(queryEmbedding, chunk.embedding)
        : 0;
      const lexical = lexicalScore(normalizedQuery, chunk.text);
      return {
        ...chunk,
        retrievalScore: Number((semantic * 0.7 + lexical * 0.3).toFixed(4)),
      };
    })
    .filter((chunk) => chunk.retrievalScore > 0)
    .sort((left, right) => right.retrievalScore - left.retrievalScore)
    .slice(0, topK);

  const sources = ranked.map((chunk) => ({
    fileName: chunk.fileName,
    page: chunk.page,
    sourceType: chunk.sourceType,
    score: chunk.retrievalScore,
    sourceReference: chunk.metadata?.sourceReference || `${chunk.fileName}#page=${chunk.page}`,
  }));

  return {
    context: ranked.map((chunk) => `[${chunk.fileName} p.${chunk.page}] ${chunk.text}`).join("\n\n"),
    sources,
    matches: ranked,
  };
};
