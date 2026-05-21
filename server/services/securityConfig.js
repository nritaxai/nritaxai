import { logger } from "./logger.js";

const REQUIRED_SECRETS = [
  "JWT_SECRET",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
];

const RECOMMENDED_SECRETS = [
  "DATA_ENCRYPTION_KEY",
  "CONSULTATION_WEBHOOK_SIGNING_SECRET",
  "EXPERT_ONBOARDING_WEBHOOK_SIGNING_SECRET",
  "YUKTI_WEBHOOK_SIGNING_SECRET",
  "METRICS_AUTH_TOKEN",
  "SENTRY_DSN",
];

const getStatus = (keys = []) =>
  keys.map((key) => ({
    key,
    configured: Boolean(String(process.env[key] || "").trim()),
  }));

export const getSecurityReadiness = () => {
  const required = getStatus(REQUIRED_SECRETS);
  const recommended = getStatus(RECOMMENDED_SECRETS);
  return {
    required,
    recommended,
    ready: required.every((item) => item.configured),
  };
};

export const validateSecurityConfiguration = () => {
  const readiness = getSecurityReadiness();
  const missingRequired = readiness.required.filter((item) => !item.configured).map((item) => item.key);
  const missingRecommended = readiness.recommended.filter((item) => !item.configured).map((item) => item.key);

  if (missingRequired.length) {
    logger.warn({ missingRequired }, "security configuration missing required secrets");
  }
  if (missingRecommended.length) {
    logger.info({ missingRecommended }, "security configuration missing recommended hardening secrets");
  }

  return readiness;
};
