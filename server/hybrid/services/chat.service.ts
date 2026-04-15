import { HYBRID_DISCLAIMER, HYBRID_SYSTEM_PROMPT, HybridChatClient } from "../llm/chat";
import type { KnowledgeChunkRecord } from "../db/mongodb";
import { buildContext } from "../rag/context-builder";
import { HybridRetriever } from "../rag/retriever";
import { OllamaClient } from "../llm/ollama.client";
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

type RetrievalState = {
  chunks: KnowledgeChunkRecord[];
  confidence: number;
};

const EMPTY_RETRIEVAL_RESULT: RetrievalState = {
  chunks: [],
  confidence: 0,
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
  private readonly routerService: RouterService;
  private readonly chatClient: HybridChatClient;
  private readonly ollamaClient: OllamaClient;
  private readonly retriever: HybridRetriever;

  constructor() {
    this.classifierService = new ClassifierService();
    this.routerService = new RouterService();
    this.chatClient = new HybridChatClient();
    this.ollamaClient = new OllamaClient();
    this.retriever = new HybridRetriever();
  }

  private logRoute(
    message: string,
    type: HybridChatResponse["classification"],
    route: string,
    confidence: number,
    chunkCount: number
  ) {
    console.log({
      query: message,
      type,
      route,
      confidence,
      chunkCount,
    });
  }

  private async retrieve(message: string): Promise<RetrievalState> {
    try {
      const embeddingResult = await this.ollamaClient.embed(message);
      return await this.retriever.search(embeddingResult.embedding);
    } catch {
      return EMPTY_RETRIEVAL_RESULT;
    }
  }

  private async runGeminiFallback(
    message: string,
    contextText: string,
    citationsText: string
  ): Promise<ChatExecution> {
    const answer = await this.chatClient.generateWithGemini(
      HYBRID_SYSTEM_PROMPT,
      `Use any retrieved context below if it is relevant. If the context is insufficient, say "I don't know."\n\nContext:\n${contextText || "No context retrieved."}\n\nReferences:\n${citationsText || "No references available."}\n\nQuestion:\n${message}`
    );

    return {
      answer,
      verificationApplied: false,
      providerTrail: ["gemini_fallback"],
    };
  }

  private async verifyWithGemini(
    message: string,
    contextText: string,
    citationsText: string,
    answer: string
  ): Promise<ChatExecution> {
    const improvedAnswer = await this.chatClient.verifyWithGemini(
      HYBRID_SYSTEM_PROMPT,
      message,
      contextText,
      citationsText,
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
    const retrieval = classification.type === "EDGE" ? EMPTY_RETRIEVAL_RESULT : await this.retrieve(message);

    let routing = this.routerService.decide({
      type: classification.type,
      confidence: retrieval.confidence,
      chunks: retrieval.chunks,
    });

    this.logRoute(message, classification.type, routing.mode, retrieval.confidence, retrieval.chunks.length);

    let execution: ChatExecution;
    const builtContext = buildContext(retrieval.chunks, retrieval.confidence);
    const citations = builtContext.citations;
    const citationsText = buildCitationsText(citations);

    try {
      if (routing.mode === "GEMINI_DIRECT") {
        execution = await this.chatClient.execute({
          mode: "GEMINI_DIRECT",
          query: message,
          contextText: "",
          citationsText: "",
          systemPrompt: HYBRID_SYSTEM_PROMPT,
        });
      } else if (routing.mode === "GEMINI_FALLBACK") {
        execution = await this.runGeminiFallback(message, "", "");
      } else {
        const gemmaAnswer = await this.chatClient.generateWithGemma(
          HYBRID_SYSTEM_PROMPT,
          message,
          builtContext.contextText
        );

        if (routing.mode === "GEMMA_WITH_GEMINI_VERIFY") {
          execution = await this.verifyWithGemini(
            message,
            builtContext.contextText,
            citationsText,
            gemmaAnswer
          );
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
        console.error(`HYBRID_SYSTEM_FALLBACK: ${routing.mode} failed`, {
          error: error instanceof Error ? error.message : "Unknown error",
          query: message.substring(0, 100),
          previousRoute: routing.mode,
        });

        routing = { mode: "GEMINI_FALLBACK", reasons: ["gemma_failed"] };
        this.logRoute(message, classification.type, routing.mode, retrieval.confidence, retrieval.chunks.length);

        try {
          execution = await this.runGeminiFallback(
            message,
            builtContext.contextText,
            citationsText
          );
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
      confidence: retrieval.confidence,
      citations,
      disclaimer: HYBRID_DISCLAIMER,
      requestId,
      latencyMs: Date.now() - startedAt,
      verificationApplied: execution.verificationApplied,
      providerTrail: execution.providerTrail,
      chunkCount: retrieval.chunks.length,
      fallbackReason: routing.reasons[0],
    };
  }
}
