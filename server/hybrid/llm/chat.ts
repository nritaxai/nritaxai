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

export const HYBRID_DISCLAIMER =
  "This response is for general informational purposes only and is not legal or tax advice. Please consult a qualified tax professional for advice on your specific facts.";

export const HYBRID_SYSTEM_PROMPT = `You are a legal-tax assistant specializing in Indian income tax law for nritax.ai.

CORE INSTRUCTIONS:
- Answer ONLY using the provided context
- Include applicable tax or legal references (e.g., sections, rules) from the context whenever available
- Do NOT hallucinate facts, rates, sections, case law, or interpretations

TAX REFERENCE ACCURACY:
- For DTAA (Double Taxation Avoidance Agreement) cases: Consider Section 90 of the Income Tax Act
- For non-DTAA cases: Consider Section 91 of the Income Tax Act
- Foreign Tax Credit (FTC): Can be claimed under BOTH:
  * Section 90 (where DTAA applies)
  * Section 91 (where treaty relief is available or non-treaty jurisdictions)
- Clarify the applicable section(s) when providing tax guidance

RESPONSE STANDARDS:
- Use precise language; avoid absolute statements unless legally established
- When multiple interpretations exist in context, present the established view
- For complex cases, mention that professional consultation is necessary
- Never state FTC is "only" available under one section
- Include relevant section numbers and cite context sources

UNCERTAINTY HANDLING:
- If context is insufficient to answer accurately, say "I don't know" or "Based on the available context, I cannot provide a definitive answer"
- Avoid speculation about tax implications not covered in context
- Always include this disclaimer at the end: ${HYBRID_DISCLAIMER}`;

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

  async generateWithGemma(systemPrompt: string, query: string, contextText: string): Promise<string> {
    try {
      const result = await this.ollamaClient.chat(this.buildGemmaMessages(systemPrompt, query, contextText), {
        temperature: 0.1,
        numPredict: 700,
        topP: 0.9,
      });

      return result.content;
    } catch (error) {
      throw new Error(
        `Gemma generation failed: ${error instanceof Error ? error.message : "Unknown Ollama error"}`
      );
    }
  }

  async generateWithGemini(systemPrompt: string, prompt: string): Promise<string> {
    try {
      const result = await this.geminiClient.generate({
        systemInstruction: systemPrompt,
        prompt,
        temperature: 0.1,
        maxOutputTokens: 900,
      });

      return result.content;
    } catch (error) {
      throw new Error(
        `Gemini generation failed: ${error instanceof Error ? error.message : "Unknown Gemini error"}`
      );
    }
  }

  async verifyWithGemini(
    systemPrompt: string,
    query: string,
    contextText: string,
    citationsText: string,
    answer: string
  ): Promise<string> {
    return this.generateWithGemini(
      systemPrompt,
      `Validate and improve the draft answer below using only the retrieved context and references.

Question:
${query}

Retrieved context:
${contextText}

References:
${citationsText}

Draft answer from Gemma:
${answer}`
    );
  }

  async execute(params: ChatExecutionParams): Promise<ChatExecutionResult> {
    if (params.mode === "GEMINI_DIRECT") {
      const answer = await this.generateWithGemini(
        params.systemPrompt,
        `Context:\n${params.contextText || "No retrieved context is available."}\n\nQuestion:\n${params.query}`
      );

      return {
        answer,
        verificationApplied: false,
        providerTrail: ["gemini_direct"],
      };
    }

    if (params.mode === "GEMINI_FALLBACK") {
      const answer = await this.generateWithGemini(
        params.systemPrompt,
        `Use any retrieved context below if it is relevant. If the context is insufficient, say "I don't know."\n\nContext:\n${params.contextText || "No context retrieved."}\n\nQuestion:\n${params.query}`
      );

      return {
        answer,
        verificationApplied: false,
        providerTrail: ["gemini_fallback"],
      };
    }

    const answer = await this.generateWithGemma(params.systemPrompt, params.query, params.contextText);

    if (params.mode === "GEMMA_ONLY") {
      return {
        answer,
        verificationApplied: false,
        providerTrail: ["gemma"],
      };
    }

    const verifiedAnswer = await this.verifyWithGemini(
      params.systemPrompt,
      params.query,
      params.contextText,
      params.citationsText,
      answer
    );

    return {
      answer: verifiedAnswer,
      verificationApplied: true,
      providerTrail: ["gemma", "gemini_verify"],
    };
  }
}
