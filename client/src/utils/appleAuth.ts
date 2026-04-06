import { APPLE_AUTH_CONFIG } from "../config/appConfig";

const APPLE_AUTH_SDK_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (options: Record<string, unknown>) => void;
        signIn: () => Promise<{
          authorization?: {
            code?: string;
            id_token?: string;
          };
          user?: {
            name?: {
              firstName?: string;
              lastName?: string;
            };
          };
        }>;
      };
    };
  }
}

let appleSdkLoader: Promise<void> | null = null;

const loadAppleAuthSdk = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Apple Sign in is unavailable outside the browser."));
  }

  if (window.AppleID?.auth) {
    return Promise.resolve();
  }

  if (appleSdkLoader) {
    return appleSdkLoader;
  }

  appleSdkLoader = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${APPLE_AUTH_SDK_URL}"]`
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Apple Sign in SDK.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = APPLE_AUTH_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Apple Sign in SDK."));
    document.head.appendChild(script);
  });

  return appleSdkLoader;
};

export const canStartAppleAuth = () => APPLE_AUTH_CONFIG.isConfigured;

export const startAppleAuth = async () => {
  if (!canStartAppleAuth()) {
    throw new Error("Apple Sign in is not configured for this build.");
  }

  await loadAppleAuthSdk();

  if (!window.AppleID?.auth) {
    throw new Error("Apple Sign in SDK did not initialize correctly.");
  }

  window.AppleID.auth.init({
    clientId: APPLE_AUTH_CONFIG.clientId,
    scope: APPLE_AUTH_CONFIG.scope,
    redirectURI: APPLE_AUTH_CONFIG.redirectURI,
    usePopup: APPLE_AUTH_CONFIG.usePopup,
  });

  return window.AppleID.auth.signIn();
};
