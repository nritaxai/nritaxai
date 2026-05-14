import mongoose from "mongoose";

const paymentEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
      default: "razorpay",
    },
    eventKey: {
      type: String,
      required: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    signatureValid: {
      type: Boolean,
      default: false,
    },
    payloadHash: {
      type: String,
      trim: true,
      default: "",
    },
    orderId: {
      type: String,
      trim: true,
      default: null,
    },
    paymentId: {
      type: String,
      trim: true,
      default: null,
    },
    subscriptionId: {
      type: String,
      trim: true,
      default: null,
    },
    userId: {
      type: String,
      trim: true,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    deliveryCount: {
      type: Number,
      default: 1,
    },
    duplicateDelivery: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastError: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

paymentEventSchema.index({ provider: 1, eventKey: 1 }, { unique: true });
paymentEventSchema.index({ provider: 1, processedAt: 1, createdAt: -1 });
paymentEventSchema.index({ provider: 1, eventType: 1, createdAt: -1 });

const PaymentEvent = mongoose.model("PaymentEvent", paymentEventSchema);
export default PaymentEvent;
