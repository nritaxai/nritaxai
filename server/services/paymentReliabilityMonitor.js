import PaymentAttempt from "../Models/paymentAttemptModel.js";
import PaymentAuditLog from "../Models/paymentAuditLogModel.js";
import PaymentEvent from "../Models/paymentEventModel.js";

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000);

export const getPaymentReliabilitySummary = async () => {
  const [failedAttempts, pendingRecovery, recentAuditErrors, delayedWebhooks, mismatchedSubscriptions, duplicateDeliveries] =
    await Promise.all([
      PaymentAttempt.countDocuments({
        status: "failed",
        createdAt: { $gte: minutesAgo(24 * 60) },
      }),
      PaymentAttempt.countDocuments({
        recoveryStatus: { $in: ["pending", "manual_review"] },
      }),
      PaymentAuditLog.countDocuments({
        status: "error",
        createdAt: { $gte: minutesAgo(24 * 60) },
      }),
      PaymentEvent.countDocuments({
        processedAt: null,
        createdAt: { $lte: minutesAgo(Number(process.env.PAYMENT_WEBHOOK_DELAY_THRESHOLD_MINUTES || 10)) },
      }),
      PaymentAttempt.countDocuments({
        status: "verified",
        lifecycleStatus: { $in: ["created", "pending", "halted", "paused", "expired"] },
      }),
      PaymentEvent.countDocuments({
        duplicateDelivery: true,
        createdAt: { $gte: minutesAgo(24 * 60) },
      }),
    ]);

  return {
    failedAttempts,
    pendingRecovery,
    recentAuditErrors,
    delayedWebhooks,
    mismatchedSubscriptions,
    duplicateDeliveries,
  };
};
