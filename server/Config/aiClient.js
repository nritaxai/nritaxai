import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

export const AI_PROVIDER_NAME = process.env.AI_PROVIDER_NAME || "Alibaba Cloud Model Studio";
export const AI_API_KEY =
  process.env.ALIBABA_CLOUD_API_KEY ||
  process.env.DASHSCOPE_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  "";
export const AI_BASE_URL =
  process.env.ALIBABA_CLOUD_BASE_URL ||
  process.env.DASHSCOPE_BASE_URL ||
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
export const AI_REQUEST_TIMEOUT_MS = Number(
  process.env.AI_REQUEST_TIMEOUT_MS || process.env.OPENROUTER_TIMEOUT_MS || 12000
);
export const CHAT_MODEL = process.env.CHAT_MODEL || process.env.ALIBABA_CHAT_MODEL || "qwen-plus";
export const PDF_QA_MODEL = process.env.PDF_QA_MODEL || CHAT_MODEL;
export const RAG_EMBEDDING_MODEL =
  process.env.RAG_EMBEDDING_MODEL || process.env.ALIBABA_EMBEDDING_MODEL || "text-embedding-v3";

export const aiClient = new OpenAI({
  apiKey: AI_API_KEY,
  baseURL: AI_BASE_URL,
});

export const extractAiText = (content) => {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (!part) return "";
      if (typeof part === "string") return part;
      if (typeof part.text === "string") return part.text;
      if (typeof part?.text?.value === "string") return part.text.value;
      return "";
    })
    .join("")
    .trim();
};
