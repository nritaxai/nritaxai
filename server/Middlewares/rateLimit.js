import { getRedisConnection } from "../queues/redis.js";

const stores = new Map();

const getClientKey = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  return ip;
};

const nowMs = () => Date.now();

const GLOBAL_RATE_LIMIT_PER_MIN = process.env.GLOBAL_RATE_LIMIT_PER_MIN || 120;

export const createRateLimiter = ({
  windowMs = 60 * 1000,
  maxRequests = 60,
  message = "Too many requests. Please try again later.",
} = {}) => {
  return async (req, res, next) => {
    const key = getClientKey(req);
    const redis = await getRedisConnection({ requireQueueing: false, role: "rate-limit" });

    if (redis) {
      await handleRedisRateLimit({ redis, key, maxRequests, windowMs, message, res, next });
    } else {
      handleMapRateLimit({ key, windowMs, maxRequests, message, res, next });
    }
  };
};

const handleRedisRateLimit = async ({ redis, key, maxRequests, windowMs, message, res, next }) => {
  try {
    const redisKey = `rate_limit:${key}`;
    const count = await redis.incr(redisKey);

    if (count === 1) {
      await redis.expire(redisKey, 60);
    }

    const limit = GLOBAL_RATE_LIMIT_PER_MIN;
    const remaining = Math.max(limit - count, 0);
    const ttl = await redis.ttl(redisKey);
    const retryAfter = ttl > 0 ? ttl : 60;

    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("Retry-After", String(retryAfter));

    if (count > limit) {
      return res.status(429).json({
        error: "Too Many Requests"
      });
    }

    return next();
  } catch (error) {
    console.warn("[RATE LIMIT] Redis unavailable - using fallback");
    handleMapRateLimit({ key, windowMs, maxRequests, message, res, next });
  }
};

const handleMapRateLimit = ({ key, windowMs, maxRequests, message, res, next }) => {
  const currentTime = nowMs();
  const windowStart = currentTime - windowMs;

  const existing = stores.get(key) || [];
  const recent = existing.filter((ts) => ts > windowStart);
  recent.push(currentTime);
  stores.set(key, recent);

  const remaining = Math.max(maxRequests - recent.length, 0);
  res.setHeader("x-ratelimit-limit", String(maxRequests));
  res.setHeader("x-ratelimit-remaining", String(remaining));
  res.setHeader("x-ratelimit-reset", String(Math.ceil((recent[0] + windowMs) / 1000)));

  if (recent.length > maxRequests) {
    return res.status(429).json({
      success: false,
      message,
      error: message,
    });
  }

  return next();
};
