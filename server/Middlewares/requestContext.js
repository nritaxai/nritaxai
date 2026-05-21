import { createRequestId, logger } from "../services/logger.js";

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
    childLogger.info(
      {
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      "request completed"
    );
  });

  next();
};
