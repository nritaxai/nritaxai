import { getCachedValue, setCachedValue } from "../cacheService.js";

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

export const getCachedGatewayResponse = async (cacheKey) => {
  if (!cacheKey) return null;
  const entry = responseCache.get(cacheKey);
  if (entry && Date.now() - entry.createdAt <= DEFAULT_TTL_MS) {
    return entry.value;
  }
  if (entry && Date.now() - entry.createdAt > DEFAULT_TTL_MS) {
    responseCache.delete(cacheKey);
  }

  const distributed = await getCachedValue({
    layer: "ai_gateway_response",
    key: cacheKey,
  });
  if (!distributed) {
    return null;
  }

  responseCache.set(cacheKey, {
    value: distributed,
    createdAt: Date.now(),
  });
  ensureBoundedCache();
  return distributed;
};

export const setCachedGatewayResponse = async (cacheKey, value) => {
  if (!cacheKey || !value) return;
  responseCache.set(cacheKey, {
    value,
    createdAt: Date.now(),
  });
  ensureBoundedCache();
  await setCachedValue({
    layer: "ai_gateway_response",
    key: cacheKey,
    value,
    ttlSeconds: Math.ceil(DEFAULT_TTL_MS / 1000),
    localTtlMs: DEFAULT_TTL_MS,
    localMaxItems: DEFAULT_MAX_ITEMS,
  });
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
