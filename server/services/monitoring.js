import { featureFlags } from "../Config/featureFlags.js";
import { logger } from "./logger.js";

let sentryModulePromise = null;

const loadSentry = async () => {
  if (!featureFlags.errorMonitoringEnabled) return null;
  if (!sentryModulePromise) {
    sentryModulePromise = import("@sentry/node").catch(() => null);
  }
  return sentryModulePromise;
};

export const initErrorMonitoring = async () => {
  const sentry = await loadSentry();
  if (!sentry?.default && !sentry?.init) return;
  const Sentry = sentry.default || sentry;

  const dsn = String(process.env.SENTRY_DSN || "").trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.APP_COMMIT || undefined,
    serverName: process.env.APP_NAME || "nritax-server",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    initialScope: {
      tags: {
        service: process.env.APP_NAME || "nritax-server",
        region: process.env.APP_REGION || process.env.RENDER_REGION || "unknown",
      },
    },
  });

  logger.info({ enabled: true }, "error monitoring initialized");
};

export const captureException = async (error, context = {}) => {
  const sentry = await loadSentry();
  const Sentry = sentry?.default || sentry;
  if (Sentry?.captureException) {
    Sentry.captureException(error, { extra: context });
  }
};
