import crypto from "crypto";
import jwt from "jsonwebtoken";
import AuthSession from "../Models/authSessionModel.js";
import SecurityAuditLog from "../Models/securityAuditLogModel.js";
import { logger } from "./logger.js";
import { hashValue, maskEmail } from "./dataProtection.js";
import { writeSecurityAuditLog } from "./securityAudit.js";
import { captureException } from "./monitoring.js";
import { recordAuthEvent, setAuthActiveSessionsMetric } from "./metrics.js";

const ACCESS_TOKEN_TTL = String(process.env.AUTH_ACCESS_TOKEN_TTL || "1d").trim();
const REFRESH_TOKEN_TTL_DAYS = Math.max(Number(process.env.AUTH_REFRESH_TOKEN_TTL_DAYS || 30), 1);
const SESSION_IDLE_TIMEOUT_MINUTES = Math.max(Number(process.env.AUTH_SESSION_IDLE_TIMEOUT_MINUTES || 60 * 24 * 30), 15);
const REFRESH_COOKIE_NAME = String(process.env.AUTH_REFRESH_COOKIE_NAME || "nritax_refresh_token").trim();
const SESSION_COOKIE_NAME = String(process.env.AUTH_SESSION_COOKIE_NAME || "nritax_session_id").trim();
const SUSPICIOUS_LOGIN_THRESHOLD = Math.max(Number(process.env.AUTH_SUSPICIOUS_LOGIN_THRESHOLD || 5), 3);
const SUSPICIOUS_LOGIN_WINDOW_MINUTES = Math.max(Number(process.env.AUTH_SUSPICIOUS_LOGIN_WINDOW_MINUTES || 15), 5);
const SESSION_ACTIVITY_UPDATE_WINDOW_MS = Math.max(Number(process.env.AUTH_SESSION_ACTIVITY_UPDATE_WINDOW_MS || 5 * 60 * 1000), 60 * 1000);

const durationPattern = /^(\d+)([smhd])$/i;

const getIp = (req) =>
  String(req?.headers?.["x-forwarded-for"] || req?.ip || req?.socket?.remoteAddress || "")
    .split(",")[0]
    .trim();

const addCookie = (res, value) => {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", [value]);
    return;
  }

  const nextCookies = Array.isArray(existing) ? [...existing, value] : [String(existing), value];
  res.setHeader("Set-Cookie", nextCookies);
};

const parseDurationMs = (value = ACCESS_TOKEN_TTL) => {
  const normalized = String(value || "").trim();
  const match = durationPattern.exec(normalized);
  if (!match) return 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

const parseCookies = (cookieHeader = "") =>
  String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return acc;
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});

const inferDeviceContext = (req) => {
  const userAgent = String(req?.headers?.["user-agent"] || "").trim();
  const ua = userAgent.toLowerCase();
  const deviceType = /mobile|iphone|android/.test(ua) ? "mobile" : /ipad|tablet/.test(ua) ? "tablet" : "desktop";
  const platform = ua.includes("android")
    ? "android"
    : ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")
      ? "ios"
      : ua.includes("mac os")
        ? "macos"
        : ua.includes("windows")
          ? "windows"
          : ua.includes("linux")
            ? "linux"
            : "unknown";
  const labelPrefix = deviceType === "mobile" ? "Mobile" : deviceType === "tablet" ? "Tablet" : "Browser";

  return {
    userAgent,
    deviceType,
    platform,
    deviceLabel: `${labelPrefix} on ${platform === "unknown" ? "unknown platform" : platform}`,
  };
};

const computeExpiryDate = (ttlMs) => new Date(Date.now() + ttlMs);

const hashRefreshToken = (value = "") => crypto.createHash("sha256").update(String(value)).digest("hex");
const createOpaqueToken = () => crypto.randomBytes(32).toString("base64url");
const createSessionId = () => crypto.randomBytes(18).toString("hex");

const buildCookie = ({ name, value, maxAgeSeconds, secure = false, httpOnly = true }) =>
  [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    httpOnly ? "HttpOnly" : null,
    "SameSite=Lax",
    secure ? "Secure" : null,
    `Max-Age=${Math.max(Number(maxAgeSeconds) || 0, 0)}`,
  ]
    .filter(Boolean)
    .join("; ");

export const getSessionCookieNames = () => ({
  refreshCookieName: REFRESH_COOKIE_NAME,
  sessionCookieName: SESSION_COOKIE_NAME,
});

export const issueAccessToken = ({ userId, sessionId = "", roles = [], tenantId = "public", expiresIn = ACCESS_TOKEN_TTL } = {}) =>
  jwt.sign(
    {
      id: userId,
      sid: sessionId || undefined,
      roles: Array.isArray(roles) ? roles : [],
      tenantId: String(tenantId || "public"),
      typ: "access",
      ver: sessionId ? 2 : 1,
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );

export const attachSessionCookies = ({ req, res, sessionId, refreshToken }) => {
  const isSecure = Boolean(req?.secure || String(req?.headers?.["x-forwarded-proto"] || "").includes("https"));
  addCookie(
    res,
    buildCookie({
      name: REFRESH_COOKIE_NAME,
      value: refreshToken,
      maxAgeSeconds: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      secure: isSecure,
      httpOnly: true,
    })
  );
  addCookie(
    res,
    buildCookie({
      name: SESSION_COOKIE_NAME,
      value: sessionId,
      maxAgeSeconds: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      secure: isSecure,
      httpOnly: false,
    })
  );
};

export const clearSessionCookies = ({ req, res }) => {
  const isSecure = Boolean(req?.secure || String(req?.headers?.["x-forwarded-proto"] || "").includes("https"));
  addCookie(
    res,
    buildCookie({
      name: REFRESH_COOKIE_NAME,
      value: "",
      maxAgeSeconds: 0,
      secure: isSecure,
      httpOnly: true,
    })
  );
  addCookie(
    res,
    buildCookie({
      name: SESSION_COOKIE_NAME,
      value: "",
      maxAgeSeconds: 0,
      secure: isSecure,
      httpOnly: false,
    })
  );
};

export const createSessionForUser = async ({ req, res, user, authProvider = "local", loginMethod = "password", metadata = {} } = {}) => {
  const deviceContext = inferDeviceContext(req);
  const sessionId = createSessionId();
  const refreshToken = createOpaqueToken();
  const accessTokenTtlMs = parseDurationMs(ACCESS_TOKEN_TTL);
  const refreshExpiry = computeExpiryDate(REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const accessExpiry = computeExpiryDate(accessTokenTtlMs);

  const session = await AuthSession.create({
    userId: user._id,
    sessionId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    authProvider,
    loginMethod,
    deviceLabel: deviceContext.deviceLabel,
    deviceType: deviceContext.deviceType,
    platform: deviceContext.platform,
    userAgent: deviceContext.userAgent,
    ipHash: hashValue(getIp(req)),
    expiresAt: refreshExpiry,
    refreshExpiresAt: refreshExpiry,
    lastSeenAt: new Date(),
    metadata,
  });

  const token = issueAccessToken({
    userId: user._id,
    sessionId,
    roles: user.roles || [],
    tenantId: user.tenantId || user.organizationId || "public",
  });

  attachSessionCookies({ req, res, sessionId, refreshToken });

  await writeSecurityAuditLog({
    req,
    actorUserId: user._id,
    actorEmail: user.email,
    action: "auth.session_created",
    category: "auth",
    status: "success",
    severity: "low",
    message: "Authentication session created.",
    metadata: {
      authProvider,
      loginMethod,
      sessionId,
      deviceType: deviceContext.deviceType,
      platform: deviceContext.platform,
    },
  });

  recordAuthEvent({ action: "session_created", status: "success", provider: authProvider });
  const activeCount = await AuthSession.countDocuments({ authProvider, revokedAt: null, refreshExpiresAt: { $gt: new Date() } });
  setAuthActiveSessionsMetric({ provider: authProvider, count: activeCount });

  return {
    token,
    session,
    refreshToken,
    accessTokenExpiresAt: accessExpiry,
    refreshTokenExpiresAt: refreshExpiry,
  };
};

const shouldTouchSession = (session) => {
  const lastSeenAt = session?.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0;
  return Date.now() - lastSeenAt >= SESSION_ACTIVITY_UPDATE_WINDOW_MS;
};

export const validateSessionFromAccessToken = async ({ req, decoded } = {}) => {
  const sessionId = String(decoded?.sid || "").trim();
  if (!sessionId) {
    return {
      valid: true,
      session: null,
      legacyToken: true,
    };
  }

  const session = await AuthSession.findOne({ sessionId }).lean();
  if (!session) {
    return {
      valid: false,
      reason: "session_not_found",
      code: "SESSION_NOT_FOUND",
    };
  }

  if (session.revokedAt) {
    return {
      valid: false,
      reason: "session_revoked",
      code: "SESSION_REVOKED",
      session,
    };
  }

  const expiresAt = session?.expiresAt ? new Date(session.expiresAt).getTime() : 0;
  const idleCutoff = session?.lastSeenAt ? new Date(session.lastSeenAt).getTime() + SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000 : 0;
  const now = Date.now();

  if ((expiresAt && now > expiresAt) || (idleCutoff && now > idleCutoff)) {
    await AuthSession.updateOne(
      { sessionId, revokedAt: null },
      {
        $set: {
          revokedAt: new Date(),
          revokedReason: now > expiresAt ? "expired" : "idle_timeout",
        },
      }
    );
    return {
      valid: false,
      reason: now > expiresAt ? "session_expired" : "session_idle_timeout",
      code: "SESSION_EXPIRED",
      session: {
        ...session,
        revokedReason: now > expiresAt ? "expired" : "idle_timeout",
      },
    };
  }

  if (shouldTouchSession(session)) {
    void AuthSession.updateOne(
      { sessionId },
      {
        $set: {
          lastSeenAt: new Date(),
          ipHash: hashValue(getIp(req)),
        },
      }
    ).catch((error) => {
      logger.warn({ sessionId, error: error?.message || String(error) }, "failed to update auth session activity");
    });
  }

  return {
    valid: true,
    session,
    legacyToken: false,
  };
};

export const getRefreshSessionContext = async (req) => {
  const cookies = parseCookies(req?.headers?.cookie || "");
  const refreshToken = String(cookies[REFRESH_COOKIE_NAME] || "").trim();
  const sessionId = String(cookies[SESSION_COOKIE_NAME] || "").trim();

  if (!refreshToken || !sessionId) {
    return {
      ok: false,
      reason: "refresh_cookie_missing",
    };
  }

  const session = await AuthSession.findOne({
    sessionId,
    refreshTokenHash: hashRefreshToken(refreshToken),
  });

  if (!session) {
    return {
      ok: false,
      reason: "refresh_session_not_found",
    };
  }

  if (session.revokedAt) {
    return {
      ok: false,
      reason: "refresh_session_revoked",
      session,
    };
  }

  if (!session.refreshExpiresAt || new Date(session.refreshExpiresAt).getTime() < Date.now()) {
    session.revokedAt = new Date();
    session.revokedReason = "refresh_expired";
    await session.save();
    return {
      ok: false,
      reason: "refresh_expired",
      session,
    };
  }

  return {
    ok: true,
    session,
    refreshToken,
  };
};

export const rotateSessionRefresh = async ({ req, res, session, user } = {}) => {
  const refreshToken = createOpaqueToken();
  session.refreshTokenHash = hashRefreshToken(refreshToken);
  session.refreshExpiresAt = computeExpiryDate(REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  session.expiresAt = session.refreshExpiresAt;
  session.lastSeenAt = new Date();
  session.ipHash = hashValue(getIp(req));
  await session.save();

  attachSessionCookies({ req, res, sessionId: session.sessionId, refreshToken });

  const token = issueAccessToken({
    userId: user._id,
    sessionId: session.sessionId,
    roles: user.roles || [],
    tenantId: user.tenantId || user.organizationId || "public",
  });

  await writeSecurityAuditLog({
    req,
    actorUserId: user._id,
    actorEmail: user.email,
    action: "auth.session_refreshed",
    category: "auth",
    status: "success",
    severity: "low",
    message: "Access token refreshed from active session.",
    metadata: {
      sessionId: session.sessionId,
      authProvider: session.authProvider,
    },
  });

  recordAuthEvent({ action: "session_refreshed", status: "success", provider: session.authProvider || "unknown" });

  return {
    token,
    session,
  };
};

export const revokeSessionById = async ({ req, sessionId, actorUserId = null, actorEmail = "", reason = "logout" } = {}) => {
  if (!sessionId) return null;
  const session = await AuthSession.findOneAndUpdate(
    { sessionId, revokedAt: null },
    {
      $set: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    },
    { new: true }
  );

  if (session) {
    await writeSecurityAuditLog({
      req,
      actorUserId: actorUserId || session.userId,
      actorEmail,
      action: "auth.session_revoked",
      category: "auth",
      status: "success",
      severity: "low",
      message: "Authentication session revoked.",
      metadata: {
        sessionId,
        reason,
      },
    });
    recordAuthEvent({ action: "session_revoked", status: "success", provider: session.authProvider || "unknown" });
    const activeCount = await AuthSession.countDocuments({
      authProvider: session.authProvider || "unknown",
      revokedAt: null,
      refreshExpiresAt: { $gt: new Date() },
    });
    setAuthActiveSessionsMetric({ provider: session.authProvider || "unknown", count: activeCount });
  }

  return session;
};

export const revokeAllUserSessions = async ({ req, userId, exceptSessionId = "", actorEmail = "", reason = "logout_all" } = {}) => {
  const query = {
    userId,
    revokedAt: null,
  };
  if (exceptSessionId) {
    query.sessionId = { $ne: exceptSessionId };
  }

  const result = await AuthSession.updateMany(query, {
    $set: {
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });

  await writeSecurityAuditLog({
    req,
    actorUserId: userId,
    actorEmail,
    action: "auth.sessions_revoked_all",
    category: "auth",
    status: "success",
    severity: "medium",
    message: "All active sessions were revoked for the user.",
    metadata: {
      exceptSessionId: exceptSessionId || null,
      reason,
      revokedCount: result.modifiedCount || 0,
    },
  });
  recordAuthEvent({ action: "sessions_revoked_all", status: "success", provider: "mixed" });

  return result;
};

export const listUserSessions = async ({ userId, currentSessionId = "" } = {}) => {
  const sessions = await AuthSession.find({ userId }).sort({ lastSeenAt: -1, createdAt: -1 }).lean();
  return sessions.map((session) => ({
    sessionId: session.sessionId,
    authProvider: session.authProvider,
    loginMethod: session.loginMethod,
    deviceLabel: session.deviceLabel,
    deviceType: session.deviceType,
    platform: session.platform,
    current: session.sessionId === currentSessionId,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    revokedReason: session.revokedReason || "",
  }));
};

export const recordLoginSuccess = async ({ req, user, authProvider = "local", loginMethod = "password" } = {}) => {
  recordAuthEvent({ action: "login_success", status: "success", provider: authProvider });
  return writeSecurityAuditLog({
    req,
    actorUserId: user?._id || null,
    actorEmail: user?.email || "",
    action: "auth.login_success",
    category: "auth",
    status: "success",
    severity: "low",
    message: "User login completed successfully.",
    metadata: {
      authProvider,
      loginMethod,
    },
  });
};

export const recordLoginFailure = async ({ req, email = "", reason = "invalid_credentials", severity = "medium" } = {}) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  await writeSecurityAuditLog({
    req,
    actorEmail: normalizedEmail,
    action: "auth.login_failed",
    category: "auth",
    status: "warning",
    severity,
    message: "User login failed.",
    metadata: {
      reason,
    },
  });
  recordAuthEvent({ action: "login_failed", status: "warning", provider: "local" });

  const since = new Date(Date.now() - SUSPICIOUS_LOGIN_WINDOW_MINUTES * 60 * 1000);
  const ipHash = hashValue(getIp(req));
  const emailHash = normalizedEmail ? hashValue(normalizedEmail) : "";
  const recentFailures = await SecurityAuditLog.countDocuments({
    action: "auth.login_failed",
    createdAt: { $gte: since },
    $or: [
      { actorIpHash: ipHash },
      ...(emailHash ? [{ actorEmailHash: emailHash }] : []),
    ],
  });

  if (recentFailures >= SUSPICIOUS_LOGIN_THRESHOLD) {
    const alertMessage = `Suspicious login activity detected for ${maskEmail(normalizedEmail) || "unknown account"}`;
    logger.warn(
      {
        email: maskEmail(normalizedEmail),
        recentFailures,
        windowMinutes: SUSPICIOUS_LOGIN_WINDOW_MINUTES,
      },
      alertMessage
    );
    await writeSecurityAuditLog({
      req,
      actorEmail: normalizedEmail,
      action: "security.alert.suspicious_login_activity",
      category: "security",
      status: "warning",
      severity: "high",
      message: alertMessage,
      metadata: {
        recentFailures,
        windowMinutes: SUSPICIOUS_LOGIN_WINDOW_MINUTES,
        reason,
      },
    });
    recordAuthEvent({ action: "security_alert", status: "warning", provider: "local" });
  }
};

export const recordAuthAlert = async ({ req, actorUserId = null, actorEmail = "", action = "security.alert.auth", message = "Authentication security alert.", metadata = {}, severity = "high" } = {}) => {
  logger.error(
    {
      actorUserId: actorUserId || null,
      actorEmail: maskEmail(actorEmail),
      action,
      metadata,
    },
    message
  );
  await writeSecurityAuditLog({
    req,
    actorUserId,
    actorEmail,
    action,
    category: "security",
    status: "warning",
    severity,
    message,
    metadata,
  });
};

export const handleAuthServiceError = async ({ error, req, action = "auth.session_error", actorUserId = null, actorEmail = "" } = {}) => {
  await captureException(error, {
    requestId: req?.requestId,
    path: req?.originalUrl,
    method: req?.method,
    action,
  });
  await writeSecurityAuditLog({
    req,
    actorUserId,
    actorEmail,
    action,
    category: "auth",
    status: "error",
    severity: "high",
    message: error?.message || "Authentication service error.",
  });
};
