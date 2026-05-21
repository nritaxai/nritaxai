import mongoose from "mongoose";

const authSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      default: "",
      index: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "apple", "linkedin", "unknown"],
      default: "unknown",
      index: true,
    },
    loginMethod: {
      type: String,
      trim: true,
      default: "password",
    },
    deviceLabel: {
      type: String,
      trim: true,
      default: "Unknown device",
    },
    deviceType: {
      type: String,
      trim: true,
      default: "unknown",
    },
    platform: {
      type: String,
      trim: true,
      default: "unknown",
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1024,
    },
    ipHash: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    authVersion: {
      type: Number,
      default: 2,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    refreshExpiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokedReason: {
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

authSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: -1 });
authSessionSchema.index({ userId: 1, lastSeenAt: -1 });
authSessionSchema.index({ refreshExpiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthSession = mongoose.model("AuthSession", authSessionSchema);
export default AuthSession;
