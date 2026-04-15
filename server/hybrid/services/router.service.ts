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
  modelUncertain?: boolean;
};

export class RouterService {
  decide(input: RoutingInput): RoutingDecision {
    const reasons: string[] = [];
    const minConfidence = Number(process.env.HYBRID_MIN_CONFIDENCE || 0.7);

    if (input.queryType === "EDGE") {
      reasons.push("edge_query");
      return { mode: "GEMINI_DIRECT", reasons };
    }

    if (input.chunkCount === 0) {
      reasons.push("no_chunks");
      return { mode: "GEMINI_FALLBACK", reasons };
    }

    if (input.retrievalConfidence < minConfidence) {
      reasons.push("low_retrieval_confidence");
      return { mode: "GEMINI_FALLBACK", reasons };
    }

    if (input.modelUncertain) {
      reasons.push("gemma_reported_uncertainty");
      return { mode: "GEMINI_FALLBACK", reasons };
    }

    if (input.queryType === "COMPLEX") {
      reasons.push("complex_query_requires_verification");
      return { mode: "GEMMA_WITH_GEMINI_VERIFY", reasons };
    }

    reasons.push("routine_query_with_good_context");
    return { mode: "GEMMA_ONLY", reasons };
  }
}
