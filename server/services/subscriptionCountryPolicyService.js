import { buildCountryProfile } from "./countryPolicyService.js";
import { appConfig } from "../Config/runtimeConfig.js";

const DISPLAY_CURRENCY_MATRIX = appConfig.country.checkoutDisplayCurrencyMatrix;

const normalizeText = (value) => String(value || "").trim();

export const resolveSubscriptionCountryPolicy = (user = null) => {
  const profile = user?.complianceProfile && typeof user.complianceProfile === "object"
    ? {
        ...buildCountryProfile(user?.countryCode || user?.countryOfResidence || "IN"),
        ...user.complianceProfile,
      }
    : buildCountryProfile(user?.countryCode || user?.countryOfResidence || "IN");

  const countryCode = normalizeText(profile.countryCode || user?.countryCode || "IN").toUpperCase() || "IN";
  const supportedDisplayCurrencies = DISPLAY_CURRENCY_MATRIX[countryCode] || [profile.billingCurrency || "INR", "INR"];

  return {
    countryCode,
    countryName: normalizeText(profile.countryName || user?.countryOfResidence || ""),
    pricingRegion: normalizeText(profile.pricingRegion || ""),
    billingCurrency: normalizeText(profile.billingCurrency || "INR").toUpperCase(),
    supportedPlans: Array.isArray(profile.supportedPlans) && profile.supportedPlans.length
      ? profile.supportedPlans
      : ["starter", "professional", "enterprise"],
    taxWorkflow: normalizeText(profile.taxWorkflow || ""),
    aiComplianceMode: normalizeText(profile.aiComplianceMode || ""),
    supportedDisplayCurrencies: Array.from(new Set(supportedDisplayCurrencies.filter(Boolean))),
    countryLocked: Boolean(user?.countryLocked),
  };
};

export const validateSubscriptionCountryAccess = ({
  user = null,
  requestedPlanKey = "",
  requestedDisplayCurrency = "",
}) => {
  const policy = resolveSubscriptionCountryPolicy(user);

  if (requestedPlanKey && !policy.supportedPlans.includes(requestedPlanKey)) {
    const error = new Error(`The ${requestedPlanKey} plan is not enabled for your locked country profile.`);
    error.statusCode = 403;
    error.code = "PLAN_NOT_ALLOWED_FOR_COUNTRY";
    error.policy = policy;
    throw error;
  }

  const normalizedDisplayCurrency = normalizeText(requestedDisplayCurrency).toUpperCase();
  if (normalizedDisplayCurrency && !policy.supportedDisplayCurrencies.includes(normalizedDisplayCurrency)) {
    const error = new Error(
      `Display currency ${normalizedDisplayCurrency} is not supported for your locked country profile.`
    );
    error.statusCode = 400;
    error.code = "DISPLAY_CURRENCY_NOT_ALLOWED";
    error.policy = policy;
    throw error;
  }

  return policy;
};
