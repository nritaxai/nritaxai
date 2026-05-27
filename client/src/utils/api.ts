import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { BANNER_API_BASE_URL } from "../config/appConfig";

export const API_URL = API_BASE_URL;
export const buildApiUrl = (path: string) => new URL(path, `${API_URL}/`).toString();
export const getStoredAuthToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

export const clearStoredAuth = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new Event("auth-changed"));
};

export const getAuthHeaders = () => {
  const token = getStoredAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  withCredentials: true,
});

const AUTH_BASE_FALLBACKS = ["https://api.nritax.ai", "https://nritax.ai", "https://www.nritax.ai"] as const;

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, "");

const getAuthBaseCandidates = () => {
  const candidates = new Set<string>();

  if (API_URL) {
    candidates.add(normalizeUrl(API_URL));
  }

  if (typeof window !== "undefined") {
    const origin = normalizeUrl(window.location.origin);
    if (origin) {
      candidates.add(origin);
    }
  }

  AUTH_BASE_FALLBACKS.forEach((origin) => candidates.add(origin));
  return Array.from(candidates);
};

const getAuthPathCandidates = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!normalizedPath.startsWith("/api/auth/")) {
    return [normalizedPath];
  }

  return Array.from(
    new Set([
      normalizedPath,
      normalizedPath.replace(/^\/api\/auth\//, "/auth/"),
    ])
  );
};

const logClientApiError = (method: string, path: string, error: any) => {
  const status = error?.response?.status || "NO_RESPONSE";
  const message = error?.response?.data?.message || error?.message || "Unknown error";
  console.error(`[api:${method}] ${path}`, { status, message });
};

const AUTH_ERROR_MESSAGES: Record<number, string> = {
  400: "Please check your details and try again.",
  401: "Invalid credentials. Please check your email and password.",
  403: "Your account cannot access this service right now.",
  404: "Authentication service is unavailable right now.",
  409: "An account with this email already exists.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "Server unavailable. Please try again shortly.",
  502: "Server unavailable. Please try again shortly.",
  503: "Server unavailable. Please try again shortly.",
  504: "Server unavailable. Please try again shortly.",
};

export const getApiErrorMessage = (error: any, fallback = "Unable to complete this request right now") => {
  const responseMessage = String(error?.response?.data?.message || "").trim();
  if (responseMessage) return responseMessage;

  const status = Number(error?.response?.status);
  if (Number.isFinite(status) && AUTH_ERROR_MESSAGES[status]) {
    return AUTH_ERROR_MESSAGES[status];
  }

  if (error?.code === "ERR_NETWORK" || !error?.response) {
    return "Network error. Please check your connection and try again.";
  }

  return String(error?.message || fallback).trim() || fallback;
};

const shouldRetryAuthRequest = (error: any) => {
  const status = Number(error?.response?.status);
  return error?.code === "ERR_NETWORK" || !error?.response || status === 404 || status === 405;
};

const requestAuthEndpoint = async (
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  payload?: unknown
) => {
  const headers = getAuthHeaders();
  const baseCandidates = getAuthBaseCandidates();
  const pathCandidates = getAuthPathCandidates(path);
  let lastError: any = null;

  for (const baseURL of baseCandidates) {
    for (const candidatePath of pathCandidates) {
      try {
        const response = await axios.request({
          method,
          baseURL,
          url: candidatePath,
          data: payload,
          headers,
          timeout: 20000,
          withCredentials: true,
        });
        return response.data;
      } catch (error: any) {
        lastError = error;
        logClientApiError(method, `${baseURL}${candidatePath}`, error);
        if (!shouldRetryAuthRequest(error)) {
          throw error;
        }
      }
    }
  }

  throw lastError;
};

const postRequest = async (path: string, payload: unknown) => {
  try {
    const response = await apiClient.post(path, payload, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error: any) {
    logClientApiError("POST", path, error);
    throw error;
  }
};

const postAuthRequest = (path: string, payload: unknown) => requestAuthEndpoint("POST", path, payload);
const getAuthRequest = (path: string) => requestAuthEndpoint("GET", path);
const putAuthRequest = (path: string, payload: unknown) => requestAuthEndpoint("PUT", path, payload);
const deleteAuthRequest = (path: string) => requestAuthEndpoint("DELETE", path);

const getRequest = async (path: string) => {
  try {
    const response = await apiClient.get(path, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error: any) {
    logClientApiError("GET", path, error);
    throw error;
  }
};

const putRequest = async (path: string, payload: unknown) => {
  try {
    const response = await apiClient.put(path, payload, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error: any) {
    logClientApiError("PUT", path, error);
    throw error;
  }
};

const deleteRequest = async (path: string) => {
  try {
    const response = await apiClient.delete(path, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error: any) {
    logClientApiError("DELETE", path, error);
    throw error;
  }
};

export const signupUser = async (signupData: any) => {
  return postAuthRequest("/api/auth/register", signupData);
};

export const loginUser = async (loginData: any) => {
  return postAuthRequest("/api/auth/login", loginData);
};

export const forgotPassword = async (payload: { email: string }) => {
  return postAuthRequest("/api/auth/forgot-password", payload);
};

export const resetPassword = async (payload: {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}) => {
  return postAuthRequest("/api/auth/reset-password", payload);
};

export const googleLoginUser = async (
  credential:
    | string
    | {
        credential: string;
        termsAccepted?: boolean;
        policyVersion?: string;
        country?: string;
        countryCode?: string;
      }
) => {
  return postAuthRequest(
    "/api/auth/google-login",
    typeof credential === "string" ? { credential } : credential
  );
};

export const appleLoginUser = async (payload: {
  code?: string;
  id_token?: string;
  user?: { name?: { firstName?: string; lastName?: string } };
  authorizationCode?: string;
  identityToken?: string;
  idToken?: string;
  fullName?: { firstName?: string; lastName?: string };
  termsAccepted?: boolean;
  policyVersion?: string;
  country?: string;
  countryCode?: string;
}) => {
  return postAuthRequest("/api/auth/apple", payload);
};

export const linkedinLoginUser = async (payload: {
  code: string;
  redirectUri: string;
  termsAccepted?: boolean;
  policyVersion?: string;
  country?: string;
  countryCode?: string;
}) => {
  return postAuthRequest("/api/auth/linkedin", payload);
};

export const acceptTerms = async (payload: { termsAccepted: boolean; policyVersion?: string }) => {
  return postAuthRequest("/api/auth/accept-terms", payload);
};

export const submitYuktiGrievance = async (payload: {
  message: string;
  source?: string;
  page?: string;
}) => {
  return postRequest("/api/yukti/grievance", payload);
};

export interface BannerUpdate {
  label: string;
  date: string;
  country: string;
  title: string;
  url: string;
  active: boolean;
  priority: number;
}

export const getBannerUpdates = async (country?: string) => {
  const query = country ? `?country=${encodeURIComponent(country)}` : "";
  try {
    const response = await axios.get(`${BANNER_API_BASE_URL}/api/banner-updates${query}`, {
      timeout: 20000,
      withCredentials: false,
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    logClientApiError("GET", `/api/banner-updates${query}`, error);
    throw error;
  }
};

export const getUserProfile = async () => {
  return getAuthRequest("/api/auth/profile");
};

export const getUserPrivacyStatus = async () => {
  return getAuthRequest("/api/auth/privacy-status");
};

export const updatePrivacyConsent = async (payload: {
  acceptTerms?: boolean;
  acceptPrivacyPolicy?: boolean;
  policyVersion?: string;
  consentSource?: string;
  marketingEmails?: boolean;
  productUpdates?: boolean;
  analyticsTracking?: boolean;
  consultationDataProcessing?: boolean;
}) => {
  return putAuthRequest("/api/auth/consent", payload);
};

export const updateUserProfile = async (payload: {
  name?: string;
  profileImage?: string;
  phone?: string;
  countryOfResidence?: string;
  countryCode?: string;
  preferredLanguage?: "english" | "hindi" | "tamil" | "indonesian";
  bio?: string;
  linkedinProfile?: string;
}) => {
  return putAuthRequest("/api/auth/profile", payload);
};

export const requestCountryChange = async (payload: {
  countryCode: string;
  reason?: string;
}) => {
  return postAuthRequest("/api/auth/country-change-request", payload);
};

export const getAdminCountryChangeRequests = async () => {
  return getAuthRequest("/api/auth/admin/country-change-requests");
};

export const decideAdminCountryChangeRequest = async (
  requestId: string,
  payload: { decision: "approved" | "rejected"; decisionNotes?: string }
) => {
  return putAuthRequest(`/api/auth/admin/country-change-requests/${encodeURIComponent(requestId)}`, payload);
};

export const getSubscriptionStatus = async () => {
  return getRequest("/api/subscription/status");
};

export const getMySubscription = async () => {
  return getRequest("/api/subscription/me");
};

export const subscribeToPlan = async (payload: { plan: "professional" | "enterprise" }) => {
  return postRequest("/api/subscription/subscribe", payload);
};

export const cancelMySubscription = async () => {
  return postRequest("/api/subscription/cancel", {});
};

export const changePassword = async (payload: {
  oldPassword?: string;
  newPassword: string;
  confirmNewPassword: string;
}) => {
  return putAuthRequest("/api/auth/change-password", payload);
};

export const deleteAccount = async () => {
  return deleteAuthRequest("/api/auth/delete-account");
};

export const calculateIncomeTax = async (payload: {
  income: string | number;
  country?: string;
  incomeType?: string;
}) => {
  return postRequest("/api/calculator/income-tax", payload);
};

export const calculateCapitalGainsTax = async (payload: {
  purchasePrice: string | number;
  salePrice: string | number;
  period: string;
}) => {
  return postRequest("/api/calculator/capital-gains-tax", payload);
};

export const calculateRentalIncomeTax = async (payload: {
  monthlyRent: string | number;
  expenses: string | number;
}) => {
  return postRequest("/api/calculator/rental-income-tax", payload);
};
