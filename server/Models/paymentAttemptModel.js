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
      enum: ["created", "verified", "failed"],
      default: "created",
    },
    verifiedAt: {
      type: Date,
      default: null,
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

const PaymentAttempt = mongoose.model("PaymentAttempt", paymentAttemptSchema);
export default PaymentAttempt;
