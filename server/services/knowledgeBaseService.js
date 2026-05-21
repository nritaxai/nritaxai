import crypto from "crypto";
import fs from "fs";

import KnowledgeChunk from "../Models/knowledgeChunkModel.js";
import KnowledgeDocument from "../Models/knowledgeDocumentModel.js";
import KnowledgeIngestionLog from "../Models/knowledgeIngestionLogModel.js";
import { buildPdfIndexRowsFromFile } from "./pdfIndexService.js";
import {
  buildContextForPrompt,
  buildMetadataBoost,
  buildRetrievalBreakdown,
  buildSourceAttributions,
  computeChunkConfidence,
  computeRetrievalConfidence,
  computeRetrievalScore,
  cosineSimilarity,
  extractQuerySignals,
  filterDuplicateChunks,
  lexicalScore,
  parseDocumentMetadata,
  sanitizeString,
  tokenize,
} from "./knowledgeRetrievalUtils.js";
import { recordDocumentProcessingMetric } from "./metrics.js";

const GEMINI_EMBED_MODEL = String(process.env.GEMINI_EMBED_MODEL || "text-embedding-004").trim();
const KNOWLEDGE_EMBED_PROVIDER = String(process.env.KNOWLEDGE_EMBED_PROVIDER || "gemini").trim().toLowerCase();
const KNOWLEDGE_EMBED_CONCURRENCY = Math.max(Number(process.env.KNOWLEDGE_EMBED_CONCURRENCY || 4), 1);
const KNOWLEDGE_TOP_K = Math.max(Number(process.env.KNOWLEDGE_BASE_TOP_K || 6), 1);
const KNOWLEDGE_MAX_SCAN = Math.max(Number(process.env.KNOWLEDGE_BASE_MAX_SCAN || 1500), 100);
const KNOWLEDGE_MIN_RETRIEVAL_SCORE = Number(process.env.KNOWLEDGE_MIN_RETRIEVAL_SCORE || 0.08);
const KNOWLEDGE_LOW_CONFIDENCE_THRESHOLD = Number(process.env.KNOWLEDGE_LOW_CONFIDENCE_THRESHOLD || 0.42);

const sha256File = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
const normalizePolicyTags = (value = []) =>
  (Array.isArray(value) ? value : String(value || "").split(","))
    .map((item) => sanitizeString(item))
    .filter(Boolean)
    .slice(0, 20);
const normalizeSourceType = (value = "") => {
  const normalized = sanitizeString(value) || "other_pdf";
  return ["dtaa_pdf", "tax_law", "fema_doc", "tds_rule", "capital_gains", "nri_compliance", "other_pdf"].includes(
    normalized
  )
    ? normalized
    : "other_pdf";
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

const embedText = async (text = "") => {
  if (!sanitizeString(text)) return [];
  if (KNOWLEDGE_EMBED_PROVIDER === "disabled") return [];
  if (KNOWLEDGE_EMBED_PROVIDER === "gemini") {
    return embedTextWithGemini(text);
  }
  throw new Error(`Unsupported knowledge embedding provider: ${KNOWLEDGE_EMBED_PROVIDER}`);
};

const mapWithConcurrency = async (items = [], limit = KNOWLEDGE_EMBED_CONCURRENCY, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
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
  sourceUrl = "",
  policyTags = [],
  documentTitle = "",
  documentMetadata = {},
}) => {
  const startedAt = Date.now();
  const fileHash = sha256File(filePath);
  const normalizedSourceType = normalizeSourceType(sourceType);
  const normalizedPolicyTags = normalizePolicyTags(policyTags);
  const normalizedSourceUrl = sanitizeString(sourceUrl);
  const normalizedDocumentTitle = sanitizeString(documentTitle);
  let document = await KnowledgeDocument.findOne({ fileHash });

  if (document) {
    document.status = "skipped_duplicate";
    document.lastIngestedAt = new Date();
    document.sourceType = document.sourceType || normalizedSourceType;
    document.sourceUrl = document.sourceUrl || normalizedSourceUrl;
    document.policyTags = document.policyTags?.length ? document.policyTags : normalizedPolicyTags;
    await document.save();
    await logKnowledgeIngestionEvent({
      documentId: document._id,
      fileName,
      fileHash,
      jobId,
      stage: "dedupe",
      status: "skipped",
      message: "Skipped duplicate knowledge document based on file hash.",
      metadata: { sourceType: normalizedSourceType, sourceUrl: normalizedSourceUrl, policyTags: normalizedPolicyTags },
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
    sourceType: normalizedSourceType,
    status: "processing",
    sizeBytes: fs.statSync(filePath).size,
    storagePath: filePath,
    sourceUrl: normalizedSourceUrl,
    policyTags: normalizedPolicyTags,
    metadata: {
      documentTitle: normalizedDocumentTitle,
      ...(documentMetadata && typeof documentMetadata === "object" ? documentMetadata : {}),
    },
  });

  await logKnowledgeIngestionEvent({
    documentId: document._id,
    fileName,
    fileHash,
    jobId,
    stage: "ingest",
    status: "started",
    message: "Knowledge document ingestion started.",
    metadata: { sourceType: normalizedSourceType, sourceUrl: normalizedSourceUrl, policyTags: normalizedPolicyTags },
  });

  try {
    const { rows, stats } = await buildPdfIndexRowsFromFile(filePath, fileName);
    await KnowledgeChunk.deleteMany({ document: document._id });
    const dedupedRows = filterDuplicateChunks(rows);
    const chunkDocs = await mapWithConcurrency(dedupedRows.chunks, KNOWLEDGE_EMBED_CONCURRENCY, async (row, index) => {
      const embedding = await embedText(row.text).catch(() => []);
      return {
        document: document._id,
        documentHash: fileHash,
        chunkId: `${fileHash}:${row.page}:${index}`,
        fileName,
        page: row.page,
        chunkIndex: index,
        sourceType: normalizedSourceType,
        text: row.text,
        embedding,
        tokenCount: tokenize(row.text).length,
        startOffset: Number(row.startOffset || 0),
        endOffset: Number(row.endOffset || 0),
        overlapChars: Number(row.overlapChars || 0),
        dedupeHash: sanitizeString(row.dedupeHash),
        metadata: {
          ...parseDocumentMetadata({ fileName, text: row.text }),
          sourceReference: `${fileName}#page=${row.page}`,
          sourceUrl: normalizedSourceUrl,
          policyTags: normalizedPolicyTags,
          documentTitle: normalizedDocumentTitle || fileName,
          embeddingProvider: KNOWLEDGE_EMBED_PROVIDER,
          embeddingModel: GEMINI_EMBED_MODEL,
        },
      };
    });

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
      documentTitle: normalizedDocumentTitle || fileName,
      sourceUrl: normalizedSourceUrl,
      policyTags: normalizedPolicyTags,
      duplicateChunkCount: dedupedRows.duplicateCount,
      ingestionPipeline: "pdf->chunking->embeddings->knowledge-chunks->semantic-retrieval",
      embeddingProvider: KNOWLEDGE_EMBED_PROVIDER,
      embeddingModel: GEMINI_EMBED_MODEL,
      ...(documentMetadata && typeof documentMetadata === "object" ? documentMetadata : {}),
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
        sourceType: normalizedSourceType,
        duplicateChunkCount: dedupedRows.duplicateCount,
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
      metadata: { sourceType: normalizedSourceType, sourceUrl: normalizedSourceUrl, policyTags: normalizedPolicyTags },
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

export const retrieveKnowledgeContext = async (query, { topK = KNOWLEDGE_TOP_K, sourceTypes = [], context = {} } = {}) => {
  const normalizedQuery = sanitizeString(query);
  if (!normalizedQuery) {
    return {
      context: "",
      sources: [],
      matches: [],
      confidence: 0,
      insufficientContext: true,
    };
  }

  const filters = { sourceType: sourceTypes.length ? { $in: sourceTypes } : { $exists: true } };
  const chunks = await KnowledgeChunk.find(filters)
    .sort({ updatedAt: -1 })
    .limit(KNOWLEDGE_MAX_SCAN)
    .lean();

  if (!chunks.length) {
    return {
      context: "",
      sources: [],
      matches: [],
      confidence: 0,
      insufficientContext: true,
    };
  }

  const querySignals = extractQuerySignals(normalizedQuery, context);
  const queryEmbedding = await embedText(normalizedQuery).catch(() => []);
  const ranked = chunks
    .map((chunk) => {
      const semantic = queryEmbedding.length && Array.isArray(chunk.embedding) && chunk.embedding.length
        ? cosineSimilarity(queryEmbedding, chunk.embedding)
        : 0;
      const lexical = lexicalScore(normalizedQuery, chunk.text);
      const metadataBoost = buildMetadataBoost(chunk, querySignals);
      const retrievalScore = computeRetrievalScore({
        semantic,
        lexical,
        metadataBoost,
      });
      const retrievalBreakdown = buildRetrievalBreakdown({
        semantic,
        lexical,
        metadataBoost,
        score: retrievalScore,
      });
      const chunkConfidence = computeChunkConfidence({
        semantic,
        lexical,
        metadataBoost,
        score: retrievalScore,
      });
      return {
        ...chunk,
        retrievalScore,
        retrievalBreakdown,
        chunkConfidence,
        metadataBoost,
      };
    })
    .filter((chunk) => chunk.retrievalScore >= KNOWLEDGE_MIN_RETRIEVAL_SCORE)
    .sort((left, right) => right.retrievalScore - left.retrievalScore)
    .filter((chunk, index, rankedRows) => index === rankedRows.findIndex((row) => row.dedupeHash === chunk.dedupeHash))
    .slice(0, topK);

  const confidence = computeRetrievalConfidence(ranked);
  const sources = buildSourceAttributions(ranked);

  return {
    context: buildContextForPrompt(ranked),
    sources,
    matches: ranked,
    confidence,
    insufficientContext: confidence < KNOWLEDGE_LOW_CONFIDENCE_THRESHOLD || ranked.length === 0,
  };
};

export const listKnowledgeDocuments = async ({ sourceType = "", status = "", limit = 100 } = {}) => {
  const filters = {};
  if (sanitizeString(sourceType)) filters.sourceType = normalizeSourceType(sourceType);
  if (sanitizeString(status)) filters.status = sanitizeString(status);
  return KnowledgeDocument.find(filters)
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(Math.max(Math.min(Number(limit || 100), 250), 1))
    .lean();
};

export const listKnowledgeIngestionLogs = async ({ fileHash = "", jobId = "", limit = 100 } = {}) => {
  const filters = {};
  if (sanitizeString(fileHash)) filters.fileHash = sanitizeString(fileHash);
  if (sanitizeString(jobId)) filters.jobId = sanitizeString(jobId);
  return KnowledgeIngestionLog.find(filters)
    .sort({ createdAt: -1 })
    .limit(Math.max(Math.min(Number(limit || 100), 250), 1))
    .lean();
};
