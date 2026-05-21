import type { KnowledgeChunkRecord } from "../db/mongodb";
import type { QueryType } from "./classifier.service";

export type HybridMode =
  | "OPENROUTER_ONLY"
  | "OPENROUTER_WITH_GEMINI_VERIFY"
  | "GEMINI_FALLBACK"
  | "GEMINI_DIRECT"
  | "OLLAMA_DIRECT";

export type RoutingDecision = {
  mode: HybridMode;
  reasons: string[];
};

export type RoutingInput = {
  type: QueryType;
  confidence: number;
  chunks: KnowledgeChunkRecord[];
};

export class RouterService {
  decide(input: RoutingInput): RoutingDecision {
    const ollamaEnabled = String(process.env.HYBRID_OLLAMA_ENABLED || "false").toLowerCase() === "true";

    if (input.type === "EDGE") {
      return { mode: "GEMINI_DIRECT", reasons: ["edge_query"] };
    }

    if (!input.chunks || input.chunks.length === 0) {
      return { mode: "GEMINI_FALLBACK", reasons: ["no_chunks"] };
    }

    if (ollamaEnabled && input.type === "ROUTINE" && input.confidence >= Number(process.env.HYBRID_MIN_CONFIDENCE || 0.7)) {
      return { mode: "OLLAMA_DIRECT", reasons: ["routine_query_local_low_latency"] };
    }

    if (input.type === "COMPLEX") {
      return { mode: "OPENROUTER_WITH_GEMINI_VERIFY", reasons: ["complex_query_requires_verification"] };
    }

    return { mode: "OPENROUTER_ONLY", reasons: ["routine_query_with_good_context"] };
  }
}
