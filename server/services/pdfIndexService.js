import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import {
  ensureDocumentProcessingStorage,
  getPdfAbsolutePath,
  getPdfDir,
  getDocumentStorageDir,
  sanitizePdfFilename,
} from "./documentProcessingService.js";
import { chunkTextWithMetadata } from "./knowledgeRetrievalUtils.js";
import { recordDocumentProcessingMetric } from "./metrics.js";

const STORAGE_DIR = getDocumentStorageDir();
const PDF_DIR = getPdfDir();
const INDEX_PATH = path.join(STORAGE_DIR, "pdf_index.json");
const INDEX_LOCK_PATH = path.join(STORAGE_DIR, "pdf_index.lock");

export const ensurePdfStorage = () => {
  ensureDocumentProcessingStorage();
  if (!fs.existsSync(INDEX_PATH)) fs.writeFileSync(INDEX_PATH, JSON.stringify([], null, 2), "utf8");
};

export const getPdfIndexPath = () => INDEX_PATH;
export { getPdfDir, sanitizePdfFilename };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withIndexLock = async (handler) => {
  ensurePdfStorage();
  const timeoutMs = Math.max(Number(process.env.PDF_INDEX_LOCK_TIMEOUT_MS || 15000), 1000);
  const retryMs = Math.max(Number(process.env.PDF_INDEX_LOCK_RETRY_MS || 50), 10);
  const startedAt = Date.now();
  let handle = null;

  while (!handle && Date.now() - startedAt < timeoutMs) {
    try {
      handle = fs.openSync(INDEX_LOCK_PATH, "wx");
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await sleep(retryMs);
    }
  }

  if (!handle) {
    throw new Error("PDF index is busy. Please retry.");
  }

  try {
    return await handler();
  } finally {
    try {
      fs.closeSync(handle);
    } catch {
    }
    if (fs.existsSync(INDEX_LOCK_PATH)) {
      fs.unlinkSync(INDEX_LOCK_PATH);
    }
  }
};

export const loadPdfIndex = () => {
  ensurePdfStorage();
  try {
    const raw = fs.readFileSync(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const savePdfIndex = async (rows) =>
  withIndexLock(async () => {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(rows, null, 2), "utf8");
  });

const chunkText = (text, size = Number(process.env.PDF_CHUNK_SIZE || 900), overlap = Number(process.env.PDF_CHUNK_OVERLAP || 180)) =>
  chunkTextWithMetadata(text, { size, overlap });

export const extractPageTexts = async (buffer) => {
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

export const buildPdfIndexRowsFromFile = async (filePath, fileName) => {
  const startedAt = Date.now();
  const buffer = fs.readFileSync(filePath);
  const pageTexts = await extractPageTexts(buffer);
  const rows = [];
  let totalTextChars = 0;

  pageTexts.forEach(({ page, text }) => {
    totalTextChars += text.length;
    const chunks = chunkText(text);
    chunks.forEach((chunk, index) => {
      rows.push({
        id: `${fileName}-${page}-${index}`,
        file: fileName,
        page,
        text: chunk.text,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        overlapChars: chunk.overlapChars,
        dedupeHash: chunk.dedupeHash,
      });
    });
  });

  const stats = {
    file: fileName,
    chunks: rows.length,
    pages: Math.max(pageTexts.length, 0),
    sizeBytes: buffer.length,
    parseDurationMs: Date.now() - startedAt,
    textChars: totalTextChars,
    extractionMode: totalTextChars > 0 ? "native_text" : "ocr_candidate",
  };

  recordDocumentProcessingMetric({
    workflow: "pdf-index",
    status: "completed",
    fileSizeBytes: stats.sizeBytes,
    durationMs: stats.parseDurationMs,
    pages: stats.pages,
    extractionMode: stats.extractionMode,
  });

  return { rows, stats };
};

export const indexPdfBuffer = async (buffer, fileName) => {
  const pageTexts = await extractPageTexts(buffer);
  const rows = [];

  pageTexts.forEach(({ page, text }) => {
    const chunks = chunkText(text);
    chunks.forEach((chunk, index) => {
      rows.push({
        id: `${fileName}-${page}-${index}`,
        file: fileName,
        page,
        text: chunk.text,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        overlapChars: chunk.overlapChars,
        dedupeHash: chunk.dedupeHash,
      });
    });
  });

  return rows;
};

export const replacePdfIndexRows = async ({ fileName, rows }) =>
  withIndexLock(async () => {
    const nextIndex = loadPdfIndex().filter((row) => row.file !== fileName);
    nextIndex.push(...rows);
    fs.writeFileSync(INDEX_PATH, JSON.stringify(nextIndex, null, 2), "utf8");
    return nextIndex.length;
  });

export const indexStoredPdfByName = async (fileName) => {
  ensurePdfStorage();
  const safeName = sanitizePdfFilename(fileName);
  const targetPath = getPdfAbsolutePath(safeName);
  const { rows, stats } = await buildPdfIndexRowsFromFile(targetPath, safeName);
  await replacePdfIndexRows({ fileName: safeName, rows });

  return {
    file: safeName,
    chunks: rows.length,
    pages: stats.pages,
    sizeBytes: stats.sizeBytes,
    extractionMode: stats.extractionMode,
    parseDurationMs: stats.parseDurationMs,
  };
};

export const rebuildPdfIndex = async () =>
  withIndexLock(async () => {
    ensurePdfStorage();
    const pdfFiles = fs
      .readdirSync(PDF_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
      .map((entry) => entry.name)
      .sort();

    const rebuiltIndex = [];
    const fileStats = [];

    for (const fileName of pdfFiles) {
      const absPath = getPdfAbsolutePath(fileName);
      const { rows, stats } = await buildPdfIndexRowsFromFile(absPath, fileName);
      rebuiltIndex.push(...rows);
      fileStats.push({
        file: fileName,
        chunks: rows.length,
        pages: stats.pages,
        sizeBytes: stats.sizeBytes,
        extractionMode: stats.extractionMode,
        parseDurationMs: stats.parseDurationMs,
      });
    }

    fs.writeFileSync(INDEX_PATH, JSON.stringify(rebuiltIndex, null, 2), "utf8");
    return { files: fileStats, totalChunks: rebuiltIndex.length, totalFiles: pdfFiles.length };
  });
