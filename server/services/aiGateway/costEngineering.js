const CHARS_PER_TOKEN = 4;

const SMALL_PROMPT = [
  "You are an NRI tax assistant for nritax.ai.",
  "Answer only tax-related questions for NRIs and cross-border Indian tax cases.",
  "Use this structure only:",
  "## [Topic Title]",
  "**Direct Answer:** [one sentence]",
  "### Detailed Explanation",
  "### Practical Next Steps",
  "*Disclaimer: For your specific situation, consulting a qualified CA is recommended.*",
  "Be specific, concise, and avoid repetition.",
].join("\n");

const MEDIUM_PROMPT = [
  "You are an expert NRI tax advisor for Indian tax and DTAA questions.",
  "Answer only tax-related questions and keep the response grounded in the provided context.",
  "Use this structure only:",
  "## [Topic Title]",
  "**Direct Answer:** [one sentence]",
  "### Detailed Explanation",
  "### Practical Next Steps",
  "*Disclaimer: For your specific situation, consulting a qualified CA is recommended.*",
  "Mention sections, forms, deadlines, and rates when clearly relevant.",
  "Do not repeat prior context and do not add extra sections.",
].join("\n");

const TOKEN_PROFILES = {
  small: {
    defaultMaxTokens: 384,
    hardCap: 640,
    contextMessageLimit: 3,
    maxMessageChars: 2400,
    maxTotalChars: 5200,
    strategy: "lightweight",
  },
  medium: {
    defaultMaxTokens: 768,
    hardCap: 1152,
    contextMessageLimit: 4,
    maxMessageChars: 3200,
    maxTotalChars: 7800,
    strategy: "rag-small",
  },
  large: {
    defaultMaxTokens: 1400,
    hardCap: 1792,
    contextMessageLimit: 6,
    maxMessageChars: 5200,
    maxTotalChars: 12000,
    strategy: "advanced",
  },
};

const MODEL_PRICING_PER_1K = [
  {
    match: /gemini-2\.0-flash|gemini-1\.5-flash|flash-lite/i,
    family: "lightweight",
    inputUsd: 0.0002,
    outputUsd: 0.0007,
  },
  {
    match: /llama3\.1:8b|llama|qwen|mistral|mini|small/i,
    family: "small-open",
    inputUsd: 0.00015,
    outputUsd: 0.00035,
  },
  {
    match: /claude-3\.5-sonnet|gpt-4o|gemini-1\.5-pro|pro/i,
    family: "premium",
    inputUsd: 0.003,
    outputUsd: 0.015,
  },
];

const trimTextWindow = (text = "", maxChars = 2000) => {
  const normalized = String(text || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length <= maxChars) return normalized;

  const headChars = Math.floor(maxChars * 0.68);
  const tailChars = Math.max(180, maxChars - headChars - 40);
  return `${normalized.slice(0, headChars).trim()}\n\n[Context compressed for cost efficiency]\n\n${normalized.slice(-tailChars).trim()}`;
};

const resolveProfile = (routeTier = "medium") => TOKEN_PROFILES[routeTier] || TOKEN_PROFILES.medium;

export const estimateTokensFromText = (text = "") => Math.max(1, Math.ceil(String(text || "").length / CHARS_PER_TOKEN));

export const estimateMessagesTokens = (messages = []) =>
  Math.max(
    1,
    messages.reduce((total, message) => total + estimateTokensFromText(message?.content || ""), 0)
  );

export const resolveTokenBudget = ({ routeTier = "medium", maxTokens } = {}) => {
  const profile = resolveProfile(routeTier);
  const requested = Number(maxTokens || 0);
  if (Number.isFinite(requested) && requested > 0) {
    return Math.min(Math.max(Math.round(requested), 128), profile.hardCap);
  }
  return profile.defaultMaxTokens;
};

export const compressGatewayMessages = ({ messages = [], routeTier = "medium" } = {}) => {
  const profile = resolveProfile(routeTier);
  const normalized = Array.isArray(messages) ? messages : [];
  const limited = normalized.slice(-profile.contextMessageLimit).map((message) => ({
    ...message,
    content: trimTextWindow(message?.content || "", profile.maxMessageChars),
  }));

  const joinedLength = limited.reduce((total, message) => total + String(message?.content || "").length, 0);
  if (joinedLength <= profile.maxTotalChars) {
    return limited;
  }

  const perMessageCap = Math.max(800, Math.floor(profile.maxTotalChars / Math.max(1, limited.length)));
  return limited.map((message) => ({
    ...message,
    content: trimTextWindow(message?.content || "", perMessageCap),
  }));
};

export const compressSystemPrompt = ({ systemPrompt = "", routeTier = "medium" } = {}) => {
  if (!systemPrompt) return "";
  if (routeTier === "small") return SMALL_PROMPT;
  if (routeTier === "medium") return MEDIUM_PROMPT;
  return trimTextWindow(systemPrompt, 4200);
};

const resolveModelPricing = ({ provider = "", model = "" } = {}) => {
  const modelKey = `${String(provider || "")} ${String(model || "")}`.trim();
  return (
    MODEL_PRICING_PER_1K.find((entry) => entry.match.test(modelKey)) || {
      family: provider === "ollama" ? "local" : "default",
      inputUsd: provider === "ollama" ? 0 : 0.0015,
      outputUsd: provider === "ollama" ? 0 : 0.006,
    }
  );
};

export const estimateAiCost = ({
  provider = "",
  model = "",
  routeTier = "medium",
  messages = [],
  systemPrompt = "",
  response = "",
} = {}) => {
  const promptTokens = estimateTokensFromText(systemPrompt);
  const inputTokens = promptTokens + estimateMessagesTokens(messages);
  const outputTokens = estimateTokensFromText(response);
  const pricing = resolveModelPricing({ provider, model });
  const estimatedCostUsd = Number(
    (((inputTokens / 1000) * pricing.inputUsd) + ((outputTokens / 1000) * pricing.outputUsd)).toFixed(6)
  );

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd,
    modelFamily: pricing.family,
    strategy: resolveProfile(routeTier).strategy,
  };
};

export const getTierStrategy = (routeTier = "medium") => resolveProfile(routeTier).strategy;
