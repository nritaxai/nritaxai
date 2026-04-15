import type { HybridMode } from "../services/router.service";
import { GeminiClient } from "./gemini.client";
import { OllamaClient, type OllamaChatMessage } from "./ollama.client";

export type ChatExecutionParams = {
  mode: HybridMode;
  query: string;
  contextText: string;
  citationsText: string;
  systemPrompt: string;
};

export type ChatExecutionResult = {
  answer: string;
  verificationApplied: boolean;
  providerTrail: string[];
};

const GEMMA_UNCERTAINTY_PATTERNS = [
  /i don't know/i,
  /i do not know/i,
  /not enough information/i,
  /insufficient context/i,
  /not sure/i,
];

export const isModelUncertain = (text: string): boolean => {
  return GEMMA_UNCERTAINTY_PATTERNS.some((pattern) => pattern.test(text));
};

export class HybridChatClient {
  private readonly ollamaClient: OllamaClient;
  private readonly geminiClient: GeminiClient;

  constructor() {
    this.ollamaClient = new OllamaClient();
    this.geminiClient = new GeminiClient();
  }

  private buildGemmaMessages(systemPrompt: string, query: string, contextText: string): OllamaChatMessage[] {
    return [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Retrieved context:\n${contextText || "No context retrieved."}\n\nUser question:\n${query}`,
      },
    ];
  }

  private async runGemma(systemPrompt: string, query: string, contextText: string) {
    return this.ollamaClient.chat(this.buildGemmaMessages(systemPrompt, query, contextText), {
      temperature: 0.1,
      numPredict: 700,
      topP: 0.9,
    });
  }

  private async runGemini(systemPrompt: string, prompt: string) {
    return this.geminiClient.generate({
      systemInstruction: systemPrompt,
      prompt,
      temperature: 0.1,
      maxOutputTokens: 900,
    });
  }

  async execute(params: ChatExecutionParams): Promise<ChatExecutionResult> {
    if (params.mode === "GEMINI_DIRECT") {
      const gemini = await this.runGemini(
        params.systemPrompt,
        `Context:\n${params.contextText || "No retrieved context is available."}\n\nQuestion:\n${params.query}`
      );

      return {
        answer: gemini.content,
        verificationApplied: false,
        providerTrail: ["gemini_direct"],
      };
    }

    if (params.mode === "GEMINI_FALLBACK") {
      const gemini = await this.runGemini(
        params.systemPrompt,
        `Use any retrieved context below if it is relevant. If the context is insufficient, say you do not know.\n\nContext:\n${params.contextText || "No context retrieved."}\n\nQuestion:\n${params.query}`
      );

      return {
        answer: gemini.content,
        verificationApplied: false,
        providerTrail: ["gemini_fallback"],
      };
    }

    const gemma = await this.runGemma(params.systemPrompt, params.query, params.contextText);

    if (params.mode === "GEMMA_ONLY") {
      return {
        answer: gemma.content,
        verificationApplied: false,
        providerTrail: ["gemma"],
      };
    }

    try {
      const gemini = await this.runGemini(
        params.systemPrompt,
        `Validate and improve the draft answer below using only the retrieved context and references.\n\nQuestion:\n${params.query}\n\nRetrieved context:\n${params.contextText}\n\nReferences:\n${params.citationsText}\n\nDraft answer from Gemma:\n${gemma.content}`
      );

      return {
        answer: gemini.content,
        verificationApplied: true,
        providerTrail: ["gemma", "gemini_verify"],
      };
    } catch {
      return {
        answer: gemma.content,
        verificationApplied: false,
        providerTrail: ["gemma", "gemini_verify_failed"],
      };
    }
  }
}
