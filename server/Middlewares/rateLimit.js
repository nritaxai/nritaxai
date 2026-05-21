const stores = new Map();

const getClientKey = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
};

const nowMs = () => Date.now();

export const createRateLimiter = ({
  windowMs = 60 * 1000,
  maxRequests = 60,
  message = "Too many requests. Please try again later.",
} = {}) => {
  return (req, res, next) => {
    const key = getClientKey(req);
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
};
