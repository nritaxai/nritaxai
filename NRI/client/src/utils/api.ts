import axios from "axios";
import { Capacitor } from "@capacitor/core";

const PRODUCTION_API_URL = "https://nritax.ai";
const LOCAL_API_URL = "http://localhost:5000";

const isLocalHost = () => {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
};

export const API_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  (isLocalHost() && !Capacitor.isNativePlatform() ? LOCAL_API_URL : PRODUCTION_API_URL);

export const buildApiUrl = (path: string) => `${API_URL}${path}`;

export const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const shouldFallbackToLocal = (error: any) => {
  const statusCode = Number(error?.response?.status || 0);
  return (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    API_URL !== LOCAL_API_URL &&
    (error?.code === "ERR_NETWORK" || statusCode >= 400)
  );
};

const postWithLocalFallback = async (path: string, payload: unknown) => {
  try {
    const response = await axios.post(buildApiUrl(path), payload, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error: any) {
    if (!shouldFallbackToLocal(error)) throw error;

    const fallbackResponse = await axios.post(`${LOCAL_API_URL}${path}`, payload, {
      headers: getAuthHeaders(),
    });
    return fallbackResponse.data;
  }
};

const getWithLocalFallback = async (path: string) => {
  try {
    const response = await axios.get(buildApiUrl(path), {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error: any) {
    if (!shouldFallbackToLocal(error)) throw error;

    const fallbackResponse = await axios.get(`${LOCAL_API_URL}${path}`, {
      headers: getAuthHeaders(),
    });
    return fallbackResponse.data;
  }
};

const putWithLocalFallback = async (path: string, payload: unknown) => {
  try {
    const response = await axios.put(buildApiUrl(path), payload, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error: any) {
    if (!shouldFallbackToLocal(error)) throw error;

    const fallbackResponse = await axios.put(`${LOCAL_API_URL}${path}`, payload, {
      headers: getAuthHeaders(),
    });
    return fallbackResponse.data;
  }
};

export const signupUser = async (signupData: any) => {
  return postWithLocalFallback("/api/auth/register", signupData);
};

export const loginUser = async (loginData: any) => {
  return postWithLocalFallback("/api/auth/login", loginData);
};

export const googleLoginUser = async (credential: string) => {
  return postWithLocalFallback("/api/auth/google-login", { credential });
};

export const getUserProfile = async () => {
  return getWithLocalFallback("/api/auth/profile");
};

export const updateUserProfile = async (payload: {
  name?: string;
  profileImage?: string;
  phone?: string;
  countryOfResidence?: string;
  preferredLanguage?: "english" | "hindi" | "tamil" | "indonesian";
  bio?: string;
}) => {
  return putWithLocalFallback("/api/auth/profile", payload);
};

export const getSubscriptionStatus = async () => {
  return getWithLocalFallback("/api/subscription/status");
};

export const changePassword = async (payload: {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}) => {
  return putWithLocalFallback("/api/auth/change-password", payload);
};

export const deleteAccount = async () => {
  try {
    const response = await axios.delete(buildApiUrl("/api/auth/delete-account"), {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error: any) {
    if (!shouldFallbackToLocal(error)) throw error;

    const fallbackResponse = await axios.delete(`${LOCAL_API_URL}/api/auth/delete-account`, {
      headers: getAuthHeaders(),
    });
    return fallbackResponse.data;
  }
};

export const calculateIncomeTax = async (payload: {
  income: string | number;
  country?: string;
  incomeType?: string;
}) => {
  return postWithLocalFallback("/api/calculator/income-tax", payload);
};

export const calculateCapitalGainsTax = async (payload: {
  purchasePrice: string | number;
  salePrice: string | number;
  period: string;
}) => {
  return postWithLocalFallback("/api/calculator/capital-gains-tax", payload);
};

export const calculateRentalIncomeTax = async (payload: {
  monthlyRent: string | number;
  expenses: string | number;
}) => {
  return postWithLocalFallback("/api/calculator/rental-income-tax", payload);
};
