import { featureFlags } from "../Config/featureFlags.js";
import { logger } from "../services/logger.js";
import { setCacheBackendStateMetric } from "../services/metrics.js";

let redisConnection = null;

export const isRedisConfigured = () => Boolean(String(process.env.REDIS_URL || "").trim());

export const isQueueingConfigured = () =>
  featureFlags.backgroundJobsEnabled && isRedisConfigured();

export const getRedisConnection = async ({ requireQueueing = true, role = "queue" } = {}) => {
  if ((requireQueueing && !isQueueingConfigured()) || (!requireQueueing && !isRedisConfigured())) {
    setCacheBackendStateMetric({ backend: "redis", role, connected: false });
    return null;
  }

  if (redisConnection) return redisConnection;

  try {
    const { default: IORedis } = await import("ioredis");
    redisConnection = new IORedis(String(process.env.REDIS_URL || "").trim(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy(times) {
        return Math.min(times * 250, 5000);
      },
    });

    await redisConnection.connect();
    logger.info({ queueing: true }, "redis connection established");
    setCacheBackendStateMetric({ backend: "redis", role, connected: true });
    redisConnection.on("close", () => {
      setCacheBackendStateMetric({ backend: "redis", role, connected: false });
    });
    redisConnection.on("end", () => {
      setCacheBackendStateMetric({ backend: "redis", role, connected: false });
    });
    redisConnection.on("error", () => {
      setCacheBackendStateMetric({ backend: "redis", role, connected: false });
    });
    return redisConnection;
  } catch (error) {
    logger.warn({ error: error?.message || String(error) }, "redis unavailable, falling back to inline execution");
    setCacheBackendStateMetric({ backend: "redis", role, connected: false });
    redisConnection = null;
    return null;
  }
};
