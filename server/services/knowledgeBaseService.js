import crypto from "crypto";
import fs from "fs";

import KnowledgeChunk from "../Models/knowledgeChunkModel.js";
import KnowledgeDocument from "../Models/knowledgeDocumentModel.js";
import KnowledgeIngestionLog from "../Models/knowledgeIngestionLogModel.js";
import { buildPdfIndexRowsFromFile } from "./pdfIndexService.js";
import { recordDocumentProcessingMetric } from "./metrics.js";

const GEMINI_EMBED_MODEL = String(process.env.GEMINI_EMBED_MODEL || "text-embedding-004").trim();
const KNOWLEDGE_TOP_K = Math.max(Number(process.env.KNOWLEDGE_BASE_TOP_K || 6), 1);
const KNOWLEDGE_MAX_SCAN = Math.max(Number(process.env.KNOWLEDGE_BASE_MAX_SCAN || 1500), 100);
const KNOWLEDGE_MIN_RETRIEVAL_SCORE = Number(process.env.KNOWLEDGE_MIN_RETRIEVAL_SCORE || 0.08);

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");
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

const parseDocumentMetadata = ({ fileName = "", text = "" } = {}) => {
  const source = `${sanitizeString(fileName)} ${sanitizeString(text).slice(0, 500)}`;
  const upper = source.toUpperCase();
  const countryMatches = Array.from(upper.matchAll(/\b(?:INDIA|USA|US|UNITED STATES|UK|UNITED KINGDOM|UAE|SINGAPORE|CANADA|AUSTRALIA|INDONESIA|MALAYSIA)\b/g)).map(
    (match) => match[0]
  );
  const articleMatch = source.match(/\bArticle\s+(\d+[A-Z]?)\b/i);
  const sectionMatch = source.match(/\bSection\s+(\d+[A-Z]?)\b/i);
  const financialYearMatch = source.match(/\b(?:FY|AY|Financial Year|Assessment Year)\s*[-:]?\s*(\d{4}(?:-\d{2,4})?)\b/i);
  const taxType =
    /\bcapital gains?\b/i.test(source)
      ? "capital_gains"
      : /\bdividend\b/i.test(source)
        ? "dividend"
        : /\binterest\b/i.test(source)
          ? "interest"
          : /\brental?\b/i.test(source)
            ? "rental_income"
            : /\bsalary\b/i.test(source)
              ? "salary"
              : /\btds\b|\bwithholding\b/i.test(source)
                ? "withholding"
                : "general_tax";

  return {
    country: Array.from(new Set(countryMatches)).slice(0, 4),
    article: articleMatch ? articleMatch[1] : "",
    section: sectionMatch ? sectionMatch[1] : "",
    financialYear: financialYearMatch ? financialYearMatch[1] : "",
    taxType,
  };
};

const buildMetadataBoost = (chunk = {}, context = {}) => {
  let boost = 0;
  const chunkCountries = Array.isArray(chunk.metadata?.country) ? chunk.metadata.country : [];
  const currentCountry = sanitizeString(context?.currentCountry).toUpperCase();
  const relevantCountry = sanitizeString(context?.relevantCountry).toUpperCase();
  const financialYear = sanitizeString(context?.financialYear).toUpperCase();
  const incomeType = sanitizeString(context?.incomeType).toLowerCase();

  if (currentCountry && chunkCountries.includes(currentCountry)) boost += 0.12;
  if (relevantCountry && chunkCountries.includes(relevantCountry)) boost += 0.14;
  if (financialYear && sanitizeString(chunk.metadata?.financialYear).toUpperCase() === financialYear) boost += 0.1;
  if (incomeType && sanitizeString(chunk.metadata?.taxType).toLowerCase() === incomeType) boost += 0.08;

  return boost;
};

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
        sourceType: normalizedSourceType,
        text: row.text,
        embedding,
        tokenCount: tokenize(row.text).length,
        metadata: {
          ...parseDocumentMetadata({ fileName, text: row.text }),
          sourceReference: `${fileName}#page=${row.page}`,
          sourceUrl: normalizedSourceUrl,
          policyTags: normalizedPolicyTags,
          documentTitle: normalizedDocumentTitle || fileName,
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
      documentTitle: normalizedDocumentTitle || fileName,
      sourceUrl: normalizedSourceUrl,
      policyTags: normalizedPolicyTags,
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
    };
  }

  const queryEmbedding = await embedTextWithGemini(normalizedQuery).catch(() => []);
  const ranked = chunks
    .map((chunk) => {
      const semantic = queryEmbedding.length && Array.isArray(chunk.embedding) && chunk.embedding.length
        ? cosineSimilarity(queryEmbedding, chunk.embedding)
        : 0;
      const lexical = lexicalScore(normalizedQuery, chunk.text);
      const metadataBoost = buildMetadataBoost(chunk, context);
      return {
        ...chunk,
        retrievalScore: Number((semantic * 0.65 + lexical * 0.25 + metadataBoost).toFixed(4)),
        metadataBoost,
      };
    })
    .filter((chunk) => chunk.retrievalScore >= KNOWLEDGE_MIN_RETRIEVAL_SCORE)
    .sort((left, right) => right.retrievalScore - left.retrievalScore)
    .slice(0, topK);

  const sources = ranked.map((chunk) => ({
    fileName: chunk.fileName,
    page: chunk.page,
    sourceType: chunk.sourceType,
    score: chunk.retrievalScore,
    confidence: Number(Math.min(Math.max(chunk.retrievalScore, 0), 1).toFixed(3)),
    metadata: {
      country: chunk.metadata?.country || [],
      article: chunk.metadata?.article || "",
      section: chunk.metadata?.section || "",
      financialYear: chunk.metadata?.financialYear || "",
      taxType: chunk.metadata?.taxType || "",
    },
    sourceReference: chunk.metadata?.sourceReference || `${chunk.fileName}#page=${chunk.page}`,
  }));

  return {
    context: ranked.map((chunk) => `[${chunk.fileName} p.${chunk.page}] ${chunk.text}`).join("\n\n"),
    sources,
    matches: ranked,
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
