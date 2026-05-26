import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

import { CURRENT_POLICY_VERSION } from "../config/legal";
import { googleLoginUser } from "../utils/api";
import { persistAuth } from "./authStorage";

const GOOGLE_WEB_CLIENT_ID =
  "307987125319-g9bbal34asnd3d16dk269us6lb0jfigs.apps.googleusercontent.com";

let googleInitialized = false;

type NativeGoogleSignInResult = {
  token: string;
  user: Record<string, unknown> | null;
  response: any;
};

// Android only
export const signInWithNativeGoogle = async (): Promise<NativeGoogleSignInResult> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    throw new Error("Native Google Sign-In is only available in the Android app.");
  }

  if (!googleInitialized) {
    await SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        mode: "online",
      },
    });
    googleInitialized = true;
  }

  const googleResult = await SocialLogin.login({
    provider: "google",
    options: {
      filterByAuthorizedAccounts: false,
      autoSelectEnabled: false,
    },
  });
  const idToken = googleResult?.result?.idToken ?? null;

  if (!idToken) {
    throw new Error("No ID token returned from Google");
  }

  const response = await googleLoginUser({
    credential: idToken,
    termsAccepted: true,
    policyVersion: CURRENT_POLICY_VERSION,
  });

  const token = response?.token ?? null;
  const user = response?.user || response?.data?.user || response?.data || null;

  if (!token || !user) {
    throw new Error("Google Sign-In did not return a valid authenticated session.");
  }

  await persistAuth(token, user);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("auth-changed"));
  }

  return { token, user, response };
};
