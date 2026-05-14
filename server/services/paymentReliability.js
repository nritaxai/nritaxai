import crypto from "crypto";
import PaymentAttempt from "../Models/paymentAttemptModel.js";
import PaymentEvent from "../Models/paymentEventModel.js";

const sha256 = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

const normalizeText = (value) => String(value || "").trim();

export const buildPaymentEventKey = ({ eventType = "", subscriptionId = "", paymentId = "", orderId = "" }) =>
  [eventType, subscriptionId, paymentId, orderId].map((item) => normalizeText(item) || "na").join(":");

export const createSignatureHash = (signature = "") => sha256(signature);

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
        signatureHash: createSignatureHash(signature),
        metadata,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

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
