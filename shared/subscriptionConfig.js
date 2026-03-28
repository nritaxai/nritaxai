export const PLAN_KEYS = {
  STARTER: "starter",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise",
};

export const SUBSCRIPTION_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  CANCELED: "canceled",
};

export const FEATURE_KEYS = {
  BASIC_DTAA: "basicDtaa",
  ADVANCED_DTAA: "advancedDtaa",
  TAX_CALCULATORS: "taxCalculators",
  ALL_TAX_CALCULATORS: "allTaxCalculators",
  EMAIL_SUPPORT: "emailSupport",
  PRIORITY_EMAIL_SUPPORT: "priorityEmailSupport",
  TAX_UPDATES: "taxUpdates",
  UNLIMITED_AI_CHAT: "unlimitedAiChat",
  CPA_CONSULTATION: "cpaConsultation",
  UNLIMITED_CPA_CONSULTATIONS: "unlimitedCpaConsultations",
  PERSONALIZED_TAX_INSIGHTS: "personalizedTaxInsights",
  DEDICATED_ADVISOR: "dedicatedAdvisor",
  HIGH_PRIORITY_ADVISOR: "highPriorityAdvisor",
  PRIORITY_RESPONSE_SLA: "priorityResponseSla",
  QUARTERLY_PLANNING_REVIEW: "quarterlyPlanningReview",
  CUSTOM_COMPLIANCE_WORKFLOWS: "customComplianceWorkflows",
};

export const CHAT_MODEL_KEYS = {
  BASIC: "basic",
  STANDARD: "standard",
  PREMIUM: "premium",
};

export const PLAN_CONFIG = {
  [PLAN_KEYS.STARTER]: {
    key: PLAN_KEYS.STARTER,
    displayName: "Starter",
    badge: "Current Free Plan",
    priceLabel: "₹0",
    monthlyPriceInr: 0,
    yearlyPriceInr: 0,
    limits: {
      chatMessagesPerMonth: 5,
      cpaConsultationsPerMonth: 0,
    },
    modelTier: CHAT_MODEL_KEYS.BASIC,
    features: {
      [FEATURE_KEYS.BASIC_DTAA]: true,
      [FEATURE_KEYS.ADVANCED_DTAA]: false,
      [FEATURE_KEYS.TAX_CALCULATORS]: true,
      [FEATURE_KEYS.ALL_TAX_CALCULATORS]: false,
      [FEATURE_KEYS.EMAIL_SUPPORT]: true,
      [FEATURE_KEYS.PRIORITY_EMAIL_SUPPORT]: false,
      [FEATURE_KEYS.TAX_UPDATES]: true,
      [FEATURE_KEYS.UNLIMITED_AI_CHAT]: false,
      [FEATURE_KEYS.CPA_CONSULTATION]: false,
      [FEATURE_KEYS.UNLIMITED_CPA_CONSULTATIONS]: false,
      [FEATURE_KEYS.PERSONALIZED_TAX_INSIGHTS]: false,
      [FEATURE_KEYS.DEDICATED_ADVISOR]: false,
      [FEATURE_KEYS.HIGH_PRIORITY_ADVISOR]: false,
      [FEATURE_KEYS.PRIORITY_RESPONSE_SLA]: false,
      [FEATURE_KEYS.QUARTERLY_PLANNING_REVIEW]: false,
      [FEATURE_KEYS.CUSTOM_COMPLIANCE_WORKFLOWS]: false,
    },
    pricingFeatures: [
      { text: "5 AI chat messages per month", included: true },
      { text: "Basic DTAA information", included: true },
      { text: "Tax calculators", included: true },
      { text: "Email support", included: true },
      { text: "Access to tax updates", included: true },
      { text: "Unlimited AI chat", included: false },
      { text: "CPA consultation", included: false },
      { text: "Advanced DTAA guidance", included: false },
      { text: "Personalized tax insights", included: false },
      { text: "Dedicated advisor", included: false },
    ],
  },
  [PLAN_KEYS.PROFESSIONAL]: {
    key: PLAN_KEYS.PROFESSIONAL,
    displayName: "Professional",
    badge: "Most Popular",
    priceLabel: "₹999/month or ₹9,999/year",
    monthlyPriceInr: 999,
    yearlyPriceInr: 9999,
    limits: {
      chatMessagesPerMonth: null,
      cpaConsultationsPerMonth: 0,
    },
    modelTier: CHAT_MODEL_KEYS.STANDARD,
    features: {
      [FEATURE_KEYS.BASIC_DTAA]: true,
      [FEATURE_KEYS.ADVANCED_DTAA]: true,
      [FEATURE_KEYS.TAX_CALCULATORS]: true,
      [FEATURE_KEYS.ALL_TAX_CALCULATORS]: true,
      [FEATURE_KEYS.EMAIL_SUPPORT]: true,
      [FEATURE_KEYS.PRIORITY_EMAIL_SUPPORT]: true,
      [FEATURE_KEYS.TAX_UPDATES]: true,
      [FEATURE_KEYS.UNLIMITED_AI_CHAT]: true,
      [FEATURE_KEYS.CPA_CONSULTATION]: false,
      [FEATURE_KEYS.UNLIMITED_CPA_CONSULTATIONS]: false,
      [FEATURE_KEYS.PERSONALIZED_TAX_INSIGHTS]: true,
      [FEATURE_KEYS.DEDICATED_ADVISOR]: true,
      [FEATURE_KEYS.HIGH_PRIORITY_ADVISOR]: false,
      [FEATURE_KEYS.PRIORITY_RESPONSE_SLA]: false,
      [FEATURE_KEYS.QUARTERLY_PLANNING_REVIEW]: false,
      [FEATURE_KEYS.CUSTOM_COMPLIANCE_WORKFLOWS]: false,
    },
    pricingFeatures: [
      { text: "Unlimited AI chat", included: true },
      { text: "Advanced DTAA guidance", included: true },
      { text: "All tax calculators", included: true },
      { text: "Priority email support", included: true },
      { text: "Personalized tax insights", included: true },
      { text: "Dedicated advisor", included: true },
    ],
  },
  [PLAN_KEYS.ENTERPRISE]: {
    key: PLAN_KEYS.ENTERPRISE,
    displayName: "Enterprise",
    badge: "Custom",
    priceLabel: "Custom",
    monthlyPriceInr: null,
    yearlyPriceInr: null,
    limits: {
      chatMessagesPerMonth: null,
      cpaConsultationsPerMonth: null,
    },
    modelTier: CHAT_MODEL_KEYS.PREMIUM,
    features: {
      [FEATURE_KEYS.BASIC_DTAA]: true,
      [FEATURE_KEYS.ADVANCED_DTAA]: true,
      [FEATURE_KEYS.TAX_CALCULATORS]: true,
      [FEATURE_KEYS.ALL_TAX_CALCULATORS]: true,
      [FEATURE_KEYS.EMAIL_SUPPORT]: true,
      [FEATURE_KEYS.PRIORITY_EMAIL_SUPPORT]: true,
      [FEATURE_KEYS.TAX_UPDATES]: true,
      [FEATURE_KEYS.UNLIMITED_AI_CHAT]: true,
      [FEATURE_KEYS.CPA_CONSULTATION]: true,
      [FEATURE_KEYS.UNLIMITED_CPA_CONSULTATIONS]: true,
      [FEATURE_KEYS.PERSONALIZED_TAX_INSIGHTS]: true,
      [FEATURE_KEYS.DEDICATED_ADVISOR]: true,
      [FEATURE_KEYS.HIGH_PRIORITY_ADVISOR]: true,
      [FEATURE_KEYS.PRIORITY_RESPONSE_SLA]: true,
      [FEATURE_KEYS.QUARTERLY_PLANNING_REVIEW]: true,
      [FEATURE_KEYS.CUSTOM_COMPLIANCE_WORKFLOWS]: true,
    },
    pricingFeatures: [
      { text: "Everything in Professional", included: true },
      { text: "Unlimited CPA consultations", included: true },
      { text: "Dedicated advisor (high priority)", included: true },
      { text: "Priority response SLA", included: true },
      { text: "Quarterly planning review", included: true },
      { text: "Custom compliance workflows", included: true },
    ],
  },
};

export const PLAN_ORDER = [
  PLAN_KEYS.STARTER,
  PLAN_KEYS.PROFESSIONAL,
  PLAN_KEYS.ENTERPRISE,
];

export const normalizePlanKey = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (PLAN_CONFIG[normalized]) return normalized;
  if (normalized === "free") return PLAN_KEYS.STARTER;
  if (normalized === "pro") return PLAN_KEYS.PROFESSIONAL;
  if (normalized === "premium") return PLAN_KEYS.ENTERPRISE;
  return PLAN_KEYS.STARTER;
};

export const normalizeSubscriptionStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.values(SUBSCRIPTION_STATUSES).includes(normalized)
    ? normalized
    : SUBSCRIPTION_STATUSES.ACTIVE;
};

export const getPlanConfig = (planKey) => PLAN_CONFIG[normalizePlanKey(planKey)];

export const getLegacyPlanCode = (planKey) => {
  const normalized = normalizePlanKey(planKey);
  if (normalized === PLAN_KEYS.PROFESSIONAL) return "PRO";
  if (normalized === PLAN_KEYS.ENTERPRISE) return "PREMIUM";
  return "FREE";
};

export const isUnlimitedLimit = (value) => value === null;

export const getRemainingCount = (limit, used) => {
  if (isUnlimitedLimit(limit)) return null;
  const normalizedUsed = Math.max(0, Number(used || 0));
  return Math.max(0, limit - normalizedUsed);
};

export const isFeatureEnabled = (planKey, featureKey) =>
  Boolean(getPlanConfig(planKey).features?.[featureKey]);

export const getPlanCapabilities = (planKey) => {
  const config = getPlanConfig(planKey);
  return {
    plan: config.key,
    displayName: config.displayName,
    priceLabel: config.priceLabel,
    modelTier: config.modelTier,
    limits: config.limits,
    features: config.features,
  };
};
