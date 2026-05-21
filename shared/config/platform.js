import { getOptionalEnv, parseBoolean, parseList, parseNumber } from "./env.js";

export const createPlatformConfig = (env = {}) => ({
  app: {
    name: getOptionalEnv(env, "APP_NAME", "nritax-platform"),
    env: getOptionalEnv(env, "NODE_ENV", "development"),
    version: getOptionalEnv(env, "APP_VERSION", "dev"),
    region: getOptionalEnv(env, "APP_REGION", "unknown"),
  },
  api: {
    port: parseNumber(env.PORT, 5000),
    allowedOrigins: parseList(env.ALLOWED_ORIGINS),
    jsonBodyLimit: getOptionalEnv(env, "JSON_BODY_LIMIT", "5mb"),
  },
  features: {
    aiGatewayEnabled: parseBoolean(env.AI_GATEWAY_ENABLED, true),
    backgroundJobsEnabled: parseBoolean(env.BACKGROUND_JOBS_ENABLED, false),
    streamingEnabled: parseBoolean(env.AI_GATEWAY_STREAMING_ENABLED, false),
    paymentReliabilityEnabled: parseBoolean(env.PAYMENT_RELIABILITY_ENABLED, true),
  },
});
