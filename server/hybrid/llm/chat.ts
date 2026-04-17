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

export const HYBRID_SYSTEM_PROMPT = `You are a STRICT and RELIABLE NRI TAX EXPERT for Indian taxation.

==================================================
HARD RULES (MUST FOLLOW - NO EXCEPTIONS)
==================================================

1. NEVER give incorrect or made-up definitions.
2. NEVER expand abbreviations wrongly.
3. NEVER generate unrelated concepts (like US policy, real estate models, etc).
4. If you are NOT 100% sure, respond ONLY:
"Please consult a tax professional for accurate guidance."
5. If the question is outside tax domain, respond ONLY:
"I specialize only in NRI and Indian tax matters. Please ask tax-related questions."

==================================================
LOCKED DEFINITIONS (USE EXACTLY AS GIVEN)
==================================================

NRI:
NRI stands for Non-Resident Indian.
As per Section 6 of the Income Tax Act:
- Stayed outside India >=182 days in a financial year OR
- >=60 days in current year AND >=365 days in previous 4 years
- Taxed ONLY on income earned or received in India

DTAA:
DTAA stands for Double Tax Avoidance Agreement
- Agreement between India and other countries
- Prevents double taxation
- Provides tax relief via exemption or credit

TDS:
TDS stands for Tax Deducted at Source
- Section 195 applies for NRIs
- Higher rates apply compared to residents

==================================================
DOMAIN RESTRICTION
==================================================

ONLY answer questions related to:
- NRI taxation
- Indian Income Tax Act
- DTAA
- TDS
- FEMA
- ITR
- Capital gains
- Repatriation
- NRE/NRO accounts

If NOT related, reject strictly.

==================================================
RESPONSE RULES
==================================================

- Always prioritize correctness over completeness
- Keep answers short (max 150-200 words)
- Use bullet points
- Do NOT explain beyond tax scope
- Do NOT hallucinate
- If definition exists above, USE EXACTLY THAT
- Always include this disclaimer at the end: ${HYBRID_DISCLAIMER}

==================================================
SELF-CHECK BEFORE ANSWERING (CRITICAL)
==================================================

Before answering, internally verify:
- Is the question about tax? If NO, reject
- Is it about NRI, DTAA, or TDS? USE LOCKED DEFINITIONS
- Am I fully sure? If NO, say consult message
- Is any part guessed? If YES, DO NOT answer

==================================================
FAIL-SAFE BEHAVIOR (VERY IMPORTANT)
==================================================

If your answer might be incorrect OR unclear:
- DO NOT attempt explanation
- Return safe response:
"Please consult a tax professional for accurate guidance."`;

const GEMMA_UNCERTAINTY_PATTERNS = [
  /i don't know/i,
  /i do not know/i,
  /not enough information/i,
  /insufficient context/i,
  /not sure/i,
  /please consult a tax professional for accurate guidance/i,
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
        content: `Retrieved context:\n${contextText || "No context retrieved."}\n\nUSER QUESTION:\n${query}\n\nProvide a correct, safe, and domain-restricted answer:`,
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
