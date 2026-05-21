import { featureFlags } from "../Config/featureFlags.js";
import { logger } from "../services/logger.js";

let redisConnection = null;

export const isQueueingConfigured = () =>
  featureFlags.backgroundJobsEnabled && Boolean(String(process.env.REDIS_URL || "").trim());

export const getRedisConnection = async () => {
  if (!isQueueingConfigured()) {
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
    return redisConnection;
  } catch (error) {
    logger.warn({ error: error?.message || String(error) }, "redis unavailable, falling back to inline execution");
    redisConnection = null;
    return null;
  }
};
