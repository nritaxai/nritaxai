import razorpay from "../../Config/razorpay.js";
import User from "../../Models/userModel.js";
import {
  appendPaymentAuditLog,
  getPaymentAttemptByOrderId,
  markPaymentAttemptFailed,
  markPaymentAttemptReconciled,
  markPaymentVerified,
} from "../../services/paymentReliability.js";
import { applyPaidSubscriptionState } from "../../services/paymentStateMachine.js";

export const processPaymentReconciliation = async (payload) => {
  const orderId = String(payload?.orderId || "").trim();
  if (!orderId) {
    return { skipped: true, reason: "missing_order_id" };
  }

  const attempt = await getPaymentAttemptByOrderId({ provider: "razorpay", orderId });
  if (!attempt) {
    return { skipped: true, reason: "attempt_not_found" };
  }

  let order = null;
  try {
    order = await razorpay.orders.fetch(orderId);
  } catch (error) {
    await markPaymentAttemptFailed({
      provider: "razorpay",
      orderId,
      paymentId: attempt.paymentId || "",
      userId: attempt.user?.toString?.() || "",
      failureCode: "reconcile_fetch_failed",
      message: error?.message || String(error),
      metadata: { source: "worker.reconcile" },
    });
    throw error;
  }

  const userId = attempt.user?.toString?.() || String(payload?.userId || "").trim();
  const user = userId ? await User.findById(userId) : null;
  const billing = String(order?.notes?.billing || attempt.billing || "monthly").toLowerCase();

  if (user && (attempt.paymentId || payload?.paymentId)) {
    applyPaidSubscriptionState({
      user,
      orderId,
      billing,
      provider: "razorpay",
    });
    await user.save();
    await markPaymentVerified({
      provider: "razorpay",
      orderId,
      paymentId: attempt.paymentId || payload?.paymentId || "",
      userId: user._id,
      metadata: {
        source: "worker.reconcile",
        billing,
      },
    });
  }

  await markPaymentAttemptReconciled({
    provider: "razorpay",
    orderId,
    subscriptionId: String(payload?.subscriptionId || attempt.subscriptionId || ""),
    lifecycleStatus: "active",
    metadata: {
      source: "worker.reconcile",
      billing,
      orderStatus: String(order?.status || ""),
    },
  });

  await appendPaymentAuditLog({
    provider: "razorpay",
    action: "payment_reconciled",
    status: "success",
    orderId,
    paymentId: attempt.paymentId || payload?.paymentId || "",
    subscriptionId: String(payload?.subscriptionId || attempt.subscriptionId || ""),
    userId,
    message: "Payment reconciliation completed successfully.",
    metadata: {
      source: "worker.reconcile",
      billing,
      orderStatus: String(order?.status || ""),
    },
  });

  return {
    reconciled: true,
    orderId,
    billing,
    userId,
  };
};
