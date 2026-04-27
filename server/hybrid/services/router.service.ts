import type { KnowledgeChunkRecord } from "../db/mongodb";
import type { QueryType } from "./classifier.service";

export type HybridMode =
  | "OPENROUTER_ONLY"
  | "OPENROUTER_WITH_GEMINI_VERIFY"
  | "GEMINI_FALLBACK"
  | "GEMINI_DIRECT";

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
    if (input.type === "EDGE") {
      return { mode: "GEMINI_DIRECT", reasons: ["edge_query"] };
    }

    if (!input.chunks || input.chunks.length === 0) {
      return { mode: "GEMINI_FALLBACK", reasons: ["no_chunks"] };
    }

    if (input.type === "COMPLEX") {
      return { mode: "OPENROUTER_WITH_GEMINI_VERIFY", reasons: ["complex_query_requires_verification"] };
    }

    return { mode: "OPENROUTER_ONLY", reasons: ["routine_query_with_good_context"] };
  }
}
