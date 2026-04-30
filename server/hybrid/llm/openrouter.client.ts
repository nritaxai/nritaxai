type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterChatOptions = {
  temperature?: number;
  maxTokens?: number;
};

type OpenRouterChatResult = {
  content: string;
  raw: unknown;
};

const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-3.5-sonnet";
const DEFAULT_OPENROUTER_TIMEOUT_MS = 20000;
const DEFAULT_REFERER = "https://www.nritax.ai";
const DEFAULT_TITLE = "NRI Tax AI";

const env = (globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
}).process?.env ?? {};

const parseTimeout = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getOpenRouterApiKey = (): string => {
  const apiKey = String(env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing required OpenRouter API key environment variable");
  }

  return apiKey;
};

export class OpenRouterClient {
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly referer: string;
  private readonly title: string;

  constructor() {
    this.model = String(env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL).trim() || DEFAULT_OPENROUTER_MODEL;
    this.timeoutMs = parseTimeout(env.OPENROUTER_TIMEOUT_MS, DEFAULT_OPENROUTER_TIMEOUT_MS);
    this.referer = String(env.OPENROUTER_SITE_URL || DEFAULT_REFERER).trim() || DEFAULT_REFERER;
    this.title = String(env.OPENROUTER_APP_NAME || DEFAULT_TITLE).trim() || DEFAULT_TITLE;
  }

  async chat(messages: OpenRouterChatMessage[], options: OpenRouterChatOptions = {}): Promise<OpenRouterChatResult> {
    const normalizedMessages = messages
      .map((message) => ({
        role: message.role,
        content: String(message.content || "").trim(),
      }))
      .filter((message) => message.content.length > 0);

    if (!normalizedMessages.length) {
      throw new Error("OpenRouter chat requires at least one non-empty message");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getOpenRouterApiKey()}`,
          "Content-Type": "application/json",
          "HTTP-Referer": this.referer,
          "X-Title": this.title,
        },
        body: JSON.stringify({
          model: this.model,
          messages: normalizedMessages,
          temperature: typeof options.temperature === "number" ? options.temperature : 0.3,
          max_tokens: typeof options.maxTokens === "number" ? Math.max(options.maxTokens, 2048) : 2048,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `OpenRouter request failed with status ${response.status}`);
      }

      const json = await response.json();
      const content = String(json?.choices?.[0]?.message?.content || "").trim();

      if (!content) {
        throw new Error("OpenRouter response did not include content");
      }

      return { content, raw: json };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`OpenRouter request timed out after ${this.timeoutMs}ms`);
      }

      throw error instanceof Error ? error : new Error(String(error || "Unknown OpenRouter error"));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export type { OpenRouterChatMessage, OpenRouterChatOptions, OpenRouterChatResult };
