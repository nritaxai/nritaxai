import crypto from "crypto";
import PaymentAttempt from "../Models/paymentAttemptModel.js";
import PaymentAuditLog from "../Models/paymentAuditLogModel.js";
import PaymentEvent from "../Models/paymentEventModel.js";
import { PAYMENT_LIFECYCLE_STATE, PAYMENT_RECOVERY_STATUS } from "./paymentStateMachine.js";

const sha256 = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

const normalizeText = (value) => String(value || "").trim();

export const buildPaymentEventKey = ({ eventType = "", subscriptionId = "", paymentId = "", orderId = "" }) =>
  [eventType, subscriptionId, paymentId, orderId].map((item) => normalizeText(item) || "na").join(":");

export const createSignatureHash = (signature = "") => sha256(signature);

export const appendPaymentAuditLog = async ({
  provider = "razorpay",
  action = "",
  status = "info",
  orderId = "",
  paymentId = "",
  subscriptionId = "",
  userId = "",
  message = "",
  metadata = {},
}) =>
  PaymentAuditLog.create({
    provider,
    action,
    status,
    orderId,
    paymentId,
    subscriptionId,
    userId,
    message,
    metadata,
  });

export const recordPaymentOrder = async ({
  provider = "razorpay",
  orderId,
  userId,
  planKey = "",
  billing = "",
  amount = 0,
  currency = "INR",
  metadata = {},
}) => {
  if (!orderId) return null;

  return PaymentAttempt.findOneAndUpdate(
    { provider, orderId },
    {
      $setOnInsert: {
        provider,
        orderId,
        user: userId || null,
        planKey,
        billing,
        amount,
        currency,
        lifecycleStatus: PAYMENT_LIFECYCLE_STATE.CREATED,
        metadata,
      },
      $set: {
        user: userId || null,
        planKey,
        billing,
        amount,
        currency,
        metadata,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const getPaymentAttemptByOrderId = async ({ provider = "razorpay", orderId }) => {
  if (!orderId) return null;
  return PaymentAttempt.findOne({ provider, orderId });
};

export const findReusablePaymentAttempt = async ({
  provider = "razorpay",
  userId,
  planKey = "",
  billing = "",
  amount = 0,
  currency = "INR",
  freshnessMinutes = Number(process.env.PAYMENT_ORDER_REUSE_MINUTES || 15),
}) => {
  if (!userId) return null;
  const freshnessDate = new Date(Date.now() - freshnessMinutes * 60 * 1000);

  return PaymentAttempt.findOne({
    provider,
    user: userId,
    planKey,
    billing,
    amount,
    currency,
    status: "created",
    createdAt: { $gte: freshnessDate },
  }).sort({ createdAt: -1 });
};

export const markPaymentVerified = async ({
  provider = "razorpay",
  orderId,
  paymentId,
  userId,
  signature = "",
  metadata = {},
}) => {
  if (!orderId) return null;

  return PaymentAttempt.findOneAndUpdate(
    { provider, orderId },
    {
      $setOnInsert: {
        provider,
        orderId,
      },
      $set: {
        paymentId: paymentId || null,
        user: userId || null,
        status: "verified",
        verifiedAt: new Date(),
        lastVerificationAttemptAt: new Date(),
        recoveryStatus: PAYMENT_RECOVERY_STATUS.RECOVERED,
        lifecycleStatus: PAYMENT_LIFECYCLE_STATE.ACTIVE,
        signatureHash: createSignatureHash(signature),
        metadata,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const markPaymentAttemptFailed = async ({
  provider = "razorpay",
  orderId,
  paymentId = "",
  userId = "",
  failureCode = "",
  message = "",
  recoveryStatus = PAYMENT_RECOVERY_STATUS.PENDING,
  nextRetryAt = null,
  metadata = {},
}) => {
  if (!orderId) return null;

  return PaymentAttempt.findOneAndUpdate(
    { provider, orderId },
    {
      $setOnInsert: {
        provider,
        orderId,
      },
      $set: {
        paymentId: paymentId || null,
        user: userId || null,
        status: "failed",
        failureCode: failureCode || "",
        lastVerificationAttemptAt: new Date(),
        recoveryStatus,
        nextRetryAt: nextRetryAt || null,
        metadata: {
          ...(metadata && typeof metadata === "object" ? metadata : {}),
          failureMessage: message,
        },
      },
      $inc: {
        retryCount: 1,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const markPaymentAttemptReconciled = async ({
  provider = "razorpay",
  orderId,
  subscriptionId = "",
  lifecycleStatus = PAYMENT_LIFECYCLE_STATE.ACTIVE,
  metadata = {},
}) => {
  if (!orderId) return null;

  return PaymentAttempt.findOneAndUpdate(
    { provider, orderId },
    {
      $set: {
        status: "reconciled",
        subscriptionId,
        lifecycleStatus,
        recoveryStatus: PAYMENT_RECOVERY_STATUS.RECOVERED,
        metadata,
      },
    },
    { new: true }
  );
};

export const getRecoverablePaymentAttempts = async ({
  provider = "razorpay",
  limit = Number(process.env.PAYMENT_RECOVERY_SCAN_LIMIT || 50),
}) =>
  PaymentAttempt.find({
    provider,
    recoveryStatus: { $in: [PAYMENT_RECOVERY_STATUS.PENDING, PAYMENT_RECOVERY_STATUS.MANUAL_REVIEW] },
    $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: new Date() } }],
  })
    .sort({ createdAt: 1 })
    .limit(limit);

export const recordPaymentEventDelivery = async ({
  provider = "razorpay",
  eventType = "",
  signatureValid = false,
  rawBody = "",
  orderId = "",
  paymentId = "",
  subscriptionId = "",
  userId = "",
  metadata = {},
}) => {
  const eventKey = buildPaymentEventKey({ eventType, subscriptionId, paymentId, orderId });
  const existing = await PaymentEvent.findOne({ provider, eventKey });

  if (existing) {
    existing.deliveryCount = Number(existing.deliveryCount || 0) + 1;
    existing.lastSeenAt = new Date();
    existing.signatureValid = existing.signatureValid || Boolean(signatureValid);
    existing.duplicateDelivery = existing.deliveryCount > 1;
    existing.metadata = {
      ...(existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    };
    await existing.save();
    return { event: existing, duplicate: Boolean(existing.processedAt) };
  }

  const event = await PaymentEvent.create({
    provider,
    eventKey,
    eventType,
    signatureValid,
    payloadHash: sha256(rawBody),
    orderId: orderId || null,
    paymentId: paymentId || null,
    subscriptionId: subscriptionId || null,
    userId: userId || null,
    metadata,
  });

  return { event, duplicate: false };
};

export const markPaymentEventProcessed = async ({ eventId, lastError = "" }) => {
  if (!eventId) return null;
  return PaymentEvent.findByIdAndUpdate(
    eventId,
    {
      $set: {
        processedAt: new Date(),
        acknowledgedAt: new Date(),
        lastError: lastError || "",
      },
    },
    { new: true }
  );
};

export const markPaymentEventFailed = async ({ eventId, lastError = "" }) => {
  if (!eventId) return null;
  return PaymentEvent.findByIdAndUpdate(
    eventId,
    {
      $set: {
        lastError: String(lastError || "").slice(0, 1000),
      },
    },
    { new: true }
  );
};
