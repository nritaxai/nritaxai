import { appConfig } from "../Config/runtimeConfig.js";

export const COMPANY_LEGAL_NAME = appConfig.branding.companyLegalName;
export const PLATFORM_BRAND_NAME = appConfig.branding.platformBrandName;
export const CURRENT_POLICY_VERSION = appConfig.policies.currentVersion;

export const LEGAL_COPY = {
  companyName: COMPANY_LEGAL_NAME,
  brandName: PLATFORM_BRAND_NAME,
  policyVersion: CURRENT_POLICY_VERSION,
  supportEmail: appConfig.branding.supportEmail,
  websiteUrl: appConfig.branding.appSiteUrl,
};
