import type { HybridMode } from "../services/router.service";
import { HybridProviderClient } from "./provider";

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

export const HYBRID_SYSTEM_PROMPT = `You are an expert AI specializing ONLY in NRI taxation (India + DTAA).

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
STRICT RULES (NON-NEGOTIABLE)
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

1. NEVER invent or guess definitions
2. NEVER hallucinate tax concepts
3. ALWAYS use correct legal meanings
4. If unsure -> say "I don't have confirmed information"
5. Reject non-tax questions

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
CRITICAL DEFINITIONS (SOURCE OF TRUTH)
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

NRI (Non-Resident Indian):
As per Section 6 of Income Tax Act 1961:
- Outside India for 182 days OR
- 60 days + 365 days rule

Tax Rule:
- NRIs are taxed ONLY on India-sourced income

DTAA:
Double Taxation Avoidance Agreement
- Treaty between countries to avoid double taxation

TDS:
Tax Deducted at Source
- Tax collected at the time of payment

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
SELF-CHECK (VERY IMPORTANT)
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Before giving final answer, internally verify:

- Is NRI definition correct? (must match Section 6)
- Is DTAA meaning correct?
- Any fake or unrelated concept added? Remove it
- If anything is incorrect, rewrite the answer

Repeat this internally until the answer is correct.

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
TASK
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Answer the user's question using ONLY the definitions above.

If question is:
- Definition -> give exact meaning
- Tax concept -> explain simply
- Outside scope -> say:
"I specialize only in NRI tax. Please ask tax-related questions."

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
OUTPUT FORMAT (MANDATORY)
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Answer:
[Clear answer]

Legal Basis:
[Section / DTAA reference]

Key Points:
- Point 1
- Point 2
- Point 3

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
FINAL VALIDATION
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

If your answer contains:
- Wrong meaning of NRI
- Wrong meaning of DTAA
- Any invented concept

Discard it and regenerate internally.

Only output FINAL CORRECT answer.

Always include this disclaimer at the end: ${HYBRID_DISCLAIMER}`;

const OPENROUTER_UNCERTAINTY_PATTERNS = [
  /i don't know/i,
  /i do not know/i,
  /not enough information/i,
  /insufficient context/i,
  /not sure/i,
  /please consult a tax professional for accurate guidance/i,
];

export const isModelUncertain = (text: string): boolean => {
  return OPENROUTER_UNCERTAINTY_PATTERNS.some((pattern) => pattern.test(text));
};

export class HybridChatClient {
  private readonly providerClient: HybridProviderClient;

  constructor() {
    this.providerClient = new HybridProviderClient();
  }

  async generateWithOpenRouter(systemPrompt: string, query: string, contextText: string): Promise<string> {
    try {
      const result = await this.providerClient.generateWithOpenRouter(
        systemPrompt,
        `Retrieved context:\n${contextText || "No context retrieved."}\n\nUSER QUESTION:\n${query}\n\nProvide a correct, safe, and domain-restricted answer:`
      );

      return result.content;
    } catch (error) {
      throw new Error(
        `OpenRouter generation failed: ${error instanceof Error ? error.message : "Unknown OpenRouter error"}`
      );
    }
  }

  async generateWithGemini(systemPrompt: string, prompt: string): Promise<string> {
    try {
      const result = await this.providerClient.generateWithGemini(systemPrompt, prompt);
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

Draft answer from OpenRouter:
${answer}`
    );
  }

  async execute(params: ChatExecutionParams): Promise<ChatExecutionResult> {
    if (params.mode === "GEMINI_DIRECT") {
      const answer = await this.generateWithGemini(
        params.systemPrompt,
        `Context:\n${params.contextText || "No retrieved context is available."}\n\nUSER QUESTION:\n${params.query}\n\nProvide a correct, safe, and domain-restricted answer:`
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
        `Use the retrieved context only when it is relevant. If the context is insufficient or you are unsure, respond only with "Please consult a tax professional for accurate guidance."\n\nContext:\n${params.contextText || "No context retrieved."}\n\nUSER QUESTION:\n${params.query}\n\nProvide a correct, safe, and domain-restricted answer:`
      );

      return {
        answer,
        verificationApplied: false,
        providerTrail: ["gemini_fallback"],
      };
    }

    const answer = await this.generateWithOpenRouter(params.systemPrompt, params.query, params.contextText);

    if (params.mode === "OPENROUTER_ONLY") {
      return {
        answer,
        verificationApplied: false,
        providerTrail: ["openrouter"],
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
      providerTrail: ["openrouter", "gemini_verify"],
    };
  }
}
