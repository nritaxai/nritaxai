const sanitizeText = (value = "") => String(value || "").trim();

const FAQ_PATTERNS = [
  /\b(price|pricing|plan|plans|refund|invoice|subscription|cancel subscription)\b/i,
  /\bwhat is dtaa\b/i,
  /\bwhat is nri\b/i,
  /\bwhat is trc\b/i,
  /\bwhat is form 10f\b/i,
];

const COMPLEX_PATTERNS = [
  /\bcompare\b/i,
  /\bversus\b/i,
  /\bvs\b/i,
  /\btie[- ]?breaker\b/i,
  /\bforeign tax credit\b/i,
  /\bcarry forward\b/i,
  /\bset[- ]?off\b/i,
  /\bmultiple countries?\b/i,
  /\bdual residenc(y|e)\b/i,
];

const RAG_PATTERNS = [
  /\bdtaa\b/i,
  /\barticle\s+\d+[a-z]?\b/i,
  /\bsection\s+\d+[a-z]?\b/i,
  /\bform 10f\b/i,
  /\btrc\b/i,
  /\bwithholding\b/i,
  /\btds\b/i,
];

export const classifyTaxQuery = (query = "") => {
  const normalizedQuery = sanitizeText(query);
  const reasons = [];

  if (!normalizedQuery) {
    return {
      route: "FAQ",
      confidence: 0.35,
      reasons: ["empty_query"],
    };
  }

  if (FAQ_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
    reasons.push("faq_pattern_match");
    return {
      route: "FAQ",
      confidence: 0.88,
      reasons,
    };
  }

  if (COMPLEX_PATTERNS.some((pattern) => pattern.test(normalizedQuery)) || normalizedQuery.length > 280) {
    reasons.push("complex_pattern_match");
    return {
      route: "COMPLEX",
      confidence: 0.81,
      reasons,
    };
  }

  if (RAG_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
    reasons.push("grounding_pattern_match");
    return {
      route: "RAG",
      confidence: 0.84,
      reasons,
    };
  }

  return {
    route: "RAG",
    confidence: 0.62,
    reasons: ["default_tax_grounding_path"],
  };
};
