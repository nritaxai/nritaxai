import { createRequestId, logger } from "../services/logger.js";
import { recordHttpRequestMetric } from "../services/metrics.js";

export const requestContextMiddleware = (req, res, next) => {
  const startedAt = Date.now();
  const requestId = req.headers["x-request-id"] || createRequestId();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const childLogger = logger.child({
    requestId,
    method: req.method,
    path: req.originalUrl,
  });
  req.logger = childLogger;

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const route = req.route?.path || req.baseUrl || req.path || req.originalUrl || "unknown";
    recordHttpRequestMetric({
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs,
    });
    childLogger.info(
      {
        statusCode: res.statusCode,
        durationMs,
      },
      "request completed"
    );
  });

  next();
};
