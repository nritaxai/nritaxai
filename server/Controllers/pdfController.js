import fs from "fs";
import OpenAI from "openai";
import { getAsyncJobAuditByJobId } from "../services/asyncJobAudit.js";
import {
  createPdfUploadManifest,
  ensureDocumentProcessingStorage,
  getPdfAbsolutePath,
} from "../services/documentProcessingService.js";
import {
  ensurePdfStorage,
  getPdfDir,
  loadPdfIndex,
  sanitizePdfFilename,
  savePdfIndex,
} from "../services/pdfIndexService.js";
import { listKnowledgeDocuments, listKnowledgeIngestionLogs } from "../services/knowledgeBaseService.js";
import { logControllerError, respondLegacyError, respondOk } from "../services/controllerResponses.js";
import { enqueuePdfIndexJob, enqueuePdfReindexJob } from "../services/queueFacade.js";
import { appConfig } from "../Config/runtimeConfig.js";

const client = appConfig.ai.openRouter.apiKey
  ? new OpenAI({
      apiKey: appConfig.ai.openRouter.apiKey,
      baseURL: appConfig.urls.openRouterApiUrl.replace(/\/chat\/completions$/, ""),
    })
  : null;

const getOpenRouterClient = () => {
  if (!client) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }
  return client;
};

const PDF_DIR = getPdfDir();
const TOP_K = 5;
const MIN_SCORE = 2;
const ALLOWED_SOURCE_TYPES = new Set([
  "dtaa_pdf",
  "tax_law",
  "fema_doc",
  "tds_rule",
  "capital_gains",
  "nri_compliance",
  "other_pdf",
]);

const SYSTEM_PROMPT = `
You are a PDF QA assistant.
Answer ONLY from the provided CONTEXT.
If the answer is missing or unclear in CONTEXT, reply exactly:
"I don't know based on the provided PDFs."
Do not use outside knowledge.
Always cite sources like [file.pdf p.12].
`;

const tokenize = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

const searchChunks = (question, chunks) => {
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
      if (chunkTokens.length > 0) score += overlap / Math.sqrt(chunkTokens.length);

      return { ...chunk, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, TOP_K);
};

export const uploadPdfs = async (req, res) => {
  try {
    ensureDocumentProcessingStorage();
    const files = req.files || [];
    const requestedSourceType = String(req.body?.sourceType || "other_pdf").trim();
    const sourceType = ALLOWED_SOURCE_TYPES.has(requestedSourceType) ? requestedSourceType : "other_pdf";
    const sourceUrl = String(req.body?.sourceUrl || "").trim();
    const documentTitle = String(req.body?.documentTitle || "").trim();
    const policyTags = Array.isArray(req.body?.policyTags)
      ? req.body.policyTags
      : String(req.body?.policyTags || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

    if (!files.length) {
      return respondLegacyError(res, 400, "No files uploaded.");
    }

    const result = [];

    for (const file of files) {
      const manifest = createPdfUploadManifest({
        file,
        requestedBy: req.user?._id || req.user?.id || "",
        requestId: req.requestId || "",
        sourceType,
        sourceUrl,
        policyTags,
        documentTitle,
      });
      const job = await enqueuePdfIndexJob({
        fileName: manifest.safeName,
        uploadId: manifest.uploadId,
        requestedBy: req.user?._id || req.user?.id || "",
      });

      if (job.inline && job.result) {
        result.push({
          file: manifest.safeName,
          uploadId: manifest.uploadId,
          status: "indexed",
          chunks: job.result.chunks,
          queued: false,
        });
      } else {
        result.push({
          file: manifest.safeName,
          uploadId: manifest.uploadId,
          status: "queued",
          chunks: null,
          queued: true,
          jobId: job.jobId,
        });
      }
    }
    return respondOk(res, {
      files: result,
      queued: result.some((item) => item.queued),
      sourceType,
      sourceUrl,
      policyTags,
    });
  } catch (error) {
    logControllerError("pdf.upload", error);
    return respondLegacyError(res, 500, "Failed to upload PDFs.");
  }
};

export const reindexPdfs = async (_req, res) => {
  try {
    const job = await enqueuePdfReindexJob();
    if (job.inline && job.result) {
      const result = job.result;
      return respondOk(res, {
        message: "PDF index rebuilt successfully.",
        queued: false,
        ...result,
      });
    }

    return respondOk(res, {
      message: "PDF reindex job queued successfully.",
      queued: true,
      jobId: job.jobId,
    });
  } catch (error) {
    logControllerError("pdf.reindex", error);
    return respondLegacyError(res, 500, "Failed to rebuild PDF index.");
  }
};

export const listPdfs = (_req, res) => {
  try {
    ensurePdfStorage();
    const files = fs
      .readdirSync(PDF_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
      .map((entry) => entry.name)
      .sort();

    const index = loadPdfIndex();
    const chunkCountByFile = index.reduce((acc, row) => {
      acc[row.file] = (acc[row.file] || 0) + 1;
      return acc;
    }, {});

    return respondOk(res, {
      count: files.length,
      files: files.map((file) => ({ name: file, chunks: chunkCountByFile[file] || 0 })),
    });
  } catch (error) {
    logControllerError("pdf.list", error);
    return respondLegacyError(res, 500, "Failed to list PDFs.");
  }
};

export const deletePdf = async (req, res) => {
  try {
    ensurePdfStorage();
    const rawName = req.params.name || "";
    const safeName = sanitizePdfFilename(rawName);

    if (!safeName.toLowerCase().endsWith(".pdf")) {
      return respondLegacyError(res, 400, "Only .pdf files are supported.");
    }

    const targetPath = getPdfAbsolutePath(safeName);
    if (!fs.existsSync(targetPath)) {
      return respondLegacyError(res, 404, "PDF not found.");
    }

    fs.unlinkSync(targetPath);
    const index = loadPdfIndex().filter((row) => row.file !== safeName);
    await savePdfIndex(index);

    return respondOk(res, { deleted: safeName });
  } catch (error) {
    logControllerError("pdf.delete", error);
    return respondLegacyError(res, 500, "Failed to delete PDF.");
  }
};

export const getPdfJobStatus = async (req, res) => {
  try {
    const jobId = String(req.params.jobId || "").trim();
    if (!jobId) {
      return respondLegacyError(res, 400, "Job id is required.");
    }

    const job = await getAsyncJobAuditByJobId(jobId);
    if (!job) {
      return respondLegacyError(res, 404, "Job not found.");
    }

    return respondOk(res, {
      jobId: job.jobId,
      queueName: job.queueName,
      jobName: job.jobName,
      status: job.status,
      progressPct: job.progressPct,
      statusMessage: job.statusMessage,
      resourceType: job.resourceType,
      resourceId: job.resourceId,
      attemptsMade: job.attemptsMade,
      payloadSummary: job.payloadSummary,
      resultSummary: job.resultSummary,
      lastError: job.lastError,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    logControllerError("pdf.jobStatus", error);
    return respondLegacyError(res, 500, "Failed to fetch job status.");
  }
};

export const getKnowledgeBaseDocuments = async (req, res) => {
  try {
    const data = await listKnowledgeDocuments({
      sourceType: req.query?.sourceType || "",
      status: req.query?.status || "",
      limit: req.query?.limit || 100,
    });
    return respondOk(res, {
      count: data.length,
      documents: data,
    });
  } catch (error) {
    logControllerError("knowledge.documents", error);
    return respondLegacyError(res, 500, "Failed to load knowledge documents.");
  }
};

export const getKnowledgeIngestionLogs = async (req, res) => {
  try {
    const data = await listKnowledgeIngestionLogs({
      fileHash: req.query?.fileHash || "",
      jobId: req.query?.jobId || "",
      limit: req.query?.limit || 100,
    });
    return respondOk(res, {
      count: data.length,
      logs: data,
    });
  } catch (error) {
    logControllerError("knowledge.logs", error);
    return respondLegacyError(res, 500, "Failed to load knowledge ingestion logs.");
  }
};

export const askPdf = async (req, res) => {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) {
      return respondLegacyError(res, 400, "Question is required.");
    }

    const index = loadPdfIndex();
    const matches = searchChunks(question, index);

    if (!matches.length || matches[0].score < MIN_SCORE) {
      return respondOk(res, { answer: "I don't know based on the provided PDFs." });
    }

    const context = matches.map((m) => `[${m.file} p.${m.page}] ${m.text}`).join("\n\n");

    const response = await getOpenRouterClient().chat.completions.create({
      model: appConfig.ai.routing.smallModel,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `CONTEXT:\n${context}\n\nQUESTION:\n${question}` },
      ],
    });

    const answer =
      typeof response?.choices?.[0]?.message?.content === "string"
        ? response.choices[0].message.content.trim()
        : "";
    return respondOk(res, {
      answer: answer || "I don't know based on the provided PDFs.",
    });
  } catch (error) {
    logControllerError("pdf.ask", error);
    return respondLegacyError(res, 500, "Failed to answer from PDFs.");
  }
};
