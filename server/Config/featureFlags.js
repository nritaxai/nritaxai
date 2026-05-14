const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const featureFlags = {
  aiGatewayEnabled: parseBoolean(process.env.AI_GATEWAY_ENABLED, true),
  aiGatewayParallelFallbackEnabled: parseBoolean(process.env.AI_GATEWAY_ENABLE_PARALLEL_FALLBACK, false),
  aiGatewayCacheEnabled: parseBoolean(process.env.AI_GATEWAY_CACHE_ENABLED, true),
  aiGatewayStreamingEnabled: parseBoolean(process.env.AI_GATEWAY_STREAMING_ENABLED, false),
  aiGatewayOllamaEnabled: parseBoolean(process.env.AI_GATEWAY_OLLAMA_ENABLED, false),
  backgroundJobsEnabled: parseBoolean(process.env.BACKGROUND_JOBS_ENABLED, false),
  pdfQueueEnabled: parseBoolean(process.env.PDF_QUEUE_ENABLED, false),
  consultationQueueEnabled: parseBoolean(process.env.CONSULTATION_QUEUE_ENABLED, false),
  aiQueueEnabled: parseBoolean(process.env.AI_QUEUE_ENABLED, false),
  reportQueueEnabled: parseBoolean(process.env.REPORT_QUEUE_ENABLED, false),
  structuredLoggingEnabled: parseBoolean(process.env.STRUCTURED_LOGGING_ENABLED, true),
  tracingEnabled: parseBoolean(process.env.OTEL_ENABLED, false),
  errorMonitoringEnabled: parseBoolean(process.env.SENTRY_ENABLED, false),
  paymentReliabilityEnabled: parseBoolean(process.env.PAYMENT_RELIABILITY_ENABLED, true),
  paymentMonitoringEnabled: parseBoolean(process.env.PAYMENT_MONITORING_ENABLED, true),
  paymentReconciliationEnabled: parseBoolean(process.env.PAYMENT_RECONCILIATION_ENABLED, true),
  paymentQueueEnabled: parseBoolean(process.env.PAYMENT_QUEUE_ENABLED, false),
  hybridRetrievalCacheEnabled: parseBoolean(process.env.HYBRID_RETRIEVAL_CACHE_ENABLED, true),
};

export { parseBoolean };
