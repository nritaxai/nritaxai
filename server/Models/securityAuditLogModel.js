import mongoose from "mongoose";

const securityAuditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["auth", "privacy", "payment", "webhook", "secret", "access", "security"],
      default: "security",
      index: true,
    },
    status: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      default: "info",
      index: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
      index: true,
    },
    requestId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    tenantId: {
      type: String,
      trim: true,
      default: "public",
      index: true,
    },
    actorRoles: {
      type: [String],
      default: [],
    },
    actorEmailHash: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    actorIpHash: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    message: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

securityAuditLogSchema.index({ category: 1, createdAt: -1 });
securityAuditLogSchema.index({ severity: 1, createdAt: -1 });
securityAuditLogSchema.index({ tenantId: 1, createdAt: -1 });

const SecurityAuditLog = mongoose.model("SecurityAuditLog", securityAuditLogSchema);
export default SecurityAuditLog;
