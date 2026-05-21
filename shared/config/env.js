export const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const parseNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const parseList = (value, separator = ",") =>
  String(value || "")
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);

export const getRequiredEnv = (env, key) => {
  const value = String(env?.[key] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const getOptionalEnv = (env, key, fallback = "") => {
  const value = String(env?.[key] || "").trim();
  return value || fallback;
};
