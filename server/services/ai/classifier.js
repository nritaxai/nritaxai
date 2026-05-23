const normalizeText = (value = "") => String(value || "").trim();
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();

const GENERAL_INFO_PATTERNS = [
  /\bwhat is\b/i,
  /\bexplain\b/i,
  /\bmeaning of\b/i,
  /\bdefine\b/i,
];

const COUNTRY_SPECIFIC_PATTERNS = [
  /\bdtaa\b/i,
  /\btreaty\b/i,
  /\bdouble tax/i,
  /\bforeign tax credit\b/i,
  /\btrc\b/i,
  /\bform 10f\b/i,
];

const YEAR_SPECIFIC_PATTERNS = [
  /\bfinancial year\b/i,
  /\bassessment year\b/i,
  /\bfy\s*20\d{2}/i,
  /\bay\s*20\d{2}/i,
  /\bmoved from\b/i,
  /\brelocated from\b/i,
  /\bchanged countr/i,
];

const TAX_FILING_PATTERNS = [
  /\bfile\b.*\bitr\b/i,
  /\bneed to file\b/i,
  /\breturn filing\b/i,
  /\bincome tax return\b/i,
];

const INVESTMENT_PATTERNS = [
  /\bmutual fund\b/i,
  /\bstock\b/i,
  /\bshare\b/i,
  /\bbond\b/i,
  /\binvestment\b/i,
  /\bdividend\b/i,
];

const CAPITAL_GAINS_PATTERNS = [
  /\bcapital gain/i,
  /\bproperty sale\b/i,
  /\bsell(?:ing)? property\b/i,
  /\bsold property\b/i,
  /\bsale of shares?\b/i,
  /\basset sale\b/i,
];

const GST_PATTERNS = [/\bgst\b/i, /\bgst 2\.0\b/i];
const COMPLIANCE_PATTERNS = [/\bfema\b/i, /\bremittance\b/i, /\bcompliance\b/i, /\btds\b/i, /\bwithholding\b/i];
const PERSONALIZATION_PATTERNS = [/\b(i|me|my|mine|we|our|us)\b/i, /\bhelp me\b/i, /\bfor me\b/i, /\bmy case\b/i];

const DIRECT_DEFINITION_PATTERNS = [
  /\bwhat is dtaa\b/i,
  /\bwhat is gst\b/i,
  /\bwhat is gst 2\.0\b/i,
  /\bwhat is trc\b/i,
  /\bwhat is form 10f\b/i,
];

const isDefinitionStyleQuestion = (question = "") =>
  GENERAL_INFO_PATTERNS.some((pattern) => pattern.test(question)) && !PERSONALIZATION_PATTERNS.some((pattern) => pattern.test(question));

export const classifyClarificationQuery = ({ question = "", knowledgeSource = "dtaa" } = {}) => {
  const normalizedQuestion = normalizeText(question);
  const lowerQuestion = normalizeLower(question);
  const reasons = [];

  if (!normalizedQuestion) {
    return {
      category: "OTHER",
      confidence: 0.3,
      reasons: ["empty_question"],
      answerDirectly: true,
    };
  }

  if (DIRECT_DEFINITION_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    reasons.push("direct_definition_pattern");
    return {
      category: /\bgst\b/i.test(normalizedQuestion) ? "GST" : "GENERAL_INFO",
      confidence: 0.95,
      reasons,
      answerDirectly: true,
    };
  }

  if (GST_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    reasons.push("gst_pattern");
    return {
      category: "GST",
      confidence: isDefinitionStyleQuestion(normalizedQuestion) ? 0.91 : 0.78,
      reasons,
      answerDirectly: isDefinitionStyleQuestion(normalizedQuestion),
    };
  }

  if (TAX_FILING_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    reasons.push("tax_filing_pattern");
    return {
      category: "TAX_FILING",
      confidence: 0.9,
      reasons,
      answerDirectly: false,
    };
  }

  if (CAPITAL_GAINS_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    reasons.push("capital_gains_pattern");
    return {
      category: "CAPITAL_GAINS",
      confidence: 0.88,
      reasons,
      answerDirectly: false,
    };
  }

  if (YEAR_SPECIFIC_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    reasons.push("year_specific_pattern");
    return {
      category: "YEAR_SPECIFIC",
      confidence: 0.83,
      reasons,
      answerDirectly: false,
    };
  }

  if (COUNTRY_SPECIFIC_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    reasons.push("country_specific_pattern");
    return {
      category: /\bdtaa|treaty|double tax/i.test(normalizedQuestion) ? "DTAA" : "COUNTRY_SPECIFIC",
      confidence: 0.86,
      reasons,
      answerDirectly: isDefinitionStyleQuestion(normalizedQuestion) && !lowerQuestion.includes("help me"),
    };
  }

  if (INVESTMENT_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    reasons.push("investment_pattern");
    return {
      category: "INVESTMENT",
      confidence: 0.77,
      reasons,
      answerDirectly: false,
    };
  }

  if (COMPLIANCE_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    reasons.push("compliance_pattern");
    return {
      category: "COMPLIANCE",
      confidence: 0.76,
      reasons,
      answerDirectly: false,
    };
  }

  if (knowledgeSource === "dtaa" && isDefinitionStyleQuestion(normalizedQuestion)) {
    reasons.push("knowledge_source_definition_path");
    return {
      category: "GENERAL_INFO",
      confidence: 0.74,
      reasons,
      answerDirectly: true,
    };
  }

  if (PERSONALIZATION_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    reasons.push("personalization_pattern");
    return {
      category: "PERSONALIZED_TAX",
      confidence: 0.72,
      reasons,
      answerDirectly: false,
    };
  }

  return {
    category: isDefinitionStyleQuestion(normalizedQuestion) ? "GENERAL_INFO" : "OTHER",
    confidence: isDefinitionStyleQuestion(normalizedQuestion) ? 0.68 : 0.52,
    reasons: [isDefinitionStyleQuestion(normalizedQuestion) ? "general_definition_path" : "default_other_path"],
    answerDirectly: isDefinitionStyleQuestion(normalizedQuestion),
  };
};
