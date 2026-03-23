import { Capacitor } from "@capacitor/core";

const PROD_API_URL_DEFAULT = "https://nritax.ai";
const DEV_API_URL_DEFAULT = "http://localhost:5000";

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, "");

const envApiUrl = String(import.meta.env.VITE_API_URL || "").trim();
const envProdApiUrl = String(import.meta.env.VITE_API_URL_PROD || "").trim();
const envDevApiUrl = String(import.meta.env.VITE_API_URL_DEV || "").trim();
const envBannerApiUrl = String(import.meta.env.VITE_BANNER_API_URL || "").trim();

export const IS_NATIVE_APP = Capacitor.isNativePlatform();
export const PLATFORM = Capacitor.getPlatform();
export const IS_IOS_NATIVE_APP = IS_NATIVE_APP && PLATFORM === "ios";

const resolvedProdApiUrl = normalizeUrl(envProdApiUrl || PROD_API_URL_DEFAULT);
const resolvedDevApiUrl = normalizeUrl(envDevApiUrl || DEV_API_URL_DEFAULT);

export const API_BASE_URL = normalizeUrl(
  envApiUrl || (import.meta.env.DEV && !IS_NATIVE_APP ? resolvedDevApiUrl : resolvedProdApiUrl)
);

const getBannerOrigin = () => {
  if (envBannerApiUrl) return normalizeUrl(envBannerApiUrl);
  if (typeof window !== "undefined" && window.location.origin) {
    return normalizeUrl(window.location.origin);
  }
  return "https://www.nritax.ai";
};

export const BANNER_API_BASE_URL = normalizeUrl(
  getBannerOrigin()
);

export const APPLE_AUTH_CONFIG = {
  clientId: String(import.meta.env.VITE_APPLE_CLIENT_ID || "").trim(),
  redirectURI: String(import.meta.env.VITE_APPLE_REDIRECT_URI || "").trim(),
  scope: "name email",
  usePopup: true,
};

const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const googleClientIdDev = String(import.meta.env.VITE_GOOGLE_CLIENT_ID_DEV || "").trim();

const getWebOrigin = () => {
  if (typeof window === "undefined") return "";
  return window.location.origin;
};

const isLocalWebOrigin = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
};

const resolvedGoogleClientId =
  !IS_NATIVE_APP && import.meta.env.DEV && isLocalWebOrigin()
    ? googleClientIdDev || googleClientId
    : googleClientId;

export const GOOGLE_AUTH_CONFIG = {
  clientId: resolvedGoogleClientId,
  origin: getWebOrigin(),
};

const getLinkedInRedirectUri = () => {
  const configured = String(import.meta.env.VITE_LINKEDIN_REDIRECT_URI || "").trim();
  if (configured) return configured;
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/linkedin-auth-callback.html`;
};

export const LINKEDIN_AUTH_CONFIG = {
  clientId: String(import.meta.env.VITE_LINKEDIN_CLIENT_ID || "").trim(),
  redirectUri: getLinkedInRedirectUri(),
  scope: "openid profile email",
};

export const GSTIN = String(import.meta.env.VITE_GSTIN || "GSTIN_PLACEHOLDER").trim();
export const CONTACT_EMAIL = String(import.meta.env.VITE_CONTACT_EMAIL || "ask@nritax.ai").trim();
export const CONTACT_WHATSAPP = String(import.meta.env.VITE_CONTACT_WHATSAPP || "+62-xxx-xxxx-xxxx").trim();
export const CONTACT_CALENDLY_URL = String(import.meta.env.VITE_CONTACT_CALENDLY_URL || "https://calendly.com/logan786-jkt/30min").trim();
