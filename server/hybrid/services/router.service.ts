import type { QueryType } from "./classifier.service";

export type HybridMode =
  | "GEMMA_ONLY"
  | "GEMMA_WITH_GEMINI_VERIFY"
  | "GEMINI_FALLBACK"
  | "GEMINI_DIRECT";

export type RoutingDecision = {
  mode: HybridMode;
  reasons: string[];
};

export type RoutingInput = {
  queryType: QueryType;
  retrievalConfidence: number;
  chunkCount: number;
};

export class RouterService {
  decide(input: RoutingInput): RoutingDecision {
    if (input.queryType === "EDGE") {
      return { mode: "GEMINI_DIRECT", reasons: ["edge_query"] };
    }

    if (input.chunkCount === 0) {
      return { mode: "GEMINI_FALLBACK", reasons: ["no_chunks"] };
    }

    if (input.retrievalConfidence < 0.7) {
      return { mode: "GEMINI_FALLBACK", reasons: ["low_retrieval_confidence"] };
    }

    if (input.queryType === "COMPLEX") {
      return { mode: "GEMMA_WITH_GEMINI_VERIFY", reasons: ["complex_query_requires_verification"] };
    }

    return { mode: "GEMMA_ONLY", reasons: ["routine_query_with_good_context"] };
  }
}
