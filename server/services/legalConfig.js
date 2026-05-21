export const COMPANY_LEGAL_NAME = "Billion Dollar Technologies Private Limited";
export const PLATFORM_BRAND_NAME = "NRITAX.AI";
export const CURRENT_POLICY_VERSION = "2026-05-20";

export const LEGAL_COPY = {
  companyName: COMPANY_LEGAL_NAME,
  brandName: PLATFORM_BRAND_NAME,
  policyVersion: CURRENT_POLICY_VERSION,
  supportEmail: String(process.env.SUPPORT_EMAIL || "ask@nritax.ai").trim(),
  websiteUrl: String(process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.APP_URL || "https://www.nritax.ai").trim(),
};
