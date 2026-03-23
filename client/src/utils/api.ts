import axios from "axios";
import { API_BASE_URL } from "../config/api";

export const API_URL = API_BASE_URL;
export const buildApiUrl = (path: string) => `${API_URL}${path}`;
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

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  withCredentials: true,
});

const logClientApiError = (method: string, path: string, error: any) => {
  const status = error?.response?.status || "NO_RESPONSE";
  const message = error?.response?.data?.message || error?.message || "Unknown error";
  console.error(`[api:${method}] ${path}`, { status, message });
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
  return postRequest("/api/auth/register", signupData);
};

export const loginUser = async (loginData: any) => {
  return postRequest("/api/auth/login", loginData);
};

export const forgotPassword = async (payload: { email: string }) => {
  return postRequest("/api/auth/forgot-password", payload);
};

export const resetPassword = async (payload: {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}) => {
  return postRequest("/api/auth/reset-password", payload);
};

export const googleLoginUser = async (credential: string) => {
  return postRequest("/api/auth/google-login", { credential });
};

export const appleLoginUser = async (payload: {
  code?: string;
  id_token?: string;
  user?: { name?: { firstName?: string; lastName?: string } };
  authorizationCode?: string;
  identityToken?: string;
  idToken?: string;
  fullName?: { firstName?: string; lastName?: string };
}) => {
  return postRequest("/api/auth/apple", payload);
};

export const linkedinLoginUser = async (payload: {
  code: string;
  redirectUri: string;
}) => {
  return postRequest("/api/auth/linkedin", payload);
};

export const getUserProfile = async () => {
  return getRequest("/api/auth/profile");
};

export const updateUserProfile = async (payload: {
  name?: string;
  profileImage?: string;
  phone?: string;
  countryOfResidence?: string;
  preferredLanguage?: "english" | "hindi" | "tamil" | "indonesian";
  bio?: string;
  linkedinProfile?: string;
}) => {
  return putRequest("/api/auth/profile", payload);
};

export const getSubscriptionStatus = async () => {
  return getRequest("/api/subscription/status");
};

export const changePassword = async (payload: {
  oldPassword?: string;
  newPassword: string;
  confirmNewPassword: string;
}) => {
  return putRequest("/api/auth/change-password", payload);
};

export const deleteAccount = async () => {
  return deleteRequest("/api/auth/delete-account");
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
