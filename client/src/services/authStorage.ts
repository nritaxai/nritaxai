import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const NATIVE_AUTH_TOKEN_KEY = "auth_token";
const NATIVE_AUTH_TIMESTAMP_KEY = "auth_timestamp";
const WEB_AUTH_TOKEN_KEY = "token";

// Android only
export const saveAuthToken = async (token: string) => {
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: NATIVE_AUTH_TOKEN_KEY, value: token });
    await Preferences.set({
      key: NATIVE_AUTH_TIMESTAMP_KEY,
      value: Date.now().toString(),
    });
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(WEB_AUTH_TOKEN_KEY, token);
  }
};

// Android only
export const getAuthToken = async (): Promise<string | null> => {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: NATIVE_AUTH_TOKEN_KEY });
    return value;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(WEB_AUTH_TOKEN_KEY);
};

// Android only
export const clearAuthToken = async () => {
  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key: NATIVE_AUTH_TOKEN_KEY });
    await Preferences.remove({ key: NATIVE_AUTH_TIMESTAMP_KEY });
  }

  if (typeof window !== "undefined") {
    localStorage.removeItem(WEB_AUTH_TOKEN_KEY);
  }
};

// Android only
export const isLoggedIn = async (): Promise<boolean> => {
  const token = await getAuthToken();
  return token !== null && token !== "";
};

// Android only
export const syncAuthTokenToLocalStorage = async (): Promise<string | null> => {
  const token = await getAuthToken();
  if (typeof window === "undefined") {
    return token;
  }

  if (token) {
    localStorage.setItem(WEB_AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(WEB_AUTH_TOKEN_KEY);
  }

  return token;
};
