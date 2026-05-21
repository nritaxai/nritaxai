const SMALL_MODEL_PATTERNS = [
  /\bclassify\b/i,
  /\bclassification\b/i,
  /\bextract\b/i,
  /\bextraction\b/i,
  /\bvalidate\b/i,
  /\bvalidation\b/i,
  /\bsummar(y|ize|isation|ization)\b/i,
  /\bformat\b/i,
  /\bintent\b/i,
  /\bheadline\b/i,
  /\brewrite\b/i,
  /\btranslate\b/i,
  /\blist\b/i,
  /\bquick\b/i,
];

const LARGE_MODEL_PATTERNS = [
  /\bcomplex\b/i,
  /\bedge[\s-]?case\b/i,
  /\bmulti[\s-]?country\b/i,
  /\bdtaa\b/i,
  /\bscenario analysis\b/i,
  /\bcompare\b.*\b(country|countries|jurisdiction|jurisdictions)\b/i,
  /\bcapital gains\b/i,
  /\bforeign tax credit\b/i,
];

const normalizeWorkflow = (workflow = "") => String(workflow || "").trim().toLowerCase();

const isShortUtilityTask = (text = "", workflow = "") =>
  SMALL_MODEL_PATTERNS.some((pattern) => pattern.test(text)) ||
  /\b(chat_general|chat_dtaa)\b/.test(workflow) === false && /\b(classif|extract|summary|rewrite|translate)\b/.test(workflow);

const hasAdvancedTaxSignals = (text = "") =>
  LARGE_MODEL_PATTERNS.some((pattern) => pattern.test(text)) ||
  /\b(treaty|permanent establishment|pe exposure|tie[- ]breaker|beneficial ownership|make available)\b/i.test(text);

export const classifyRouteTier = ({
  question = "",
  preferredModel = "",
  costAwareEnabled = true,
  routeHints = {},
} = {}) => {
  const normalizedQuestion = String(question || "").trim();
  const text = `${normalizedQuestion} ${String(preferredModel || "")}`.trim();
  const wordCount = normalizedQuestion.split(/\s+/).filter(Boolean).length;
  const workflow = normalizeWorkflow(routeHints?.workflow);
  const questionChars = Number(routeHints?.questionChars || normalizedQuestion.length || 0);
  const contextChars = Number(routeHints?.contextChars || 0);
  const retrievedContextChars = Number(routeHints?.retrievedContextChars || 0);
  const ragLikely = Boolean(routeHints?.ragLikely);
  const multiJurisdiction = /\b(multi[\s-]?country|multiple countries|compare)\b/i.test(text);
  const complexBySize = questionChars > 320 || contextChars > 2200 || retrievedContextChars > 1800;

  if (hasAdvancedTaxSignals(text)) {
    if (!costAwareEnabled) {
      return "large";
    }
    if (multiJurisdiction || wordCount > 26 || complexBySize) {
      return "large";
    }
    if (ragLikely || /\b(dtaa|treaty|foreign tax credit)\b/i.test(text)) {
      return "medium";
    }
  }

  if (ragLikely) {
    return complexBySize ? "large" : "medium";
  }

  if (
    isShortUtilityTask(text, workflow) ||
    (costAwareEnabled
      ? (questionChars < 72 && wordCount <= 12 && contextChars < 1200)
      : normalizedQuestion.length < 40)
  ) {
    return "small";
  }

  if (workflow.includes("chat_dtaa")) {
    return complexBySize ? "large" : "medium";
  }

  return "medium";
};

export const buildRoutePlan = ({
  question = "",
  preferredModel = "",
  openRouterGeminiModel = "google/gemini-2.0-flash-001",
  largeModel = "",
  mediumModel = "",
  smallModel = "",
  ollamaModel = "",
  ollamaEnabled = false,
  costAwareEnabled = true,
  routeHints = {},
} = {}) => {
  const tier = classifyRouteTier({ question, preferredModel, costAwareEnabled, routeHints });

  if (tier === "small") {
    return {
      tier,
      strategy: costAwareEnabled ? "lightweight" : "legacy",
      attempts: [
        ...(ollamaEnabled ? [{ provider: "ollama", preferredModel: ollamaModel, fallbackUsed: false }] : []),
        { provider: "openrouter", preferredModel: smallModel || openRouterGeminiModel, fallbackUsed: !ollamaEnabled },
        { provider: "gemini-direct", preferredModel: process.env.GEMINI_MODEL || "", fallbackUsed: true },
      ],
    };
  }

  if (tier === "large") {
    return {
      tier,
      strategy: costAwareEnabled ? "advanced" : "legacy",
      attempts: [
        { provider: "openrouter", preferredModel: largeModel || preferredModel || mediumModel, fallbackUsed: false },
        { provider: "gemini-direct", preferredModel: process.env.GEMINI_MODEL || "", fallbackUsed: true },
      ],
    };
  }

  return {
    tier,
    strategy: costAwareEnabled ? "rag-small" : "legacy",
    attempts: [
      {
        provider: "openrouter",
        preferredModel: costAwareEnabled ? smallModel || openRouterGeminiModel : preferredModel || mediumModel,
        fallbackUsed: false,
      },
      ...(ollamaEnabled ? [{ provider: "ollama", preferredModel: ollamaModel, fallbackUsed: true }] : []),
      ...(costAwareEnabled
        ? [{ provider: "openrouter", preferredModel: preferredModel || mediumModel, fallbackUsed: true }]
        : [{ provider: "openrouter", preferredModel: openRouterGeminiModel, fallbackUsed: true }]),
      { provider: "gemini-direct", preferredModel: process.env.GEMINI_MODEL || "", fallbackUsed: true },
    ],
  };
};
