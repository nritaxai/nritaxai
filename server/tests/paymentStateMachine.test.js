import test from "node:test";
import assert from "node:assert/strict";
import { calculateSubscriptionWindow, isDuplicateSuccessfulCharge } from "../services/paymentStateMachine.js";

test("calculateSubscriptionWindow advances one month for monthly billing", () => {
  const start = new Date("2026-05-14T00:00:00.000Z");
  const { startDate, endDate } = calculateSubscriptionWindow({ start, billing: "monthly" });

  assert.equal(startDate.toISOString(), "2026-05-14T00:00:00.000Z");
  assert.equal(endDate.getUTCMonth(), 5);
});

test("isDuplicateSuccessfulCharge detects second payment id on verified attempt", () => {
  const result = isDuplicateSuccessfulCharge({
    existingAttempt: {
      status: "verified",
      paymentId: "pay_old",
    },
    paymentId: "pay_new",
  });

  assert.equal(result, true);
});
