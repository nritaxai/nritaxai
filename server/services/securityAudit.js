import SecurityAuditLog from "../Models/securityAuditLogModel.js";
import { featureFlags } from "../Config/featureFlags.js";
import { hashValue, maskEmail, redactObject } from "./dataProtection.js";
import { logger } from "./logger.js";
import { recordSecurityEvent } from "./metrics.js";

const getIp = (req) =>
  String(
    req?.headers?.["x-forwarded-for"] ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      ""
  )
    .split(",")[0]
    .trim();

export const writeSecurityAuditLog = async ({
  req = null,
  actorUserId = null,
  actorEmail = "",
  action = "security.event",
  category = "security",
  status = "info",
  severity = "low",
  message = "",
  metadata = {},
} = {}) => {
  const safePayload = {
    actorUserId: actorUserId || req?.user?._id || null,
    action,
    category,
    status,
    severity,
    requestId: String(req?.requestId || ""),
    actorEmailHash: actorEmail ? hashValue(actorEmail) : req?.user?.email ? hashValue(req.user.email) : "",
    actorIpHash: hashValue(getIp(req)),
    message: String(message || "").slice(0, 2000),
    metadata: redactObject(metadata),
  };

  if (featureFlags.enterpriseEnhancedAuditEnabled) {
    safePayload.tenantId = String(req?.tenantContext?.tenantId || metadata?.tenantId || "public").slice(0, 120);
    safePayload.actorRoles = Array.isArray(req?.authz?.roles)
      ? req.authz.roles.map((role) => String(role || "").slice(0, 64))
      : [];
  }

  recordSecurityEvent({ category, severity, status });

  try {
    return await SecurityAuditLog.create(safePayload);
  } catch (error) {
    logger.warn(
      {
        action,
        category,
        status,
        severity,
        actorEmail: maskEmail(actorEmail || req?.user?.email || ""),
        error: error?.message || String(error),
      },
      "security audit persistence failed"
    );
    return null;
  }
};
