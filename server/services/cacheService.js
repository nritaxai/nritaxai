import { featureFlags } from "../Config/featureFlags.js";
import { getRedisConnection, isRedisConfigured } from "../queues/redis.js";
import { logger } from "./logger.js";
import { recordCacheMetric, recordCacheOperationMetric } from "./metrics.js";

const KEY_PREFIX = String(process.env.REDIS_CACHE_KEY_PREFIX || "nritax:cache").trim();
const DEFAULT_LOCAL_MAX_ITEMS = Math.max(Number(process.env.REDIS_CACHE_LOCAL_MAX_ITEMS || 500), 50);
const DEFAULT_LOCAL_TTL_MS = Math.max(Number(process.env.REDIS_CACHE_LOCAL_TTL_MS || 120000), 1000);

const localStore = new Map();
const inFlightLoads = new Map();

const normalizeLayer = (layer = "unknown") =>
  String(layer || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_");

const normalizeKey = (key = "") => String(key || "").trim();

const buildCacheKey = ({ layer = "unknown", key = "" }) => `${KEY_PREFIX}:${normalizeLayer(layer)}:${normalizeKey(key)}`;

const getScopedStore = (layer = "unknown") => {
  const safeLayer = normalizeLayer(layer);
  if (!localStore.has(safeLayer)) {
    localStore.set(safeLayer, new Map());
  }
  return localStore.get(safeLayer);
};

const pruneScopedStore = (store, { maxItems = DEFAULT_LOCAL_MAX_ITEMS } = {}) => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (!entry || now >= Number(entry.expiresAt || 0)) {
      store.delete(key);
    }
  }
  while (store.size > maxItems) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
};

const getLocalValue = ({ layer = "unknown", key = "" }) => {
  const startedAt = Date.now();
  const scopedStore = getScopedStore(layer);
  const entry = scopedStore.get(key);
  if (!entry) {
    recordCacheOperationMetric({ layer, backend: "local", operation: "get", durationMs: Date.now() - startedAt });
    return null;
  }
  if (Date.now() >= Number(entry.expiresAt || 0)) {
    scopedStore.delete(key);
    recordCacheOperationMetric({ layer, backend: "local", operation: "get", durationMs: Date.now() - startedAt });
    return null;
  }
  recordCacheOperationMetric({ layer, backend: "local", operation: "get", durationMs: Date.now() - startedAt });
  return entry.value;
};

const setLocalValue = ({ layer = "unknown", key = "", value, ttlMs = DEFAULT_LOCAL_TTL_MS, maxItems = DEFAULT_LOCAL_MAX_ITEMS }) => {
  const startedAt = Date.now();
  const scopedStore = getScopedStore(layer);
  scopedStore.set(key, {
    value,
    expiresAt: Date.now() + Math.max(Number(ttlMs || DEFAULT_LOCAL_TTL_MS), 1000),
  });
  pruneScopedStore(scopedStore, { maxItems });
  recordCacheOperationMetric({ layer, backend: "local", operation: "set", durationMs: Date.now() - startedAt });
};

const deleteLocalValue = ({ layer = "unknown", key = "" }) => {
  const startedAt = Date.now();
  const scopedStore = getScopedStore(layer);
  scopedStore.delete(key);
  recordCacheOperationMetric({ layer, backend: "local", operation: "delete", durationMs: Date.now() - startedAt });
};

const serializeValue = (value) => JSON.stringify({ value });
const deserializeValue = (payload = "") => JSON.parse(String(payload || "{}")).value;

const shouldUseDistributedCache = () =>
  featureFlags.redisCacheEnabled && isRedisConfigured();

export const getCachedValue = async ({ layer = "unknown", key = "" } = {}) => {
  const safeKey = normalizeKey(key);
  if (!safeKey) return null;

  const localValue = getLocalValue({ layer, key: safeKey });
  if (localValue !== null && localValue !== undefined) {
    recordCacheMetric({ layer, hit: true });
    return localValue;
  }

  if (!shouldUseDistributedCache()) {
    recordCacheMetric({ layer, hit: false });
    return null;
  }

  const startedAt = Date.now();
  try {
    const redis = await getRedisConnection({ requireQueueing: false, role: "cache" });
    if (!redis) {
      recordCacheMetric({ layer, hit: false });
      return null;
    }
    const payload = await redis.get(buildCacheKey({ layer, key: safeKey }));
    recordCacheOperationMetric({ layer, backend: "redis", operation: "get", durationMs: Date.now() - startedAt });
    if (!payload) {
      recordCacheMetric({ layer, hit: false });
      return null;
    }
    const value = deserializeValue(payload);
    setLocalValue({ layer, key: safeKey, value });
    recordCacheMetric({ layer, hit: true });
    return value;
  } catch (error) {
    logger.warn({ layer, error: error?.message || String(error) }, "redis cache get failed, continuing with local fallback");
    recordCacheOperationMetric({ layer, backend: "redis", operation: "get", durationMs: Date.now() - startedAt });
    recordCacheMetric({ layer, hit: false });
    return null;
  }
};

export const setCachedValue = async ({
  layer = "unknown",
  key = "",
  value,
  ttlSeconds = 120,
  localTtlMs = DEFAULT_LOCAL_TTL_MS,
  localMaxItems = DEFAULT_LOCAL_MAX_ITEMS,
} = {}) => {
  const safeKey = normalizeKey(key);
  if (!safeKey || value === undefined) return;

  setLocalValue({
    layer,
    key: safeKey,
    value,
    ttlMs: Math.max(localTtlMs, ttlSeconds * 1000),
    maxItems: localMaxItems,
  });

  if (!shouldUseDistributedCache()) {
    return;
  }

  const startedAt = Date.now();
  try {
    const redis = await getRedisConnection({ requireQueueing: false, role: "cache" });
    if (!redis) return;
    await redis.set(buildCacheKey({ layer, key: safeKey }), serializeValue(value), "EX", Math.max(Number(ttlSeconds || 120), 1));
    recordCacheOperationMetric({ layer, backend: "redis", operation: "set", durationMs: Date.now() - startedAt });
  } catch (error) {
    logger.warn({ layer, error: error?.message || String(error) }, "redis cache set failed, local fallback retained");
    recordCacheOperationMetric({ layer, backend: "redis", operation: "set", durationMs: Date.now() - startedAt });
  }
};

export const deleteCachedValue = async ({ layer = "unknown", key = "" } = {}) => {
  const safeKey = normalizeKey(key);
  if (!safeKey) return;

  deleteLocalValue({ layer, key: safeKey });

  if (!shouldUseDistributedCache()) {
    return;
  }

  const startedAt = Date.now();
  try {
    const redis = await getRedisConnection({ requireQueueing: false, role: "cache" });
    if (!redis) return;
    await redis.del(buildCacheKey({ layer, key: safeKey }));
    recordCacheOperationMetric({ layer, backend: "redis", operation: "delete", durationMs: Date.now() - startedAt });
  } catch (error) {
    logger.warn({ layer, error: error?.message || String(error) }, "redis cache delete failed");
    recordCacheOperationMetric({ layer, backend: "redis", operation: "delete", durationMs: Date.now() - startedAt });
  }
};

export const deleteCachedValues = async ({ layer = "unknown", keys = [] } = {}) => {
  const safeKeys = Array.isArray(keys) ? keys.map(normalizeKey).filter(Boolean) : [];
  if (!safeKeys.length) return;
  await Promise.all(safeKeys.map((key) => deleteCachedValue({ layer, key })));
};

export const getOrSetCachedValue = async ({
  layer = "unknown",
  key = "",
  ttlSeconds = 120,
  localTtlMs = DEFAULT_LOCAL_TTL_MS,
  localMaxItems = DEFAULT_LOCAL_MAX_ITEMS,
  loader,
} = {}) => {
  const safeKey = normalizeKey(key);
  if (!safeKey || typeof loader !== "function") {
    return null;
  }

  const cached = await getCachedValue({ layer, key: safeKey });
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  const inFlightKey = `${normalizeLayer(layer)}:${safeKey}`;
  if (inFlightLoads.has(inFlightKey)) {
    return inFlightLoads.get(inFlightKey);
  }

  const loadPromise = (async () => {
    try {
      const loadedValue = await loader();
      if (loadedValue !== null && loadedValue !== undefined) {
        await setCachedValue({
          layer,
          key: safeKey,
          value: loadedValue,
          ttlSeconds,
          localTtlMs,
          localMaxItems,
        });
      }
      return loadedValue;
    } finally {
      inFlightLoads.delete(inFlightKey);
    }
  })();

  inFlightLoads.set(inFlightKey, loadPromise);
  return loadPromise;
};
