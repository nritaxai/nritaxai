import { ensureTermsAcceptedForFeature } from "../services/onboardingPolicy.js";
import { writeSecurityAuditLog } from "../services/securityAudit.js";

export const requireAcceptedTerms = (featureName = "this feature") => async (req, res, next) => {
  try {
    ensureTermsAcceptedForFeature(req.user, featureName);
    next();
  } catch (error) {
    await writeSecurityAuditLog({
      req,
      action: "onboarding.terms_required",
      category: "access",
      status: "warning",
      severity: "medium",
      message: "Blocked feature access because the current user has not accepted the latest terms.",
      metadata: {
        featureName,
        userId: String(req.user?._id || ""),
      },
    });
    return res.status(error.statusCode || 403).json({
      success: false,
      code: error.code || "TERMS_ACCEPTANCE_REQUIRED",
      message: error.message,
    });
  }
};
