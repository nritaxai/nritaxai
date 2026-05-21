import mongoose from "mongoose";

const privacyRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["delete_account", "export_data", "consent_update"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["received", "processing", "completed", "failed"],
      default: "received",
      index: true,
    },
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    emailHash: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    processedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

privacyRequestSchema.index({ type: 1, createdAt: -1 });

const PrivacyRequest = mongoose.model("PrivacyRequest", privacyRequestSchema);
export default PrivacyRequest;
