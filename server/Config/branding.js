const sanitize = (value) => String(value || "").trim();

export const COMPANY_LEGAL_NAME = "Billion Dollar Technologies Private Limited";
export const COMPANY_SHORT_NAME = "Billion Dollar Technologies";
export const COMPANY_SUPPORT_TEAM_NAME = `${COMPANY_SHORT_NAME} Team`;
export const SUPPORT_EMAIL = sanitize(process.env.SUPPORT_EMAIL) || "ask@nritax.ai";
export const ADMIN_EMAIL = sanitize(process.env.ADMIN_EMAIL) || "admin@nritax.ai";
export const APP_SITE_URL =
  sanitize(process.env.FRONTEND_URL) ||
  sanitize(process.env.CLIENT_URL) ||
  sanitize(process.env.APP_URL) ||
  "https://www.nritax.ai";
export const DEFAULT_FROM_EMAIL =
  sanitize(process.env.RESEND_FROM_EMAIL) || `${COMPANY_SHORT_NAME} <noreply@mail.nritax.ai>`;
export const OPENROUTER_APP_TITLE = sanitize(process.env.OPENROUTER_APP_NAME) || COMPANY_LEGAL_NAME;

export const buildSupportMailSubject = (subject) => `${subject} - ${COMPANY_LEGAL_NAME}`;
