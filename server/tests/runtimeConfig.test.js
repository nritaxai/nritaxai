import test from "node:test";
import assert from "node:assert/strict";

import { buildRuntimeConfig, validateRuntimeConfig } from "../Config/runtimeConfig.js";

test("buildRuntimeConfig provides production-safe defaults and centralized fallbacks", () => {
  const config = buildRuntimeConfig({
    NODE_ENV: "development",
    FRONTEND_URL: "https://example.com/",
    OPENROUTER_API_KEY: "or-key",
    GEMINI_API_KEY: "gem-key",
    RAZORPAY_KEY_ID: "rzp_key",
    RAZORPAY_KEY_SECRET: "rzp_secret",
    RAZORPAY_WEBHOOK_SECRET: "rzp_webhook",
  });

  assert.equal(config.branding.appSiteUrl, "https://example.com");
  assert.equal(config.urls.openRouterApiUrl, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(config.ai.openRouter.apiKey, "or-key");
  assert.equal(config.ai.gemini.apiKey, "gem-key");
  assert.equal(config.payments.razorpay.keyId, "rzp_key");
  assert.deepEqual(config.country.checkoutDisplayCurrencyMatrix.US, ["USD", "INR"]);
  assert.equal(config.features.aiGatewayEnabled, true);
});

test("validateRuntimeConfig reports missing operational secrets without hardcoding callers", () => {
  const config = buildRuntimeConfig({
    NODE_ENV: "development",
    FRONTEND_URL: "https://example.com",
  });

  const validation = validateRuntimeConfig(config);

  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some((item) => item.includes("Razorpay API credentials")));
  assert.ok(validation.warnings.some((item) => item.includes("No AI provider key")));
});
