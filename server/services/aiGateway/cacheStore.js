import { recordCacheMetric } from "../metrics.js";

const DEFAULT_TTL_MS = Math.max(Number(process.env.AI_GATEWAY_CACHE_TTL_MS || 120000), 1000);
const DEFAULT_MAX_ITEMS = Math.max(Number(process.env.AI_GATEWAY_CACHE_MAX_ITEMS || 300), 25);

const responseCache = new Map();
const inFlightRequests = new Map();

const pruneExpiredEntries = () => {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (!entry || now - entry.createdAt > DEFAULT_TTL_MS) {
      responseCache.delete(key);
    }
  }
};

const ensureBoundedCache = () => {
  pruneExpiredEntries();
  while (responseCache.size > DEFAULT_MAX_ITEMS) {
    const oldestKey = responseCache.keys().next().value;
    if (!oldestKey) break;
    responseCache.delete(oldestKey);
  }
};

export const buildAiGatewayCacheKey = ({
  question = "",
  messages = [],
  preferredModel = "",
  systemPrompt = "",
}) => {
  const normalizedMessages = Array.isArray(messages)
    ? messages
        .slice(-6)
        .map((message) => ({
          role: message?.role === "assistant" ? "assistant" : "user",
          content: String(message?.content || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ")
            .slice(0, 240),
        }))
    : [];

  return JSON.stringify({
    question: String(question || "").trim().toLowerCase(),
    preferredModel: String(preferredModel || "").trim().toLowerCase(),
    systemPrompt: String(systemPrompt || "").trim().slice(0, 160),
    messages: normalizedMessages,
  });
};

export const getCachedGatewayResponse = (cacheKey) => {
  if (!cacheKey) return null;
  const entry = responseCache.get(cacheKey);
  if (!entry) {
    recordCacheMetric({ layer: "ai_gateway_response", hit: false });
    return null;
  }
  if (Date.now() - entry.createdAt > DEFAULT_TTL_MS) {
    responseCache.delete(cacheKey);
    recordCacheMetric({ layer: "ai_gateway_response", hit: false });
    return null;
  }
  recordCacheMetric({ layer: "ai_gateway_response", hit: true });
  return entry.value;
};

export const setCachedGatewayResponse = (cacheKey, value) => {
  if (!cacheKey || !value) return;
  responseCache.set(cacheKey, {
    value,
    createdAt: Date.now(),
  });
  ensureBoundedCache();
};

export const getInFlightGatewayRequest = (cacheKey) => {
  if (!cacheKey) return null;
  return inFlightRequests.get(cacheKey) || null;
};

export const setInFlightGatewayRequest = (cacheKey, promise) => {
  if (!cacheKey || !promise) return;
  inFlightRequests.set(cacheKey, promise);
};

export const clearInFlightGatewayRequest = (cacheKey) => {
  if (!cacheKey) return;
  inFlightRequests.delete(cacheKey);
};
