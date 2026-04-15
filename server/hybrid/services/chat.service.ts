import { HybridChatClient, isModelUncertain } from "../llm/chat";
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

const EMPTY_RAG_RESULT: RagPipelineResult = {
  contextText: "",
  citations: [],
  confidence: 0,
  chunkCount: 0,
  hasSufficientContext: false,
  queryEmbedding: [],
};

const DISCLAIMER =
  "This response is for general informational purposes only and is not legal or tax advice. Please consult a qualified tax professional for advice on your specific facts.";

const SYSTEM_PROMPT = `You are a legal-tax assistant for nritax.ai.
Answer ONLY using the retrieved context provided to you.
Include legal or tax references when they are available in the context.
Do not hallucinate facts, rates, sections, or case law.
If the context is insufficient, say "I don't know based on the available documents."
Keep the answer precise, practical, and compliant.
Always end with this disclaimer: ${DISCLAIMER}`;

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

    let execution = await this.chatClient.execute({
      mode: routing.mode,
      query: message,
      contextText: ragResult.contextText,
      citationsText: buildCitationsText(ragResult.citations),
      systemPrompt: SYSTEM_PROMPT,
    });

    if (
      (routing.mode === "GEMMA_ONLY" || routing.mode === "GEMMA_WITH_GEMINI_VERIFY") &&
      isModelUncertain(execution.answer)
    ) {
      routing = this.routerService.decide({
        queryType: classification.type,
        retrievalConfidence: ragResult.confidence,
        chunkCount: ragResult.chunkCount,
        modelUncertain: true,
      });

      execution = await this.chatClient.execute({
        mode: routing.mode,
        query: message,
        contextText: ragResult.contextText,
        citationsText: buildCitationsText(ragResult.citations),
        systemPrompt: SYSTEM_PROMPT,
      });
    }

    return {
      success: true,
      answer: execution.answer,
      mode: routing.mode,
      classification: classification.type,
      confidence: ragResult.confidence,
      citations: ragResult.citations,
      disclaimer: DISCLAIMER,
      requestId,
      latencyMs: Date.now() - startedAt,
      verificationApplied: execution.verificationApplied,
      providerTrail: execution.providerTrail,
      chunkCount: ragResult.chunkCount,
      fallbackReason: routing.reasons[0],
    };
  }
}
