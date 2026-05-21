import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";

const STORAGE_DIR = path.resolve("storage");
const PDF_DIR = path.join(STORAGE_DIR, "pdfs");
const INDEX_PATH = path.join(STORAGE_DIR, "pdf_index.json");

export const ensurePdfStorage = () => {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_PATH)) fs.writeFileSync(INDEX_PATH, JSON.stringify([], null, 2), "utf8");
};

export const getPdfDir = () => PDF_DIR;

export const getPdfIndexPath = () => INDEX_PATH;

export const sanitizePdfFilename = (name = "") =>
  path
    .basename(name)
    .replace(/[^\w.\- ]/g, "_")
    .trim();

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

export const savePdfIndex = (rows) => {
  ensurePdfStorage();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(rows, null, 2), "utf8");
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

export const indexPdfBuffer = async (buffer, fileName) => {
  const pageTexts = await extractPageTexts(buffer);
  const rows = [];

  pageTexts.forEach(({ page, text }) => {
    const chunks = chunkText(text);
    chunks.forEach((chunk, i) => {
      rows.push({
        id: `${fileName}-${page}-${i}`,
        file: fileName,
        page,
        text: chunk,
      });
    });
  });

  return rows;
};

export const indexStoredPdfByName = async (fileName) => {
  ensurePdfStorage();
  const targetPath = path.join(PDF_DIR, fileName);
  const buffer = fs.readFileSync(targetPath);
  const fileRows = await indexPdfBuffer(buffer, fileName);
  const nextIndex = loadPdfIndex().filter((row) => row.file !== fileName);
  nextIndex.push(...fileRows);
  savePdfIndex(nextIndex);

  return {
    file: fileName,
    chunks: fileRows.length,
  };
};

export const rebuildPdfIndex = async () => {
  ensurePdfStorage();

  const pdfFiles = fs
    .readdirSync(PDF_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => entry.name)
    .sort();

  const rebuiltIndex = [];
  const fileStats = [];

  for (const fileName of pdfFiles) {
    const absPath = path.join(PDF_DIR, fileName);
    const buffer = fs.readFileSync(absPath);
    const rows = await indexPdfBuffer(buffer, fileName);
    rebuiltIndex.push(...rows);
    fileStats.push({ file: fileName, chunks: rows.length });
  }

  savePdfIndex(rebuiltIndex);
  return { files: fileStats, totalChunks: rebuiltIndex.length, totalFiles: pdfFiles.length };
};
