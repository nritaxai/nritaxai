import { featureFlags } from "../Config/featureFlags.js";
import { writeSecurityAuditLog } from "./securityAudit.js";

export const ROLE_DEFINITIONS = {
  end_user: ["chat:use", "profile:read", "profile:write", "subscription:read"],
  support: ["chat:read", "users:read", "audit:read", "analytics:read", "sessions:read"],
  tax_expert: ["chat:read", "consultation:read", "consultation:write", "documents:read", "documents:write"],
  finance: ["payments:read", "payments:write", "audit:read", "analytics:read"],
  admin: [
    "chat:use",
    "chat:read",
    "users:read",
    "users:write",
    "audit:read",
    "analytics:read",
    "payments:read",
    "payments:write",
    "consultation:read",
    "consultation:write",
    "documents:read",
    "documents:write",
    "sessions:read",
    "sessions:write",
    "platform:admin",
  ],
};

const DEFAULT_ROLE = "end_user";

const normalizeRole = (role = "") => String(role || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");

export const resolveUserRoles = (user = null) => {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const normalized = roles.map(normalizeRole).filter(Boolean);
  return normalized.length ? Array.from(new Set(normalized)) : [DEFAULT_ROLE];
};

export const resolvePermissionsForRoles = (roles = []) =>
  Array.from(
    new Set(
      roles.flatMap((role) => ROLE_DEFINITIONS[normalizeRole(role)] || [])
    )
  );

const sanitizeTenantValue = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "")
    .slice(0, 120);

export const buildEnterpriseContext = ({ req = null, user = null } = {}) => {
  const headerTenantId = featureFlags.enterpriseTenantHeadersEnabled
    ? sanitizeTenantValue(req?.headers?.["x-tenant-id"] || req?.headers?.["x-tenant-key"])
    : "";
  const userTenantId = sanitizeTenantValue(user?.tenantId || user?.organizationId || "");
  const tenantId = userTenantId || headerTenantId || "public";
  const roles = resolveUserRoles(user);
  const permissions = resolvePermissionsForRoles(roles);

  return {
    tenantId,
    roles,
    permissions,
    subjectType: user?._id ? "user" : "anonymous",
  };
};

export const attachEnterpriseContext = (req, user = null) => {
  const context = buildEnterpriseContext({ req, user });
  req.tenantContext = {
    tenantId: context.tenantId,
  };
  req.authz = {
    roles: context.roles,
    permissions: context.permissions,
    subjectType: context.subjectType,
  };
  return context;
};

const hasAllPermissions = (available = [], required = []) => {
  const availableSet = new Set((available || []).map((item) => String(item || "")));
  return (required || []).every((permission) => availableSet.has(String(permission || "")));
};

const hasAnyRole = (available = [], required = []) => {
  const availableSet = new Set((available || []).map((item) => String(item || "")));
  return (required || []).some((role) => availableSet.has(String(role || "")));
};

export const requirePermissions = (requiredPermissions = []) => async (req, res, next) => {
  if (!featureFlags.enterpriseRbacEnabled) return next();

  const required = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  const authz = req.authz || attachEnterpriseContext(req, req.user || null);
  if (hasAllPermissions(authz.permissions, required)) return next();

  await writeSecurityAuditLog({
    req,
    actorUserId: req.user?._id || null,
    action: "authorization.permission_denied",
    category: "access",
    status: "warning",
    severity: "medium",
    message: "Permission check failed for protected route.",
    metadata: {
      requiredPermissions: required,
      actorRoles: authz.roles,
      tenantId: req.tenantContext?.tenantId || "public",
      route: req.originalUrl,
      method: req.method,
    },
  });

  return res.status(403).json({
    success: false,
    message: "Insufficient permissions.",
  });
};

export const requireRoles = (requiredRoles = []) => async (req, res, next) => {
  if (!featureFlags.enterpriseRbacEnabled) return next();

  const required = Array.isArray(requiredRoles) ? requiredRoles.map(normalizeRole) : [normalizeRole(requiredRoles)];
  const authz = req.authz || attachEnterpriseContext(req, req.user || null);
  if (hasAnyRole(authz.roles, required)) return next();

  await writeSecurityAuditLog({
    req,
    actorUserId: req.user?._id || null,
    action: "authorization.role_denied",
    category: "access",
    status: "warning",
    severity: "medium",
    message: "Role check failed for protected route.",
    metadata: {
      requiredRoles: required,
      actorRoles: authz.roles,
      tenantId: req.tenantContext?.tenantId || "public",
      route: req.originalUrl,
      method: req.method,
    },
  });

  return res.status(403).json({
    success: false,
    message: "Insufficient role access.",
  });
};
