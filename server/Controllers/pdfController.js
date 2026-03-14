import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const STORAGE_DIR = path.resolve("storage");
const PDF_DIR = path.join(STORAGE_DIR, "pdfs");
const INDEX_PATH = path.join(STORAGE_DIR, "pdf_index.json");
const TOP_K = 5;
const MIN_SCORE = 2;

const SYSTEM_PROMPT = `
You are a PDF QA assistant.
Answer ONLY from the provided CONTEXT.
If the answer is missing or unclear in CONTEXT, reply exactly:
"I don't know based on the provided PDFs."
Do not use outside knowledge.
Always cite sources like [file.pdf p.12].
`;

const ensureStorage = () => {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_PATH)) fs.writeFileSync(INDEX_PATH, JSON.stringify([], null, 2), "utf8");
};

const loadIndex = () => {
  ensureStorage();
  try {
    const raw = fs.readFileSync(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveIndex = (rows) => {
  ensureStorage();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(rows, null, 2), "utf8");
};

const sanitizeFilename = (name = "") =>
  path
    .basename(name)
    .replace(/[^\w.\- ]/g, "_")
    .trim();

const tokenize = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

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

const indexPdfBuffer = async (buffer, fileName) => {
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

const rebuildIndexFromStoredPdfs = async () => {
  ensureStorage();

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

  saveIndex(rebuiltIndex);
  return { files: fileStats, totalChunks: rebuiltIndex.length, totalFiles: pdfFiles.length };
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
    ensureStorage();
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    let index = loadIndex();
    const result = [];
    let totalChunks = 0;

    for (const file of files) {
      const safeName = sanitizeFilename(file.originalname);
      if (!safeName.toLowerCase().endsWith(".pdf")) {
        result.push({ file: file.originalname, status: "skipped (not pdf)" });
        continue;
      }

      const targetPath = path.join(PDF_DIR, safeName);
      fs.writeFileSync(targetPath, file.buffer);

      index = index.filter((row) => row.file !== safeName);
      const fileRows = await indexPdfBuffer(file.buffer, safeName);
      const fileChunkCount = fileRows.length;
      index.push(...fileRows);

      totalChunks += fileChunkCount;
      result.push({ file: safeName, status: "indexed", chunks: fileChunkCount });
    }

    saveIndex(index);
    return res.status(200).json({ files: result, totalNewChunks: totalChunks });
  } catch (error) {
    console.error("uploadPdfs error:", error);
    return res.status(500).json({ error: "Failed to upload PDFs." });
  }
};

export const reindexPdfs = async (_req, res) => {
  try {
    const result = await rebuildIndexFromStoredPdfs();
    return res.status(200).json({
      message: "PDF index rebuilt successfully.",
      ...result,
    });
  } catch (error) {
    console.error("reindexPdfs error:", error);
    return res.status(500).json({ error: "Failed to rebuild PDF index." });
  }
};

export const listPdfs = (_req, res) => {
  try {
    ensureStorage();
    const files = fs
      .readdirSync(PDF_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
      .map((entry) => entry.name)
      .sort();

    const index = loadIndex();
    const chunkCountByFile = index.reduce((acc, row) => {
      acc[row.file] = (acc[row.file] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      count: files.length,
      files: files.map((file) => ({ name: file, chunks: chunkCountByFile[file] || 0 })),
    });
  } catch (error) {
    console.error("listPdfs error:", error);
    return res.status(500).json({ error: "Failed to list PDFs." });
  }
};

export const deletePdf = (req, res) => {
  try {
    ensureStorage();
    const rawName = req.params.name || "";
    const safeName = sanitizeFilename(rawName);

    if (!safeName.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({ error: "Only .pdf files are supported." });
    }

    const targetPath = path.join(PDF_DIR, safeName);
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: "PDF not found." });
    }

    fs.unlinkSync(targetPath);
    const index = loadIndex().filter((row) => row.file !== safeName);
    saveIndex(index);

    return res.status(200).json({ deleted: safeName });
  } catch (error) {
    console.error("deletePdf error:", error);
    return res.status(500).json({ error: "Failed to delete PDF." });
  }
};

export const askPdf = async (req, res) => {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) {
      return res.status(400).json({ error: "Question is required." });
    }

    const index = loadIndex();
    const matches = searchChunks(question, index);

    if (!matches.length || matches[0].score < MIN_SCORE) {
      return res.status(200).json({ answer: "I don't know based on the provided PDFs." });
    }

    const context = matches.map((m) => `[${m.file} p.${m.page}] ${m.text}`).join("\n\n");

    const response = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",
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
    return res.status(200).json({
      answer: answer || "I don't know based on the provided PDFs.",
    });
  } catch (error) {
    console.error("askPdf error:", error);
    return res.status(500).json({ error: "Failed to answer from PDFs." });
  }
};
