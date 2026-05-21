import { appConfig } from "./runtimeConfig.js";

export const COMPANY_LEGAL_NAME = appConfig.branding.companyLegalName;
export const COMPANY_SHORT_NAME = appConfig.branding.companyShortName;
export const COMPANY_SUPPORT_TEAM_NAME = appConfig.branding.companySupportTeamName;
export const SUPPORT_EMAIL = appConfig.branding.supportEmail;
export const ADMIN_EMAIL = appConfig.branding.adminEmail;
export const APP_SITE_URL = appConfig.branding.appSiteUrl;
export const DEFAULT_FROM_EMAIL = appConfig.branding.defaultFromEmail;
export const OPENROUTER_APP_TITLE = appConfig.branding.openRouterAppTitle;

export const buildSupportMailSubject = (subject) => `${subject} - ${COMPANY_LEGAL_NAME}`;
