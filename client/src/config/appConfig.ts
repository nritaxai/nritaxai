import { Capacitor } from "@capacitor/core";
import { SITE_URL, SUPPORT_EMAIL } from "./branding";

const PROD_API_URL_DEFAULT = "https://api.nritax.ai";
const NATIVE_PROD_API_URL_DEFAULT = "https://api.nritax.ai";
const DEV_API_URL_DEFAULT = "http://localhost:5000";

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, "");

const envApiUrl = String(import.meta.env.VITE_API_URL || "").trim();
const envProdApiUrl = String(import.meta.env.VITE_API_URL_PROD || "").trim();
const envNativeProdApiUrl = String(import.meta.env.VITE_API_URL_NATIVE_PROD || "").trim();
const envDevApiUrl = String(import.meta.env.VITE_API_URL_DEV || "").trim();
const envBannerApiUrl = String(import.meta.env.VITE_BANNER_API_URL || "").trim();
const envLinkedInAuthBaseUrl = String(import.meta.env.VITE_LINKEDIN_AUTH_BASE_URL || "").trim();

const isIosWrapperWebView = () => {
  if (typeof window === "undefined") return false;
  const wrappedWindow = window as Window & { __NRITAX_IOS_WRAPPER__?: boolean };
  return (
    Boolean(wrappedWindow.__NRITAX_IOS_WRAPPER__) ||
    window.localStorage.getItem("nritax_ios_wrapper") === "true" ||
    /NRITAXIOSWrapper/i.test(window.navigator.userAgent)
  );
};

export const IS_NATIVE_APP = Capacitor.isNativePlatform() || isIosWrapperWebView();
export const PLATFORM = Capacitor.getPlatform();
export const IS_IOS_NATIVE_APP = (IS_NATIVE_APP && PLATFORM === "ios") || isIosWrapperWebView();
export const IOS_EXTERNAL_PURCHASES_DISABLED = IS_IOS_NATIVE_APP;

const resolvedProdApiUrl = normalizeUrl(envProdApiUrl || PROD_API_URL_DEFAULT);
const resolvedNativeProdApiUrl = normalizeUrl(envNativeProdApiUrl || NATIVE_PROD_API_URL_DEFAULT);
const resolvedDevApiUrl = normalizeUrl(envDevApiUrl || DEV_API_URL_DEFAULT);

export const API_BASE_URL = normalizeUrl(
  envApiUrl ||
    (import.meta.env.DEV && !IS_NATIVE_APP
      ? resolvedDevApiUrl
      : Capacitor.isNativePlatform()
        ? resolvedNativeProdApiUrl // Android only
        : resolvedProdApiUrl)
);

const getBannerOrigin = () => {
  if (envBannerApiUrl) return normalizeUrl(envBannerApiUrl);
  return normalizeUrl(SITE_URL);
};

export const BANNER_API_BASE_URL = normalizeUrl(
  getBannerOrigin()
);

export const APPLE_AUTH_CONFIG = {
  clientId: String(import.meta.env.VITE_APPLE_CLIENT_ID || "").trim(),
  redirectURI: String(import.meta.env.VITE_APPLE_REDIRECT_URI || "").trim(),
  scope: "name email",
  usePopup: true,
  isConfigured: Boolean(
    String(import.meta.env.VITE_APPLE_CLIENT_ID || "").trim() &&
      String(import.meta.env.VITE_APPLE_REDIRECT_URI || "").trim()
  ),
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
  if (typeof window !== "undefined" && !IS_NATIVE_APP) {
    return `${normalizeUrl(window.location.origin)}/linkedin-auth-callback.html`;
  }
  if (configured) return configured;
  return "";
};

export const LINKEDIN_AUTH_CONFIG = {
  clientId: String(import.meta.env.VITE_LINKEDIN_CLIENT_ID || "").trim(),
  redirectUri: getLinkedInRedirectUri(),
  scope: "openid profile email",
  authBaseUrl: normalizeUrl(envLinkedInAuthBaseUrl || "https://api.nritax.ai"),
};

export const GSTIN = String(import.meta.env.VITE_GSTIN || "GSTIN_PLACEHOLDER").trim();
export const CONTACT_EMAIL = SUPPORT_EMAIL;
export const CONTACT_WHATSAPP = String(import.meta.env.VITE_CONTACT_WHATSAPP || "+62-xxx-xxxx-xxxx").trim();
export const CONTACT_CALENDLY_URL = String(import.meta.env.VITE_CONTACT_CALENDLY_URL || "https://calendly.com/logan786-jkt/30min").trim();
