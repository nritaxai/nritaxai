import test from "node:test";
import assert from "node:assert/strict";
import { buildPaymentEventKey, createSignatureHash } from "../services/paymentReliability.js";

test("buildPaymentEventKey is deterministic for duplicate webhook deliveries", () => {
  const payload = {
    eventType: "payment.captured",
    subscriptionId: "sub_123",
    paymentId: "pay_456",
    orderId: "order_789",
  };

  assert.equal(buildPaymentEventKey(payload), buildPaymentEventKey(payload));
});

test("createSignatureHash masks raw signatures in audit records", () => {
  const hash = createSignatureHash("secret-signature");

  assert.notEqual(hash, "secret-signature");
  assert.equal(hash.length, 64);
});
