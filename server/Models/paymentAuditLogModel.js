import mongoose from "mongoose";

const paymentAuditLogSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
      default: "razorpay",
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      default: "info",
      index: true,
    },
    orderId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    paymentId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    subscriptionId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    userId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    message: {
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

paymentAuditLogSchema.index({ provider: 1, createdAt: -1 });
paymentAuditLogSchema.index({ action: 1, createdAt: -1 });

const PaymentAuditLog = mongoose.model("PaymentAuditLog", paymentAuditLogSchema);
export default PaymentAuditLog;
