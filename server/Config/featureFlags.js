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
  paymentReliabilityEnabled: parseBoolean(process.env.PAYMENT_RELIABILITY_ENABLED, true),
};

export { parseBoolean };
