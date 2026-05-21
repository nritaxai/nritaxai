import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const TOKEN_KEY = "nritaxai_auth_token";
const USER_KEY = "nritaxai_user_data";
const EXPIRY_KEY = "nritaxai_token_expiry";
const WEB_AUTH_TOKEN_KEY = "token";
const WEB_AUTH_USER_KEY = "user";
const DEFAULT_EXPIRY_DAYS = 30;

type PersistedUser = Record<string, unknown> | null;

export type PersistedAuth = {
  token: string;
  user: PersistedUser;
};

const parseJwtPayload = (token: string) => {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const getExpiryTimestamp = (token: string, expiryDays: number) => {
  const payload = parseJwtPayload(token);
  const tokenExpSeconds = Number(payload?.exp || 0);
  if (Number.isFinite(tokenExpSeconds) && tokenExpSeconds > 0) {
    return tokenExpSeconds * 1000;
  }
  return Date.now() + expiryDays * 24 * 60 * 60 * 1000;
};

const syncWebStorage = (token: string | null, user: PersistedUser = null) => {
  if (typeof window === "undefined") return;

  if (token) {
    localStorage.setItem(WEB_AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(WEB_AUTH_TOKEN_KEY);
  }

  if (user) {
    localStorage.setItem(WEB_AUTH_USER_KEY, JSON.stringify(user));
  } else if (token === null) {
    localStorage.removeItem(WEB_AUTH_USER_KEY);
  }
};

// Android only
export const persistAuth = async (
  token: string,
  userData: PersistedUser,
  expiryDays: number = DEFAULT_EXPIRY_DAYS
) => {
  if (Capacitor.isNativePlatform()) {
    const normalizedExpiry = getExpiryTimestamp(token, expiryDays);

    await Preferences.set({ key: TOKEN_KEY, value: token });
    await Preferences.set({ key: USER_KEY, value: userData ? JSON.stringify(userData) : "" });
    await Preferences.set({ key: EXPIRY_KEY, value: normalizedExpiry.toString() });
  }

  syncWebStorage(token, userData);
};

// Android only
export const getPersistedAuth = async (): Promise<PersistedAuth | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const [{ value: token }, { value: userData }, { value: expiry }] = await Promise.all([
      Preferences.get({ key: TOKEN_KEY }),
      Preferences.get({ key: USER_KEY }),
      Preferences.get({ key: EXPIRY_KEY }),
    ]);

    if (!token || !expiry) {
      return null;
    }

    if (Date.now() > Number.parseInt(expiry, 10)) {
      await clearPersistedAuth();
      return null;
    }

    return {
      token,
      user: userData ? (JSON.parse(userData) as PersistedUser) : null,
    };
  } catch {
    return null;
  }
};

// Android only
export const clearPersistedAuth = async () => {
  if (!Capacitor.isNativePlatform()) return;

  await Promise.all([
    Preferences.remove({ key: TOKEN_KEY }),
    Preferences.remove({ key: USER_KEY }),
    Preferences.remove({ key: EXPIRY_KEY }),
  ]);
};

// Android only
export const saveAuthToken = async (token: string) => {
  if (Capacitor.isNativePlatform()) {
    const persisted = await getPersistedAuth();
    await persistAuth(token, persisted?.user ?? null);
    return;
  }

  syncWebStorage(token);
};

// Android only
export const getAuthToken = async (): Promise<string | null> => {
  if (Capacitor.isNativePlatform()) {
    const persisted = await getPersistedAuth();
    return persisted?.token ?? null;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(WEB_AUTH_TOKEN_KEY);
};

export const isTokenExpired = (token: string | null | undefined, clockSkewMs = 30_000) => {
  if (!token) return true;
  const payload = parseJwtPayload(token);
  const tokenExpSeconds = Number(payload?.exp || 0);
  if (!Number.isFinite(tokenExpSeconds) || tokenExpSeconds <= 0) return false;
  return Date.now() + clockSkewMs >= tokenExpSeconds * 1000;
};

// Android only
export const clearAuthToken = async () => {
  if (Capacitor.isNativePlatform()) {
    await clearPersistedAuth();
  }

  syncWebStorage(null);
};

// Android only
export const isLoggedIn = async (): Promise<boolean> => {
  const token = await getAuthToken();
  return token !== null && token !== "";
};

// Android only
export const syncPersistedAuthToLocalStorage = async (): Promise<PersistedAuth | null> => {
  const persisted = await getPersistedAuth();
  if (!persisted) {
    syncWebStorage(null);
    return null;
  }

  syncWebStorage(persisted.token, persisted.user);
  return persisted;
};
