type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatOptions = {
  temperature?: number;
  maxTokens?: number;
};

type OllamaChatResult = {
  content: string;
  raw: unknown;
};

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b-instruct-q4_K_M";
const DEFAULT_OLLAMA_TIMEOUT_MS = 12000;

const getBaseUrl = (): string =>
  String(process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).trim().replace(/\/+$/, "") || DEFAULT_OLLAMA_BASE_URL;

export class OllamaClient {
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor() {
    this.model = String(process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL).trim() || DEFAULT_OLLAMA_MODEL;
    this.timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || DEFAULT_OLLAMA_TIMEOUT_MS);
  }

  async chat(messages: OllamaChatMessage[], options: OllamaChatOptions = {}): Promise<OllamaChatResult> {
    const normalizedMessages = messages
      .map((message) => ({
        role: message.role,
        content: String(message.content || "").trim(),
      }))
      .filter((message) => message.content.length > 0);

    if (!normalizedMessages.length) {
      throw new Error("Ollama chat requires at least one non-empty message");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${getBaseUrl()}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: normalizedMessages,
          options: {
            temperature: typeof options.temperature === "number" ? options.temperature : 0.2,
            num_predict: typeof options.maxTokens === "number" ? Math.max(options.maxTokens, 512) : 900,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Ollama request failed with status ${response.status}`);
      }

      const json = await response.json();
      const content = String(json?.message?.content || "").trim();
      if (!content) {
        throw new Error("Ollama response did not include content");
      }

      return {
        content,
        raw: json,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Ollama request timed out after ${this.timeoutMs}ms`);
      }
      throw error instanceof Error ? error : new Error(String(error || "Unknown Ollama error"));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export type { OllamaChatMessage, OllamaChatOptions, OllamaChatResult };
