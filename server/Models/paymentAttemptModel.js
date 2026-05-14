import mongoose from "mongoose";

const paymentAttemptSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
      default: "razorpay",
    },
    orderId: {
      type: String,
      required: true,
      trim: true,
    },
    paymentId: {
      type: String,
      trim: true,
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    planKey: {
      type: String,
      trim: true,
      default: "",
    },
    billing: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      trim: true,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["created", "verified", "failed", "reconciled", "cancelled"],
      default: "created",
      index: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    lastVerificationAttemptAt: {
      type: Date,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
    recoveryStatus: {
      type: String,
      enum: ["none", "pending", "recovered", "manual_review"],
      default: "none",
      index: true,
    },
    failureCode: {
      type: String,
      trim: true,
      default: "",
    },
    lifecycleStatus: {
      type: String,
      trim: true,
      default: "created",
    },
    subscriptionId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    signatureHash: {
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

paymentAttemptSchema.index({ provider: 1, orderId: 1 }, { unique: true });
paymentAttemptSchema.index({ user: 1, planKey: 1, billing: 1, status: 1, createdAt: -1 });
paymentAttemptSchema.index({ provider: 1, recoveryStatus: 1, nextRetryAt: 1 });

const PaymentAttempt = mongoose.model("PaymentAttempt", paymentAttemptSchema);
export default PaymentAttempt;
