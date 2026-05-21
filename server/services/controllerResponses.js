import { logger } from "./logger.js";

const normalizeError = (error) => ({
  name: error?.name || "Error",
  message: error?.message || String(error || "unknown"),
});

export const respondOk = (res, body = {}, status = 200) => res.status(status).json(body);

export const respondError = (res, status, message, extra = {}) =>
  res.status(status).json({
    ...extra,
    ...(extra.success === undefined ? {} : { success: extra.success }),
    message,
  });

export const respondLegacyError = (res, status, message, key = "error", extra = {}) =>
  res.status(status).json({
    ...extra,
    [key]: message,
  });

export const logControllerError = (scope, error, context = {}) => {
  logger.error(
    {
      scope,
      error: normalizeError(error),
      ...context,
    },
    `${scope} failed`
  );
};
