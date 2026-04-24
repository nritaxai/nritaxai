import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { IS_ANDROID_NATIVE_APP } from "../config/appConfig";
import { googleLoginUser } from "../utils/api";

let googleSignInInitialized = false;

export const initializeGoogleSignIn = async () => {
  if (!IS_ANDROID_NATIVE_APP || googleSignInInitialized) return;

  await GoogleAuth.initialize({
    scopes: ["profile", "email"],
    grantOfflineAccess: false,
  });

  googleSignInInitialized = true;
};

export const signInWithNativeGoogle = async () => {
  if (!Capacitor.isNativePlatform() || !IS_ANDROID_NATIVE_APP) {
    throw new Error("Native Google Sign-In is only available on Android.");
  }

  await initializeGoogleSignIn();

  const googleUser = await GoogleAuth.signIn();
  const idToken = googleUser?.authentication?.idToken;

  if (!idToken) {
    throw new Error("Google Sign-In did not return an ID token.");
  }

  return googleLoginUser({ idToken });
};
