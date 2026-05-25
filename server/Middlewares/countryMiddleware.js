import { buildCountryProfile, normalizeCountryCode, resolveCountryRule } from "../services/countryPolicyService.js";
import { writeSecurityAuditLog } from "../services/securityAudit.js";

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");

export const resolveSignupCountrySelection = (body = {}) => {
  const rawCountryCode = sanitizeString(body.countryCode || body.country_code);
  const rawCountry = sanitizeString(body.country || body.countryName || body.countryOfResidence);
  const normalizedCountryCode = normalizeCountryCode(rawCountryCode || rawCountry);

  if (!normalizedCountryCode) {
    const error = new Error(rawCountryCode || rawCountry ? "Please select a supported country during signup." : "Country is required");
    error.statusCode = 400;
    error.code = "COUNTRY_REQUIRED";
    throw error;
  }

  const countryRule = resolveCountryRule(normalizedCountryCode);
  return {
    country: countryRule.name,
    countryCode: countryRule.code,
    countryProfile: buildCountryProfile(countryRule.code),
  };
};

export const validateSignupCountry = (req, res, next) => {
  try {
    req.countrySelection = resolveSignupCountrySelection(req.body || {});
    next();
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      code: error.code || "COUNTRY_INVALID",
      message: error.message || "Please select a supported country.",
    });
  }
};

export const rejectLockedCountryMutation = async (req, res, next) => {
  const user = req.user;
  if (!user?.countryLocked) return next();

  const attemptedCountry = sanitizeString(req.body?.country || req.body?.countryOfResidence);
  const attemptedCountryCode = normalizeCountryCode(req.body?.countryCode || attemptedCountry);
  const currentCountryCode = normalizeCountryCode(user.countryCode || user.countryOfResidence);
  const currentCountry = sanitizeString(user.country || user.countryOfResidence);
  const countryChanged = attemptedCountry && attemptedCountry !== currentCountry;
  const codeChanged = attemptedCountryCode && attemptedCountryCode !== currentCountryCode;

  if (!countryChanged && !codeChanged) return next();

  await writeSecurityAuditLog({
    req,
    action: "country.locked_mutation_blocked",
    category: "country",
    status: "blocked",
    severity: "medium",
    message: "Blocked direct country mutation for a locked user profile.",
    metadata: {
      attemptedCountry,
      attemptedCountryCode,
      currentCountry,
      currentCountryCode,
    },
  });

  return res.status(403).json({
    success: false,
    code: "COUNTRY_APPROVAL_REQUIRED",
    message: "Country change requires approval",
  });
};
