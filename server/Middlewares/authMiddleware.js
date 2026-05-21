import jwt from 'jsonwebtoken';
import User from '../Models/userModel.js';
import { writeSecurityAuditLog } from "../services/securityAudit.js";
import { attachEnterpriseContext } from "../services/enterpriseAccess.js";
import { getOrSetCachedValue } from "../services/cacheService.js";
import { clearSessionCookies, validateSessionFromAccessToken } from "../services/authSessionService.js";

const buildAuthUserCacheKey = (userId = "") => `user:${String(userId || "").trim()}`;
const AUTH_USER_CACHE_TTL_SECONDS = Math.max(Number(process.env.AUTH_USER_CACHE_TTL_SECONDS || 300), 30);

const loadCachedAuthUser = async (userId) =>
  getOrSetCachedValue({
    layer: "auth_user_session",
    key: buildAuthUserCacheKey(userId),
    ttlSeconds: AUTH_USER_CACHE_TTL_SECONDS,
    loader: async () => {
      const user = await User.findById(userId).lean();
      return user || null;
    },
  });

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const sessionValidation = await validateSessionFromAccessToken({ req, decoded });

      if (!sessionValidation.valid) {
        await writeSecurityAuditLog({
          req,
          action: "auth.session_invalid",
          category: "auth",
          status: "warning",
          severity: "medium",
          message: "Bearer token matched a revoked or expired server-side session.",
          metadata: {
            reason: sessionValidation.reason || "session_invalid",
            code: sessionValidation.code || "SESSION_INVALID",
            sessionId: decoded?.sid || null,
          },
        });
        clearSessionCookies({ req, res });
        return res.status(401).json({
          success: false,
          code: sessionValidation.code || "SESSION_INVALID",
          message: "Session expired or revoked. Please sign in again.",
        });
      }

      const userId = decoded?.id || decoded?.userId;
      req.user = await loadCachedAuthUser(userId);
      req.authSession = sessionValidation.session || null;
      if (!req.user) {
        await writeSecurityAuditLog({
          req,
          action: "auth.user_missing",
          category: "auth",
          status: "warning",
          severity: "medium",
          message: "JWT validated but target user record no longer exists.",
        });
        return res.status(401).json({
          success: false,
          message: "User not found"
        });
      }

      attachEnterpriseContext(req, req.user);

      next();
    } catch (error) {
      await writeSecurityAuditLog({
        req,
        action: "auth.token_invalid",
        category: "auth",
        status: "warning",
        severity: "medium",
        message: "Bearer token rejected.",
        metadata: {
          reason: error?.name || "token_verification_failed",
        },
      });
      return res.status(401).json({
        success: false,
        message: "Not authorized, token invalid or expired"
      });
    }
  }

  if (!token) {
    await writeSecurityAuditLog({
      req,
      action: "auth.token_missing",
      category: "auth",
      status: "warning",
      severity: "low",
      message: "Protected route accessed without bearer token.",
    });
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }
}

export const optionalProtect = async (req, _res, next) => {
  if (!(req.headers.authorization && req.headers.authorization.startsWith("Bearer"))) {
    return next();
  }

  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const sessionValidation = await validateSessionFromAccessToken({ req, decoded });
    if (!sessionValidation.valid) {
      req.user = null;
      req.authSession = null;
      attachEnterpriseContext(req, null);
      return next();
    }
    const userId = decoded?.id || decoded?.userId;
    req.user = await loadCachedAuthUser(userId);
    req.authSession = sessionValidation.session || null;
    attachEnterpriseContext(req, req.user);
  } catch {
    req.user = null;
    attachEnterpriseContext(req, null);
  }

  next();
}

export const requireTermsAcceptance = (req, res, next) => {
  if (!req.user) {
    return next();
  }

  if (req.user.termsAccepted && req.user.acceptedAt) {
    return next();
  }

  return res.status(403).json({
    success: false,
    code: "TERMS_ACCEPTANCE_REQUIRED",
    message: "Please accept the Terms & Conditions and Privacy Policy to continue.",
  });
}
