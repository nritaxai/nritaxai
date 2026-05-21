import test from "node:test";
import assert from "node:assert/strict";
import { maskEmail, maskPhone, redactObject, redactText } from "../services/dataProtection.js";
import { createWebhookSignatureHeaders, timingSafeEqualHex } from "../services/webhookSecurity.js";

test("redactText removes common PII and token-like values", () => {
  const input = "Email me at user@example.com, call +1 415 555 0101, PAN ABCDE1234F, token sk_live_123456789";
  const output = redactText(input);

  assert.match(output, /\[REDACTED_EMAIL\]/);
  assert.match(output, /\[REDACTED_PHONE\]/);
  assert.match(output, /\[REDACTED_PAN\]/);
  assert.match(output, /\[REDACTED_TOKEN\]/);
});

test("redactObject masks nested secrets and contact fields", () => {
  const output = redactObject({
    email: "user@example.com",
    phone: "+14155550101",
    nested: {
      apiSecret: "super-secret",
    },
  });

  assert.equal(output.email.includes("@"), true);
  assert.equal(output.phone.startsWith("***"), true);
  assert.equal(output.nested.apiSecret, "[REDACTED_SECRET]");
});

test("webhook security headers are emitted only when a secret is configured", () => {
  const empty = createWebhookSignatureHeaders({ payload: "{}", secret: "" });
  assert.deepEqual(empty, {});

  const headers = createWebhookSignatureHeaders({ payload: "{\"ok\":true}", secret: "abc123", source: "test" });
  assert.ok(headers["x-nritax-signature"]);
  assert.ok(headers["x-nritax-timestamp"]);
  assert.equal(headers["x-nritax-source"], "test");
});

test("timingSafeEqualHex compares equal-length signature strings safely", () => {
  assert.equal(timingSafeEqualHex("abcdef", "abcdef"), true);
  assert.equal(timingSafeEqualHex("abcdef", "abcdeg"), false);
  assert.equal(timingSafeEqualHex("abc", "abcd"), false);
});

test("mask helpers preserve only minimal identifying suffixes", () => {
  assert.match(maskEmail("user@example.com"), /^us\*\*\*@\*\*\*/);
  assert.equal(maskPhone("+1 415 555 0101"), "***01");
});
