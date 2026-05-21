import { COUNTRY_NAME_TO_CODE, COUNTRY_RULES, DEFAULT_COUNTRY_CODE } from "../Config/countryRules.js";

export const getSupportedCountryOptions = () =>
  Object.values(COUNTRY_RULES)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ code, name, currency, pricingRegion, taxWorkflow, aiComplianceMode, supportedPlans }) => ({
      code,
      name,
      currency,
      pricingRegion,
      taxWorkflow,
      aiComplianceMode,
      supportedPlans,
    }));

export const normalizeCountryCode = (value = "") => {
  const normalized = String(value || "").trim().toUpperCase();
  if (COUNTRY_RULES[normalized]) return normalized;

  const lowered = String(value || "").trim().toLowerCase();
  if (COUNTRY_NAME_TO_CODE[lowered]) return COUNTRY_NAME_TO_CODE[lowered];
  return "";
};

export const resolveCountryRule = (value = "") => {
  const code = normalizeCountryCode(value) || DEFAULT_COUNTRY_CODE;
  return COUNTRY_RULES[code] || COUNTRY_RULES[DEFAULT_COUNTRY_CODE];
};

export const buildCountryProfile = (value = "") => {
  const rule = resolveCountryRule(value);
  return {
    countryCode: rule.code,
    countryName: rule.name,
    pricingRegion: rule.pricingRegion,
    billingCurrency: rule.currency,
    supportedPlans: [...rule.supportedPlans],
    taxWorkflow: rule.taxWorkflow,
    aiComplianceMode: rule.aiComplianceMode,
  };
};
