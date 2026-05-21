import dotenv from "dotenv";

import { parseBoolean, parseList, parseNumber } from "../../shared/config/env.js";
import {
  CHECKOUT_DISPLAY_CURRENCY_MATRIX,
  COUNTRY_RULES,
  DEFAULT_COUNTRY_CODE,
} from "./countryRules.js";

dotenv.config();

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");
const sanitizeUrl = (value, fallback = "") => sanitizeString(value).replace(/\/+$/, "") || fallback;
const unique = (values = []) => Array.from(new Set(values.filter(Boolean)));

const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  "https://nritaxai-cw9w.vercel.app",
  "https://nritax.ai",
  "https://www.nritax.ai",
  "https://www.nritaxai.com",
  "capacitor://localhost",
  "https://localhost",
  "https://127.0.0.1",
  "http://localhost",
  "http://127.0.0.1",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const FEATURE_FLAG_DEFAULTS = Object.freeze({
  aiGatewayEnabled: true,
  aiCostAwareRoutingEnabled: true,
  aiGatewayParallelFallbackEnabled: false,
  aiGatewayCacheEnabled: true,
  aiGatewayStreamingEnabled: false,
  aiGatewayOllamaEnabled: false,
  aiContextCompressionEnabled: true,
  aiTokenTrackingEnabled: true,
  backgroundJobsEnabled: false,
  pdfQueueEnabled: false,
  consultationQueueEnabled: false,
  aiQueueEnabled: false,
  multiAgentOrchestrationEnabled: false,
  multiAgentAsyncEnabled: false,
  multiAgentHumanReviewEnabled: false,
  reportQueueEnabled: false,
  structuredLoggingEnabled: true,
  tracingEnabled: false,
  prometheusMetricsEnabled: true,
  errorMonitoringEnabled: false,
  paymentReliabilityEnabled: true,
  paymentMonitoringEnabled: true,
  paymentReconciliationEnabled: true,
  paymentQueueEnabled: false,
  hybridRetrievalCacheEnabled: true,
  redisCacheEnabled: true,
  authSessionTrackingEnabled: true,
  authRefreshEnabled: true,
  authSecurityAlertsEnabled: true,
  enterpriseRbacEnabled: false,
  enterpriseTenantHeadersEnabled: false,
  enterpriseEnhancedAuditEnabled: true,
});

const COMPANY_LEGAL_NAME = "Billion Dollar Technologies Private Limited";
const COMPANY_SHORT_NAME = "Billion Dollar Technologies";
const COMPANY_SUPPORT_TEAM_NAME = `${COMPANY_SHORT_NAME} Team`;
const DEFAULT_SITE_URL = "https://www.nritax.ai";
const DEFAULT_CONSULTATION_WEBHOOK_URL = "https://n8n.caloganathan.com/webhook/consultation-booking";
const DEFAULT_YUKTI_WEBHOOK_URL = "https://n8n.caloganathan.com/webhook/yukti-tax-agent";
const DEFAULT_RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const buildFeatureFlags = (env) => ({
  aiGatewayEnabled: parseBoolean(env.AI_GATEWAY_ENABLED, FEATURE_FLAG_DEFAULTS.aiGatewayEnabled),
  aiCostAwareRoutingEnabled: parseBoolean(
    env.AI_COST_AWARE_ROUTING_ENABLED,
    FEATURE_FLAG_DEFAULTS.aiCostAwareRoutingEnabled
  ),
  aiGatewayParallelFallbackEnabled: parseBoolean(
    env.AI_GATEWAY_ENABLE_PARALLEL_FALLBACK,
    FEATURE_FLAG_DEFAULTS.aiGatewayParallelFallbackEnabled
  ),
  aiGatewayCacheEnabled: parseBoolean(env.AI_GATEWAY_CACHE_ENABLED, FEATURE_FLAG_DEFAULTS.aiGatewayCacheEnabled),
  aiGatewayStreamingEnabled: parseBoolean(
    env.AI_GATEWAY_STREAMING_ENABLED,
    FEATURE_FLAG_DEFAULTS.aiGatewayStreamingEnabled
  ),
  aiGatewayOllamaEnabled: parseBoolean(
    env.AI_GATEWAY_OLLAMA_ENABLED,
    FEATURE_FLAG_DEFAULTS.aiGatewayOllamaEnabled
  ),
  aiContextCompressionEnabled: parseBoolean(
    env.AI_CONTEXT_COMPRESSION_ENABLED,
    FEATURE_FLAG_DEFAULTS.aiContextCompressionEnabled
  ),
  aiTokenTrackingEnabled: parseBoolean(
    env.AI_TOKEN_TRACKING_ENABLED,
    FEATURE_FLAG_DEFAULTS.aiTokenTrackingEnabled
  ),
  backgroundJobsEnabled: parseBoolean(env.BACKGROUND_JOBS_ENABLED, FEATURE_FLAG_DEFAULTS.backgroundJobsEnabled),
  pdfQueueEnabled: parseBoolean(env.PDF_QUEUE_ENABLED, FEATURE_FLAG_DEFAULTS.pdfQueueEnabled),
  consultationQueueEnabled: parseBoolean(
    env.CONSULTATION_QUEUE_ENABLED,
    FEATURE_FLAG_DEFAULTS.consultationQueueEnabled
  ),
  aiQueueEnabled: parseBoolean(env.AI_QUEUE_ENABLED, FEATURE_FLAG_DEFAULTS.aiQueueEnabled),
  multiAgentOrchestrationEnabled: parseBoolean(
    env.MULTI_AGENT_ORCHESTRATION_ENABLED,
    FEATURE_FLAG_DEFAULTS.multiAgentOrchestrationEnabled
  ),
  multiAgentAsyncEnabled: parseBoolean(
    env.MULTI_AGENT_ASYNC_ENABLED,
    FEATURE_FLAG_DEFAULTS.multiAgentAsyncEnabled
  ),
  multiAgentHumanReviewEnabled: parseBoolean(
    env.MULTI_AGENT_HUMAN_REVIEW_ENABLED,
    FEATURE_FLAG_DEFAULTS.multiAgentHumanReviewEnabled
  ),
  reportQueueEnabled: parseBoolean(env.REPORT_QUEUE_ENABLED, FEATURE_FLAG_DEFAULTS.reportQueueEnabled),
  structuredLoggingEnabled: parseBoolean(
    env.STRUCTURED_LOGGING_ENABLED,
    FEATURE_FLAG_DEFAULTS.structuredLoggingEnabled
  ),
  tracingEnabled: parseBoolean(env.OTEL_ENABLED, FEATURE_FLAG_DEFAULTS.tracingEnabled),
  prometheusMetricsEnabled: parseBoolean(
    env.PROMETHEUS_METRICS_ENABLED,
    FEATURE_FLAG_DEFAULTS.prometheusMetricsEnabled
  ),
  errorMonitoringEnabled: parseBoolean(env.SENTRY_ENABLED, FEATURE_FLAG_DEFAULTS.errorMonitoringEnabled),
  paymentReliabilityEnabled: parseBoolean(
    env.PAYMENT_RELIABILITY_ENABLED,
    FEATURE_FLAG_DEFAULTS.paymentReliabilityEnabled
  ),
  paymentMonitoringEnabled: parseBoolean(
    env.PAYMENT_MONITORING_ENABLED,
    FEATURE_FLAG_DEFAULTS.paymentMonitoringEnabled
  ),
  paymentReconciliationEnabled: parseBoolean(
    env.PAYMENT_RECONCILIATION_ENABLED,
    FEATURE_FLAG_DEFAULTS.paymentReconciliationEnabled
  ),
  paymentQueueEnabled: parseBoolean(env.PAYMENT_QUEUE_ENABLED, FEATURE_FLAG_DEFAULTS.paymentQueueEnabled),
  hybridRetrievalCacheEnabled: parseBoolean(
    env.HYBRID_RETRIEVAL_CACHE_ENABLED,
    FEATURE_FLAG_DEFAULTS.hybridRetrievalCacheEnabled
  ),
  redisCacheEnabled: parseBoolean(env.REDIS_CACHE_ENABLED, FEATURE_FLAG_DEFAULTS.redisCacheEnabled),
  authSessionTrackingEnabled: parseBoolean(
    env.AUTH_SESSION_TRACKING_ENABLED,
    FEATURE_FLAG_DEFAULTS.authSessionTrackingEnabled
  ),
  authRefreshEnabled: parseBoolean(env.AUTH_REFRESH_ENABLED, FEATURE_FLAG_DEFAULTS.authRefreshEnabled),
  authSecurityAlertsEnabled: parseBoolean(
    env.AUTH_SECURITY_ALERTS_ENABLED,
    FEATURE_FLAG_DEFAULTS.authSecurityAlertsEnabled
  ),
  enterpriseRbacEnabled: parseBoolean(
    env.ENTERPRISE_RBAC_ENABLED,
    FEATURE_FLAG_DEFAULTS.enterpriseRbacEnabled
  ),
  enterpriseTenantHeadersEnabled: parseBoolean(
    env.ENTERPRISE_TENANT_HEADERS_ENABLED,
    FEATURE_FLAG_DEFAULTS.enterpriseTenantHeadersEnabled
  ),
  enterpriseEnhancedAuditEnabled: parseBoolean(
    env.ENTERPRISE_ENHANCED_AUDIT_ENABLED,
    FEATURE_FLAG_DEFAULTS.enterpriseEnhancedAuditEnabled
  ),
});

export const buildRuntimeConfig = (env = process.env) => {
  const nodeEnv = sanitizeString(env.NODE_ENV) || "development";
  const isProduction = nodeEnv === "production";
  const strictValidation = parseBoolean(env.CONFIG_STRICT_VALIDATION, false);
  const siteUrl =
    sanitizeUrl(env.FRONTEND_URL) ||
    sanitizeUrl(env.CLIENT_URL) ||
    sanitizeUrl(env.APP_URL) ||
    DEFAULT_SITE_URL;
  const features = buildFeatureFlags(env);

  const app = {
    name: sanitizeString(env.APP_NAME) || "nritax-server",
    nodeEnv,
    isProduction,
    strictValidation,
    port: Math.max(parseNumber(env.PORT, 5000), 1),
    version: sanitizeString(env.APP_VERSION) || "dev",
    commit: sanitizeString(env.APP_COMMIT) || "unknown",
    region: sanitizeString(env.APP_REGION) || sanitizeString(env.RENDER_REGION) || "unknown",
    runtime: sanitizeString(env.APP_RUNTIME) || "nodejs",
    jsonBodyLimit: sanitizeString(env.JSON_BODY_LIMIT) || "5mb",
    globalRateLimitPerMin: Math.max(parseNumber(env.GLOBAL_RATE_LIMIT_PER_MIN, 120), 1),
    allowedOrigins: unique([...DEFAULT_ALLOWED_ORIGINS, ...parseList(env.ALLOWED_ORIGINS)]),
  };

  const branding = {
    companyLegalName: COMPANY_LEGAL_NAME,
    companyShortName: COMPANY_SHORT_NAME,
    companySupportTeamName: COMPANY_SUPPORT_TEAM_NAME,
    platformBrandName: "NRITAX.AI",
    supportEmail: sanitizeString(env.SUPPORT_EMAIL) || "ask@nritax.ai",
    adminEmail: sanitizeString(env.ADMIN_EMAIL) || "admin@nritax.ai",
    appSiteUrl: siteUrl,
    defaultFromEmail:
      sanitizeString(env.RESEND_FROM_EMAIL) || `${COMPANY_SHORT_NAME} <noreply@mail.nritax.ai>`,
    openRouterAppTitle: sanitizeString(env.OPENROUTER_APP_NAME) || COMPANY_LEGAL_NAME,
  };

  const policies = {
    currentVersion: sanitizeString(env.CURRENT_POLICY_VERSION) || "2026-05-20",
  };

  const urls = {
    siteUrl,
    consultationWebhookUrl: sanitizeUrl(env.CONSULTATION_WEBHOOK_URL) || DEFAULT_CONSULTATION_WEBHOOK_URL,
    yuktiWebhookUrl: sanitizeUrl(env.YUKTI_WEBHOOK_URL) || DEFAULT_YUKTI_WEBHOOK_URL,
    resendApiUrl: sanitizeUrl(env.RESEND_API_URL) || DEFAULT_RESEND_API_URL,
    openRouterApiUrl: sanitizeUrl(env.OPENROUTER_API_URL) || DEFAULT_OPENROUTER_API_URL,
    geminiApiBaseUrl: sanitizeUrl(env.GEMINI_API_BASE_URL) || DEFAULT_GEMINI_API_BASE_URL,
    apiBaseUrl: sanitizeUrl(env.API_URL) || "",
  };

  const ai = {
    openRouter: {
      apiKey: sanitizeString(env.OPENROUTER_API_KEY),
      apiUrl: urls.openRouterApiUrl,
      referer: sanitizeUrl(env.OPENROUTER_SITE_URL) || siteUrl,
      appTitle: sanitizeString(env.OPENROUTER_APP_NAME) || "NRI Tax AI",
      timeoutMs: Math.max(parseNumber(env.OPENROUTER_TIMEOUT_MS, 20000), 5000),
      defaultModel: sanitizeString(env.OPENROUTER_MODEL) || "anthropic/claude-3.5-sonnet",
      geminiModel: sanitizeString(env.OPENROUTER_GEMINI_MODEL) || "google/gemini-2.0-flash-001",
    },
    gemini: {
      apiKey:
        sanitizeString(env.GEMINI_API_KEY) ||
        sanitizeString(env.GOOGLE_API_KEY) ||
        sanitizeString(env.GEMINI_KEY),
      apiBaseUrl: urls.geminiApiBaseUrl,
      model: sanitizeString(env.GEMINI_MODEL) || "gemini-1.5-pro",
      embedModel: sanitizeString(env.GEMINI_EMBED_MODEL) || "text-embedding-004",
      timeoutMs: Math.max(parseNumber(env.GEMINI_TIMEOUT_MS, 20000), 5000),
      embedTimeoutMs: Math.max(parseNumber(env.HYBRID_GEMINI_EMBED_TIMEOUT_MS, 4000), 1000),
    },
    ollama: {
      baseUrl: sanitizeUrl(env.OLLAMA_BASE_URL) || DEFAULT_OLLAMA_BASE_URL,
      model: sanitizeString(env.OLLAMA_MODEL) || "llama3.1:8b-instruct-q4_K_M",
      timeoutMs: Math.max(parseNumber(env.OLLAMA_TIMEOUT_MS, 12000), 3000),
    },
    routing: {
      timeoutThresholdMs: Math.max(parseNumber(env.AI_ROUTER_TIMEOUT_THRESHOLD_MS, 12000), 3000),
      smallModel: sanitizeString(env.AI_GATEWAY_SMALL_MODEL) || "google/gemini-2.0-flash-001",
      mediumModel:
        sanitizeString(env.AI_GATEWAY_MEDIUM_MODEL) ||
        sanitizeString(env.OPENROUTER_MODEL) ||
        "anthropic/claude-3.5-sonnet",
      largeModel:
        sanitizeString(env.AI_GATEWAY_LARGE_MODEL) ||
        sanitizeString(env.OPENROUTER_MODEL) ||
        "anthropic/claude-3.5-sonnet",
      ollamaModel: sanitizeString(env.AI_GATEWAY_OLLAMA_MODEL) || sanitizeString(env.OLLAMA_MODEL),
      defaultMaxTokens: Math.max(parseNumber(env.CHAT_MAX_TOKENS, 768), 128),
      defaultTemperature: 0.3,
    },
  };

  ai.openRouter.fallbackModels = unique([
    ai.openRouter.defaultModel,
    "openai/gpt-4o",
    "meta-llama/llama-3.1-70b-instruct",
  ]);

  const paymentCountryKeys = {
    india: Object.freeze(["india", "in", "bharat"]),
    karnataka: Object.freeze(["karnataka", "ka"]),
  };

  const payments = {
    provider: "razorpay",
    razorpay: {
      keyId: sanitizeString(env.RAZORPAY_KEY_ID),
      keySecret: sanitizeString(env.RAZORPAY_KEY_SECRET),
      webhookSecret: sanitizeString(env.RAZORPAY_WEBHOOK_SECRET),
      proPlanId: sanitizeString(env.RAZORPAY_PRO_PLAN_ID),
    },
    displayCurrencies: Object.freeze(["INR", "USD", "SGD", "IDR", "GBP", "AED", "CAD"]),
    chargeCurrencies: Object.freeze(["INR"]),
    supportedPricingCountries: Object.freeze(["IN", "US", "GB", "AE", "SG", "CA", "AU"]),
    countryKeys: paymentCountryKeys,
    taxRules: Object.freeze({
      domesticStateCode: "KA",
      domesticStateName: "Karnataka",
      domesticTaxRate: 18,
      intraState: Object.freeze({
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 0,
      }),
      interState: Object.freeze({
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 18,
      }),
    }),
  };

  return {
    app,
    branding,
    policies,
    urls,
    ai,
    payments,
    features,
    country: {
      defaultCountryCode: DEFAULT_COUNTRY_CODE,
      rules: COUNTRY_RULES,
      checkoutDisplayCurrencyMatrix: CHECKOUT_DISPLAY_CURRENCY_MATRIX,
    },
  };
};

export const validateRuntimeConfig = (config) => {
  const errors = [];
  const warnings = [];

  if (!sanitizeString(config?.app?.name)) {
    errors.push("APP_NAME resolved to an empty value.");
  }

  if (!sanitizeString(config?.branding?.supportEmail)) {
    errors.push("SUPPORT_EMAIL resolved to an empty value.");
  }

  if (!sanitizeString(config?.urls?.siteUrl)) {
    errors.push("A site URL could not be resolved from FRONTEND_URL/CLIENT_URL/APP_URL.");
  }

  if (!sanitizeString(config?.payments?.razorpay?.keyId) || !sanitizeString(config?.payments?.razorpay?.keySecret)) {
    warnings.push("Razorpay API credentials are missing; payment checkout endpoints will not work.");
  }

  if (!sanitizeString(config?.payments?.razorpay?.webhookSecret)) {
    warnings.push("RAZORPAY_WEBHOOK_SECRET is missing; webhook verification will be unavailable.");
  }

  if (!sanitizeString(process.env.JWT_SECRET)) {
    warnings.push("JWT_SECRET is missing; authenticated API flows will fail.");
  }

  if (!sanitizeString(process.env.MONGO_URI)) {
    warnings.push("MONGO_URI is missing; database connectivity will fail.");
  }

  if (!sanitizeString(config?.ai?.openRouter?.apiKey) && !sanitizeString(config?.ai?.gemini?.apiKey)) {
    warnings.push("No AI provider key is configured; AI chat and retrieval embeddings may fail.");
  }

  return {
    errors,
    warnings,
    valid: errors.length === 0,
  };
};

export const appConfig = buildRuntimeConfig(process.env);

export const assertRuntimeConfig = ({ strict = appConfig.app.strictValidation } = {}) => {
  const validation = validateRuntimeConfig(appConfig);
  if (validation.errors.length) {
    throw new Error(`Configuration validation failed: ${validation.errors.join(" | ")}`);
  }

  if (validation.warnings.length) {
    const message = `Configuration warnings: ${validation.warnings.join(" | ")}`;
    if (strict) {
      throw new Error(message);
    }
    console.warn(message);
  }

  return validation;
};
