type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatOptions = {
  temperature?: number;
  numPredict?: number;
  topP?: number;
};

type OllamaChatResult = {
  content: string;
  raw: unknown;
};

type OllamaEmbeddingResult = {
  embedding: number[];
  raw: unknown;
};

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_CHAT_MODEL = "gemma";
const DEFAULT_EMBED_MODEL = "nomic-embed-text";

const resolveBaseUrl = () => {
  return String(process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).trim().replace(/\/+$/, "");
};

const withTimeout = async (input: string, init: Record<string, unknown>, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const parseJsonResponse = async (response: any) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Ollama request failed with status ${response.status}`);
  }

  return response.json();
};

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly chatModel: string;
  private readonly embeddingModel: string;

  constructor() {
    this.baseUrl = resolveBaseUrl();
    this.chatModel = String(process.env.OLLAMA_CHAT_MODEL || DEFAULT_CHAT_MODEL).trim();
    this.embeddingModel = String(process.env.OLLAMA_EMBED_MODEL || DEFAULT_EMBED_MODEL).trim();
  }

  async embed(text: string): Promise<OllamaEmbeddingResult> {
    const response = await withTimeout(
      `${this.baseUrl}/api/embeddings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: text,
        }),
      },
      Number(process.env.HYBRID_OLLAMA_EMBED_TIMEOUT_MS || 1200)
    );

    const json = await parseJsonResponse(response);
    const embedding = Array.isArray(json?.embedding) ? json.embedding.map(Number) : [];

    if (!embedding.length) {
      throw new Error("Ollama embedding response did not include an embedding vector");
    }

    return { embedding, raw: json };
  }

  async chat(messages: OllamaChatMessage[], options: OllamaChatOptions = {}): Promise<OllamaChatResult> {
    const response = await withTimeout(
      `${this.baseUrl}/api/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.chatModel,
          stream: false,
          messages,
          options: {
            temperature: options.temperature ?? 0.1,
            num_predict: options.numPredict ?? 700,
            top_p: options.topP ?? 0.9,
          },
        }),
      },
      Number(process.env.HYBRID_OLLAMA_CHAT_TIMEOUT_MS || 3000)
    );

    const json = await parseJsonResponse(response);
    const content = String(json?.message?.content || "").trim();

    if (!content) {
      throw new Error("Ollama chat response did not include content");
    }

    return { content, raw: json };
  }
}

export type { OllamaChatMessage, OllamaChatOptions, OllamaChatResult, OllamaEmbeddingResult };
