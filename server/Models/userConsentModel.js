import mongoose from "mongoose";

const userConsentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    marketingEmails: {
      type: Boolean,
      default: false,
    },
    productUpdates: {
      type: Boolean,
      default: true,
    },
    analyticsTracking: {
      type: Boolean,
      default: true,
    },
    consultationDataProcessing: {
      type: Boolean,
      default: true,
    },
    termsAcceptedAt: {
      type: Date,
      default: null,
    },
    privacyPolicyAcceptedAt: {
      type: Date,
      default: null,
    },
    consentVersion: {
      type: String,
      trim: true,
      default: "2026-05",
    },
    consentSource: {
      type: String,
      trim: true,
      default: "web",
    },
  },
  { timestamps: true }
);

const UserConsent = mongoose.model("UserConsent", userConsentSchema);
export default UserConsent;
