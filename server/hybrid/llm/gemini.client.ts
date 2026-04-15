type GeminiGenerateParams = {
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
};

type GeminiGenerateResult = {
  content: string;
  raw: unknown;
};

const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

const getGeminiApiKey = (): string => {
  const apiKey = String(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ""
  ).trim();

  if (!apiKey) {
    throw new Error("Missing required Gemini API key environment variable");
  }

  return apiKey;
};

const buildGeminiUrl = (model: string) => {
  const apiKey = getGeminiApiKey();
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
};

export class GeminiClient {
  private readonly model: string;

  constructor() {
    this.model = String(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
  }

  async generate(params: GeminiGenerateParams): Promise<GeminiGenerateResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(process.env.HYBRID_GEMINI_TIMEOUT_MS || 2800)
    );

    try {
      const response = await fetch(buildGeminiUrl(this.model), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: params.systemInstruction
            ? {
                parts: [{ text: params.systemInstruction }],
              }
            : undefined,
          contents: [
            {
              role: "user",
              parts: [{ text: params.prompt }],
            },
          ],
          generationConfig: {
            temperature: params.temperature ?? 0.1,
            maxOutputTokens: params.maxOutputTokens ?? 900,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Gemini request failed with status ${response.status}`);
      }

      const json = await response.json();
      const content = String(json?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

      if (!content) {
        throw new Error("Gemini response did not include content");
      }

      return { content, raw: json };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export type { GeminiGenerateParams, GeminiGenerateResult };
