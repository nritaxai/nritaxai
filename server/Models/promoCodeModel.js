import mongoose from "mongoose";

const promoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    kind: {
      type: String,
      enum: ["free_month"],
      default: "free_month",
    },
    planKey: {
      type: String,
      enum: ["professional"],
      default: "professional",
    },
    billing: {
      type: String,
      enum: ["monthly"],
      default: "monthly",
    },
    status: {
      type: String,
      enum: ["active", "redeemed", "disabled"],
      default: "active",
      index: true,
    },
    description: {
      type: String,
      default: "1 month free on Professional monthly plan",
      trim: true,
    },
    batchLabel: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: String,
      default: "system",
      trim: true,
    },
    redeemedAt: {
      type: Date,
      default: null,
    },
    redeemedByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    redeemedByEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    redemptionContext: {
      type: String,
      default: "free_checkout",
      trim: true,
    },
    redemptionOrderId: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

promoCodeSchema.index({ status: 1, createdAt: -1 });

const PromoCode = mongoose.model("PromoCode", promoCodeSchema);

export default PromoCode;
