import { CURRENT_POLICY_VERSION } from "./legalConfig.js";
import { buildCountryProfile, normalizeCountryCode, resolveCountryRule } from "./countryPolicyService.js";

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeIp = (value = "") =>
  String(value || "")
    .split(",")[0]
    .trim()
    .slice(0, 120);

export const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  }
  if (typeof value === "number") return value === 1;
  return false;
};

export const resolveRequestedPolicyVersion = (value = "") =>
  sanitizeString(value) || CURRENT_POLICY_VERSION;

export const validateTermsAcceptance = (body = {}, context = {}) => {
  const termsAccepted = normalizeBoolean(body?.termsAccepted);
  const policyVersion = resolveRequestedPolicyVersion(body?.policyVersion);

  if (!termsAccepted) {
    const error = new Error("Terms and Conditions must be accepted before continuing.");
    error.statusCode = 400;
    throw error;
  }

  return {
    termsAccepted: true,
    acceptedAt: new Date(),
    acceptedIp: normalizeIp(context?.acceptedIp || context?.ip),
    policyVersion,
  };
};

export const validateCountrySelection = (body = {}) => {
  const rawCountryCode = sanitizeString(body?.countryCode || body?.country_code);
  const rawCountryName = sanitizeString(body?.countryName || body?.country || body?.countryOfResidence);
  const normalizedCountryCode = normalizeCountryCode(rawCountryCode || rawCountryName);

  if (!normalizedCountryCode) {
    const error = new Error("Please select a supported country during signup.");
    error.statusCode = 400;
    throw error;
  }

  const countryRule = resolveCountryRule(normalizedCountryCode);
  const countryProfile = buildCountryProfile(normalizedCountryCode);

  return {
    countryCode: countryRule.code,
    countryName: countryRule.name,
    countryProfile,
  };
};

export const applySignupComplianceState = ({ user, termsAcceptance, countrySelection, source = "web" }) => {
  user.termsAccepted = Boolean(termsAcceptance?.termsAccepted);
  user.termsAcceptedAt = termsAcceptance?.acceptedAt || null;
  user.acceptedAt = termsAcceptance?.acceptedAt || null;
  user.acceptedIp = sanitizeString(termsAcceptance?.acceptedIp) || user.acceptedIp || "";
  user.policyVersion = sanitizeString(termsAcceptance?.policyVersion) || CURRENT_POLICY_VERSION;
  user.countryCode = countrySelection?.countryCode || "";
  user.countryOfResidence = countrySelection?.countryName || user.countryOfResidence || "";
  user.initialCountry = user.initialCountry || countrySelection?.countryCode || "";
  user.initialCountryName = user.initialCountryName || countrySelection?.countryName || "";
  user.countryLocked = Boolean(countrySelection?.countryCode);
  user.countryLockedAt = countrySelection?.countryCode ? new Date() : user.countryLockedAt || null;
  user.countrySelectionSource = sanitizeString(source) || "web";
  user.countryChangeStatus = "none";
  user.countryLastChangeRequestedAt = null;
  user.complianceProfile = countrySelection?.countryProfile || buildCountryProfile(user.countryCode || "");
  return user;
};

export const ensureUserAcceptedTerms = (user = null) =>
  Boolean(user?.termsAccepted && (user?.termsAcceptedAt || user?.acceptedAt));

export const ensureTermsAcceptedForFeature = (user = null, featureName = "this feature") => {
  if (ensureUserAcceptedTerms(user)) return;
  const error = new Error(`Terms acceptance is required before using ${featureName}.`);
  error.statusCode = 403;
  error.code = "TERMS_ACCEPTANCE_REQUIRED";
  throw error;
};
