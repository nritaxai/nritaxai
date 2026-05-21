const COUNTRY_RULES = {
  IN: {
    code: "IN",
    name: "India",
    currency: "INR",
    pricingRegion: "domestic_india",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "resident_india",
    aiComplianceMode: "india_resident",
  },
  US: {
    code: "US",
    name: "United States",
    currency: "USD",
    pricingRegion: "international_us",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_us",
    aiComplianceMode: "nri_cross_border",
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    pricingRegion: "international_uk",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_uk",
    aiComplianceMode: "nri_cross_border",
  },
  AE: {
    code: "AE",
    name: "United Arab Emirates",
    currency: "AED",
    pricingRegion: "gcc",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_gcc",
    aiComplianceMode: "nri_cross_border",
  },
  SG: {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    pricingRegion: "apac",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_singapore",
    aiComplianceMode: "nri_cross_border",
  },
  CA: {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    pricingRegion: "north_america",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_canada",
    aiComplianceMode: "nri_cross_border",
  },
  AU: {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    pricingRegion: "apac",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_australia",
    aiComplianceMode: "nri_cross_border",
  },
  BH: {
    code: "BH",
    name: "Bahrain",
    currency: "BHD",
    pricingRegion: "gcc",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_gcc",
    aiComplianceMode: "nri_cross_border",
  },
  CH: {
    code: "CH",
    name: "Switzerland",
    currency: "CHF",
    pricingRegion: "europe",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_europe",
    aiComplianceMode: "nri_cross_border",
  },
  DE: {
    code: "DE",
    name: "Germany",
    currency: "EUR",
    pricingRegion: "europe",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_europe",
    aiComplianceMode: "nri_cross_border",
  },
  FR: {
    code: "FR",
    name: "France",
    currency: "EUR",
    pricingRegion: "europe",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_europe",
    aiComplianceMode: "nri_cross_border",
  },
  HK: {
    code: "HK",
    name: "Hong Kong",
    currency: "HKD",
    pricingRegion: "apac",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_apac",
    aiComplianceMode: "nri_cross_border",
  },
  ID: {
    code: "ID",
    name: "Indonesia",
    currency: "IDR",
    pricingRegion: "apac",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_apac",
    aiComplianceMode: "nri_cross_border",
  },
  IE: {
    code: "IE",
    name: "Ireland",
    currency: "EUR",
    pricingRegion: "europe",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_europe",
    aiComplianceMode: "nri_cross_border",
  },
  JP: {
    code: "JP",
    name: "Japan",
    currency: "JPY",
    pricingRegion: "apac",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_apac",
    aiComplianceMode: "nri_cross_border",
  },
  KW: {
    code: "KW",
    name: "Kuwait",
    currency: "KWD",
    pricingRegion: "gcc",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_gcc",
    aiComplianceMode: "nri_cross_border",
  },
  MY: {
    code: "MY",
    name: "Malaysia",
    currency: "MYR",
    pricingRegion: "apac",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_apac",
    aiComplianceMode: "nri_cross_border",
  },
  NL: {
    code: "NL",
    name: "Netherlands",
    currency: "EUR",
    pricingRegion: "europe",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_europe",
    aiComplianceMode: "nri_cross_border",
  },
  NZ: {
    code: "NZ",
    name: "New Zealand",
    currency: "NZD",
    pricingRegion: "apac",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_apac",
    aiComplianceMode: "nri_cross_border",
  },
  OM: {
    code: "OM",
    name: "Oman",
    currency: "OMR",
    pricingRegion: "gcc",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_gcc",
    aiComplianceMode: "nri_cross_border",
  },
  QA: {
    code: "QA",
    name: "Qatar",
    currency: "QAR",
    pricingRegion: "gcc",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_gcc",
    aiComplianceMode: "nri_cross_border",
  },
  SA: {
    code: "SA",
    name: "Saudi Arabia",
    currency: "SAR",
    pricingRegion: "gcc",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_gcc",
    aiComplianceMode: "nri_cross_border",
  },
  SE: {
    code: "SE",
    name: "Sweden",
    currency: "SEK",
    pricingRegion: "europe",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_europe",
    aiComplianceMode: "nri_cross_border",
  },
  TH: {
    code: "TH",
    name: "Thailand",
    currency: "THB",
    pricingRegion: "apac",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_apac",
    aiComplianceMode: "nri_cross_border",
  },
  ZA: {
    code: "ZA",
    name: "South Africa",
    currency: "ZAR",
    pricingRegion: "africa",
    supportedPlans: ["starter", "professional", "enterprise"],
    taxWorkflow: "nri_africa",
    aiComplianceMode: "nri_cross_border",
  },
};

const COUNTRY_NAME_TO_CODE = Object.values(COUNTRY_RULES).reduce((acc, rule) => {
  acc[rule.name.toLowerCase()] = rule.code;
  return acc;
}, {});

export const DEFAULT_COUNTRY_CODE = "IN";

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
