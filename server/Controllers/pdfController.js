import fs from "fs";
import path from "path";
import OpenAI from "openai";
import {
  ensurePdfStorage,
  getPdfDir,
  loadPdfIndex,
  sanitizePdfFilename,
  savePdfIndex,
} from "../services/pdfIndexService.js";
import { enqueuePdfIndexJob, enqueuePdfReindexJob } from "../services/queueFacade.js";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const PDF_DIR = getPdfDir();
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
    ensurePdfStorage();
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    const result = [];

    for (const file of files) {
      const safeName = sanitizePdfFilename(file.originalname);
      if (!safeName.toLowerCase().endsWith(".pdf")) {
        result.push({ file: file.originalname, status: "skipped (not pdf)" });
        continue;
      }

      const targetPath = path.join(PDF_DIR, safeName);
      fs.writeFileSync(targetPath, file.buffer);
      const job = await enqueuePdfIndexJob({ fileName: safeName });

      if (job.inline && job.result) {
        result.push({ file: safeName, status: "indexed", chunks: job.result.chunks, queued: false });
      } else {
        result.push({ file: safeName, status: "queued", chunks: null, queued: true, jobId: job.jobId });
      }
    }
    return res.status(200).json({ files: result, queued: result.some((item) => item.queued) });
  } catch (error) {
    console.error("uploadPdfs error:", error);
    return res.status(500).json({ error: "Failed to upload PDFs." });
  }
};

export const reindexPdfs = async (_req, res) => {
  try {
    const job = await enqueuePdfReindexJob();
    if (job.inline && job.result) {
      const result = job.result;
      return res.status(200).json({
        message: "PDF index rebuilt successfully.",
        queued: false,
        ...result,
      });
    }

    return res.status(200).json({
      message: "PDF reindex job queued successfully.",
      queued: true,
      jobId: job.jobId,
    });
  } catch (error) {
    console.error("reindexPdfs error:", error);
    return res.status(500).json({ error: "Failed to rebuild PDF index." });
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
    ensurePdfStorage();
    const rawName = req.params.name || "";
    const safeName = sanitizePdfFilename(rawName);

    if (!safeName.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({ error: "Only .pdf files are supported." });
    }

    const targetPath = path.join(PDF_DIR, safeName);
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: "PDF not found." });
    }

    fs.unlinkSync(targetPath);
    const index = loadPdfIndex().filter((row) => row.file !== safeName);
    savePdfIndex(index);

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

    const index = loadPdfIndex();
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
