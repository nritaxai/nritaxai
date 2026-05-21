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
];

const LARGE_MODEL_PATTERNS = [
  /\bcomplex\b/i,
  /\bedge[\s-]?case\b/i,
  /\bmulti[\s-]?country\b/i,
  /\btreaty\b/i,
  /\bdtaa\b/i,
  /\bscenario analysis\b/i,
  /\bcompare\b.*\b(country|countries|jurisdiction|jurisdictions)\b/i,
  /\bcapital gains\b/i,
  /\bforeign tax credit\b/i,
];

export const classifyRouteTier = ({ question = "", preferredModel = "" } = {}) => {
  const text = `${String(question || "")} ${String(preferredModel || "")}`.trim();

  if (LARGE_MODEL_PATTERNS.some((pattern) => pattern.test(text))) {
    return "large";
  }

  if (SMALL_MODEL_PATTERNS.some((pattern) => pattern.test(text)) || String(question || "").trim().length < 40) {
    return "small";
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
} = {}) => {
  const tier = classifyRouteTier({ question, preferredModel });

  if (tier === "small") {
    return {
      tier,
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
      attempts: [
        { provider: "openrouter", preferredModel: largeModel || preferredModel || mediumModel, fallbackUsed: false },
        { provider: "gemini-direct", preferredModel: process.env.GEMINI_MODEL || "", fallbackUsed: true },
      ],
    };
  }

  return {
    tier,
    attempts: [
      { provider: "openrouter", preferredModel: preferredModel || mediumModel, fallbackUsed: false },
      ...(ollamaEnabled ? [{ provider: "ollama", preferredModel: ollamaModel, fallbackUsed: true }] : []),
      { provider: "openrouter", preferredModel: openRouterGeminiModel, fallbackUsed: true },
      { provider: "gemini-direct", preferredModel: process.env.GEMINI_MODEL || "", fallbackUsed: true },
    ],
  };
};
