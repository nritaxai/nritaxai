import { HYBRID_DISCLAIMER, HYBRID_SYSTEM_PROMPT, HybridChatClient, isModelUncertain } from "../llm/chat";
import { RagPipeline } from "../rag/pipeline";
import type { RagPipelineResult } from "../rag/pipeline";
import { ClassifierService } from "./classifier.service";
import { RouterService, type HybridMode } from "./router.service";

export type HybridChatRequest = {
  message: string;
  sessionId?: string;
  userId?: string;
};

export type HybridChatResponse = {
  success: boolean;
  answer: string;
  mode: HybridMode;
  classification: "ROUTINE" | "COMPLEX" | "EDGE";
  confidence: number;
  citations: Array<{
    source: string;
    title?: string;
    section?: string;
    page?: number;
    score: number;
  }>;
  disclaimer: string;
  requestId: string;
  latencyMs: number;
  verificationApplied: boolean;
  providerTrail: string[];
  chunkCount: number;
  fallbackReason?: string;
};

type ChatExecution = {
  answer: string;
  verificationApplied: boolean;
  providerTrail: string[];
};

const EMPTY_RAG_RESULT: RagPipelineResult = {
  contextText: "",
  citations: [],
  confidence: 0,
  chunkCount: 0,
  hasSufficientContext: false,
  queryEmbedding: [],
};

const createRequestId = () => {
  return `hyb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const buildCitationsText = (
  citations: HybridChatResponse["citations"]
): string => {
  return citations
    .map((citation, index) => {
      const title = citation.title ? ` | Title: ${citation.title}` : "";
      const section = citation.section ? ` | Section: ${citation.section}` : "";
      const page = typeof citation.page === "number" ? ` | Page: ${String(citation.page)}` : "";
      return `${index + 1}. ${citation.source}${title}${section}${page} | Score: ${citation.score}`;
    })
    .join("\n");
};

export class ChatService {
  private readonly classifierService: ClassifierService;
  private readonly ragPipeline: RagPipeline;
  private readonly routerService: RouterService;
  private readonly chatClient: HybridChatClient;

  constructor() {
    this.classifierService = new ClassifierService();
    this.ragPipeline = new RagPipeline();
    this.routerService = new RouterService();
    this.chatClient = new HybridChatClient();
  }

  private logRoute(message: string, route: string, confidence: number, fallback: boolean) {
    console.log({
      query: message,
      route,
      confidence,
      fallback,
    });
  }

  private async runGeminiFallback(message: string, ragResult: RagPipelineResult): Promise<ChatExecution> {
    const answer = await this.chatClient.generateWithGemini(
      HYBRID_SYSTEM_PROMPT,
      `Use any retrieved context below if it is relevant. If the context is insufficient, say "I don't know."

Context:
${ragResult.contextText || "No context retrieved."}

References:
${buildCitationsText(ragResult.citations)}

Question:
${message}`
    );

    return {
      answer,
      verificationApplied: false,
      providerTrail: ["gemini_fallback"],
    };
  }

  private async verifyWithGemini(
    message: string,
    ragResult: RagPipelineResult,
    answer: string
  ): Promise<ChatExecution> {
    const improvedAnswer = await this.chatClient.verifyWithGemini(
      HYBRID_SYSTEM_PROMPT,
      message,
      ragResult.contextText,
      buildCitationsText(ragResult.citations),
      answer
    );

    return {
      answer: improvedAnswer,
      verificationApplied: true,
      providerTrail: ["gemma", "gemini_verify"],
    };
  }

  async handleChat(input: HybridChatRequest): Promise<HybridChatResponse> {
    const startedAt = Date.now();
    const requestId = createRequestId();
    const message = String(input.message || "").trim();

    if (!message) {
      throw new Error("Message is required");
    }

    const classification = this.classifierService.classify(message);

    let ragResult: RagPipelineResult = EMPTY_RAG_RESULT;

    if (classification.type !== "EDGE") {
      try {
        ragResult = await this.ragPipeline.run(message);
      } catch {
        ragResult = EMPTY_RAG_RESULT;
      }
    }

    let routing = this.routerService.decide({
      queryType: classification.type,
      retrievalConfidence: ragResult.confidence,
      chunkCount: ragResult.chunkCount,
    });

    this.logRoute(
      message,
      routing.mode,
      ragResult.confidence,
      routing.mode === "GEMINI_FALLBACK" || routing.mode === "GEMINI_DIRECT"
    );

    let execution: ChatExecution;

    try {
      if (routing.mode === "GEMINI_DIRECT") {
        execution = await this.chatClient.execute({
          mode: "GEMINI_DIRECT",
          query: message,
          contextText: ragResult.contextText,
          citationsText: buildCitationsText(ragResult.citations),
          systemPrompt: HYBRID_SYSTEM_PROMPT,
        });
      } else if (routing.mode === "GEMINI_FALLBACK") {
        execution = await this.runGeminiFallback(message, ragResult);
      } else {
        const gemmaAnswer = await this.chatClient.generateWithGemma(
          HYBRID_SYSTEM_PROMPT,
          message,
          ragResult.contextText
        );

        if (isModelUncertain(gemmaAnswer)) {
          routing = { mode: "GEMINI_FALLBACK", reasons: ["gemma_uncertain"] };
          this.logRoute(message, routing.mode, ragResult.confidence, true);
          execution = await this.runGeminiFallback(message, ragResult);
        } else if (routing.mode === "GEMMA_WITH_GEMINI_VERIFY") {
          execution = await this.verifyWithGemini(message, ragResult, gemmaAnswer);
        } else {
          execution = {
            answer: gemmaAnswer,
            verificationApplied: false,
            providerTrail: ["gemma"],
          };
        }
      }
    } catch (error) {
      if (routing.mode === "GEMMA_ONLY" || routing.mode === "GEMMA_WITH_GEMINI_VERIFY") {
        routing = { mode: "GEMINI_FALLBACK", reasons: ["gemma_failed"] };
        this.logRoute(message, routing.mode, ragResult.confidence, true);

        try {
          execution = await this.runGeminiFallback(message, ragResult);
        } catch (fallbackError) {
          throw new Error(
            fallbackError instanceof Error ? fallbackError.message : "Hybrid providers are currently unavailable"
          );
        }
      } else {
        throw new Error(error instanceof Error ? error.message : "Hybrid providers are currently unavailable");
      }
    }

    return {
      success: true,
      answer: execution.answer,
      mode: routing.mode,
      classification: classification.type,
      confidence: ragResult.confidence,
      citations: ragResult.citations,
      disclaimer: HYBRID_DISCLAIMER,
      requestId,
      latencyMs: Date.now() - startedAt,
      verificationApplied: execution.verificationApplied,
      providerTrail: execution.providerTrail,
      chunkCount: ragResult.chunkCount,
      fallbackReason: routing.reasons[0],
    };
  }
}
