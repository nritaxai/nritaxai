export type QueryType = "ROUTINE" | "COMPLEX" | "EDGE";

export type QueryClassification = {
  type: QueryType;
  reasons: string[];
};

const EDGE_PATTERNS = [
  /\bcriminal\b/i,
  /\bprosecution\b/i,
  /\braid\b/i,
  /\blitigation\b/i,
  /\bnotice under\b/i,
  /\brepresent me\b/i,
  /\bwhich loophole\b/i,
];

const COMPLEX_PATTERNS = [
  /\bcompare\b/i,
  /\bversus\b/i,
  /\bvs\b/i,
  /\bdtaa\b/i,
  /\btie[- ]?breaker\b/i,
  /\bif\b.+\bthen\b/i,
  /\bmultiple\b/i,
  /\bcapital gains\b/i,
  /\bset[- ]?off\b/i,
  /\bcarry forward\b/i,
];

export class ClassifierService {
  classify(query: string): QueryClassification {
    const normalizedQuery = query.replace(/\s+/g, " ").trim();
    const reasons: string[] = [];

    if (EDGE_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
      reasons.push("high_risk_terms_detected");
      return { type: "EDGE", reasons };
    }

    const questionMarkCount = (normalizedQuery.match(/\?/g) || []).length;
    if (questionMarkCount > 1) {
      reasons.push("multiple_question_branches");
    }

    if (COMPLEX_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
      reasons.push("complex_reasoning_terms_detected");
    }

    if (normalizedQuery.length > 220) {
      reasons.push("long_query");
    }

    if (reasons.length > 0) {
      return { type: "COMPLEX", reasons };
    }

    return {
      type: "ROUTINE",
      reasons: ["direct_factual_query"],
    };
  }
}
