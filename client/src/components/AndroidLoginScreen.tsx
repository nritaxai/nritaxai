import { Capacitor } from "@capacitor/core";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { CURRENT_POLICY_VERSION } from "../config/legal";
import { LINKEDIN_AUTH_CONFIG } from "../config/appConfig";
import { signupUser, loginUser, forgotPassword } from "../utils/api";
import { persistAuth } from "../services/authStorage";
import { signInWithNativeGoogle } from "../services/googleSignIn";
import { AndroidDecorBackground, ANDROID_THEME } from "./androidTheme";
import { COUNTRY_OPTIONS } from "../app/utils/countries";

type AndroidLoginScreenProps = {
  onClose: () => void;
  disableClose?: boolean;
  onLoginSuccess?: () => void;
};

type ActivePanel = "landing" | "email" | "signup";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const linkedInUrlPattern = /^https?:\/\/(?:www\.)?linkedin\.com\/.+/i;

const buttonBaseStyle = {
  width: "100%",
  borderRadius: ANDROID_THEME.buttonRadius,
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  gap: "7px",
  fontFamily: ANDROID_THEME.fontFamily,
} as const;

const inlinePromptStyle = {
  paddingTop: "0",
  fontSize: "10px",
  color: "rgba(255,255,255,0.5)",
  fontFamily: ANDROID_THEME.fontFamily,
  textAlign: "center",
} as const;

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "12px",
  padding: "10px 14px",
  color: ANDROID_THEME.primaryText,
  fontSize: "12px",
  outline: "none",
  fontFamily: ANDROID_THEME.fontFamily,
} as const;

// Android only
export function AndroidLoginScreen({
  onClose,
  disableClose = false,
  onLoginSuccess,
}: AndroidLoginScreenProps) {
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const [activePanel, setActivePanel] = useState<ActivePanel>("landing");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    linkedinProfile: "",
    countryCode: "",
    password: "",
    confirmPassword: "",
    termsAccepted: true,
  });
  const forgotEmailRef = useRef(loginData.email);
  const isLandingPanel = activePanel === "landing";

  const selectedSignupCountry = useMemo(
    () => COUNTRY_OPTIONS.find((country) => country.code === signupData.countryCode),
    [signupData.countryCode],
  );

  if (!isAndroidNative) {
    return null;
  }

  const handlePersistedAuth = async (response: any) => {
    const token = response?.token ?? null;
    const user = response?.user || response?.data?.user || response?.data || null;

    if (!token || !user) {
      throw new Error("Authentication response was incomplete.");
    }

    await persistAuth(token, user);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("auth-changed"));
      window.dispatchEvent(
        new CustomEvent("nritax:auth-popup", {
          detail: { message: `WELCOME ${String((user as any)?.name || "User")}!`, type: "success", duration: 1200 },
        }),
      );
    }
    onLoginSuccess?.();
  };

  // Android only
  const handleGoogleSignIn = async () => {
    if (!Capacitor.isNativePlatform()) return;

    setAuthError("");
    setLoading(true);

    try {
      await signInWithNativeGoogle();
      onLoginSuccess?.();
    } catch (error: any) {
      console.error("[google-auth] failed:", error);
      setAuthError(error?.message || "Google Sign-In failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Android only
  const handleLinkedInAuth = (mode: "login" | "signup") => {
    try {
      if (!LINKEDIN_AUTH_CONFIG.authBaseUrl) {
        throw new Error("LinkedIn Sign-In is not configured.");
      }

      const authUrl = new URL("/auth/linkedin", `${LINKEDIN_AUTH_CONFIG.authBaseUrl}/`);
      authUrl.searchParams.set("mode", mode);
      authUrl.searchParams.set("origin", window.location.origin);

      if (mode === "signup") {
        if (!selectedSignupCountry?.name || !signupData.countryCode) {
          setAuthError("Please select your country before creating an account.");
          return;
        }
        authUrl.searchParams.set("termsAccepted", "true");
        authUrl.searchParams.set("policyVersion", CURRENT_POLICY_VERSION);
        authUrl.searchParams.set("countryCode", signupData.countryCode);
        authUrl.searchParams.set("country", selectedSignupCountry.name);
      }

      window.location.href = authUrl.toString();
    } catch (error: any) {
      setAuthError(error?.message || "LinkedIn Sign-In could not start.");
    }
  };

  // Android only
  const handleEmailLogin = async () => {
    setAuthError("");

    if (!EMAIL_PATTERN.test(loginData.email.trim())) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (!loginData.password.trim()) {
      setAuthError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser({
        email: loginData.email.trim().toLowerCase(),
        password: loginData.password,
      });
      await handlePersistedAuth(response);
    } catch (error: any) {
      setAuthError(error?.response?.data?.message || error?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Android only
  const handleSignup = async () => {
    setAuthError("");

    if (!signupData.name.trim() || !EMAIL_PATTERN.test(signupData.email.trim())) {
      setAuthError("Please add your name and a valid email address.");
      return;
    }
    if (signupData.linkedinProfile.trim() && !linkedInUrlPattern.test(signupData.linkedinProfile.trim())) {
      setAuthError("LinkedIn profile must be a valid linkedin.com URL.");
      return;
    }
    if (!selectedSignupCountry?.name || !signupData.countryCode) {
      setAuthError("Please select your country.");
      return;
    }
    if (signupData.password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    if (signupData.password !== signupData.confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await signupUser({
        name: signupData.name.trim(),
        email: signupData.email.trim().toLowerCase(),
        linkedinProfile: signupData.linkedinProfile.trim(),
        country: selectedSignupCountry.name,
        countryCode: signupData.countryCode,
        password: signupData.password,
        confirmPassword: signupData.confirmPassword,
        termsAccepted: true,
        acceptedTerms: true,
        policyVersion: CURRENT_POLICY_VERSION,
        termsAcceptedAt: new Date().toISOString(),
      });
      await handlePersistedAuth(response);
    } catch (error: any) {
      setAuthError(error?.response?.data?.message || error?.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Android only
  const handleForgotPassword = async () => {
    const email = forgotEmailRef.current?.trim() || loginData.email.trim();

    if (!EMAIL_PATTERN.test(email)) {
      setAuthError("Please enter a valid email address first.");
      return;
    }

    setLoading(true);
    setAuthError("");
    try {
      await forgotPassword({ email });
      setAuthError("Reset link sent. Please check your email.");
    } catch (error: any) {
      setAuthError(error?.response?.data?.message || error?.message || "Unable to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  const renderGoogleIcon = () => (
    <svg width="13" height="13" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="M6.3 14.7 12.9 19.5C14.7 15.2 19 12 24 12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.2C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.5 16.3 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.2 5.5-6.1 7.1l.1-.1 6.2 5.2C35 40.5 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
    </svg>
  );

  const signupPrompt = (
    <div style={inlinePromptStyle}>
      <button
        type="button"
        onClick={() => setActivePanel("signup")}
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          fontSize: "10px",
          color: "rgba(255,255,255,0.5)",
          fontFamily: ANDROID_THEME.fontFamily,
          textAlign: "center",
        }}
      >
        Need an account?{" "}
        <span style={{ color: "rgba(255,255,255,0.8)", textDecoration: "underline", fontWeight: 600 }}>
          {"Sign up ->"}
        </span>
      </button>
    </div>
  );

  return (
    <main
      style={{
        height: "100dvh",
        background: ANDROID_THEME.background,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        fontFamily: ANDROID_THEME.fontFamily,
      }}
    >
      <AndroidDecorBackground />

      <div
        style={{
          zIndex: 2,
          padding: "env(safe-area-inset-top,14px) 14px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "2.5px",
            color: ANDROID_THEME.primaryText,
          }}
        >
          NRITAX.AI
        </div>
        {!disableClose ? (
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: 0, padding: 0, color: "rgba(255,255,255,0.6)" }}
            aria-label="Close login screen"
          >
            <X size={20} />
          </button>
        ) : null}
      </div>

      <div style={{ zIndex: 2, padding: "16px 16px 12px" }}>
        <div
          style={{
            fontSize: "22px",
            fontWeight: 900,
            letterSpacing: "-0.5px",
            lineHeight: 1.1,
            color: ANDROID_THEME.primaryText,
            marginBottom: "4px",
          }}
        >
          Welcome back
        </div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.5,
          }}
        >
          Sign in to manage your NRI taxes with AI.
        </div>
      </div>

      <div
        style={{
          zIndex: 2,
          padding: "0 12px env(safe-area-inset-bottom,12px)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flex: isLandingPanel ? "0 0 auto" : 1,
          minHeight: 0,
        }}
      >
        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={loading}
          style={{
            ...buttonBaseStyle,
            background: "#ffffff",
            border: "none",
            color: "#000000",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {renderGoogleIcon()}
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#000000", letterSpacing: "0.1px" }}>
            {"Google sign in ->"}
          </span>
        </button>
        {authError ? (
          <div style={{ fontSize: "10px", color: "#ff6b6b", marginTop: "-4px", padding: "0 4px" }}>{authError}</div>
        ) : null}

        <button
          type="button"
          onClick={() => handleLinkedInAuth("login")}
          style={{
            ...buttonBaseStyle,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.20)",
            color: ANDROID_THEME.primaryText,
          }}
        >
          <span
            style={{
              width: "13px",
              height: "13px",
              borderRadius: "2px",
              background: "#0077B5",
              color: "#ffffff",
              fontSize: "7px",
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            in
          </span>
          <span style={{ fontSize: "11px", fontWeight: 700, color: ANDROID_THEME.primaryText }}>
            {"LinkedIn sign in ->"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAuthError("");
            setActivePanel("email");
          }}
          style={{
            ...buttonBaseStyle,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: ANDROID_THEME.primaryText,
          }}
        >
          <Mail size={12} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: ANDROID_THEME.primaryText }}>
            {"Log in with email ->"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAuthError("");
            setActivePanel("signup");
          }}
          style={{
            ...buttonBaseStyle,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: ANDROID_THEME.primaryText,
          }}
        >
          <UserPlus size={12} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: ANDROID_THEME.primaryText }}>
            {"Create account ->"}
          </span>
        </button>
        {isLandingPanel ? (
          <div style={{ marginTop: "-2px" }}>
            {signupPrompt}
          </div>
        ) : null}
        <div
          style={{
            zIndex: 2,
            paddingTop: isLandingPanel ? "0" : "10px",
            flex: isLandingPanel ? "0 0 auto" : 1,
            minHeight: 0,
            overflowY: isLandingPanel ? "visible" : "auto",
          }}
        >
        <AnimatePresence mode="wait">
          {activePanel === "email" ? (
            <motion.div
              key="email-form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              style={{ display: "flex", flexDirection: "column", gap: "9px" }}
            >
              <input
                type="email"
                placeholder="Email address"
                value={loginData.email}
                onChange={(event) => {
                  forgotEmailRef.current = event.target.value;
                  setLoginData((prev) => ({ ...prev, email: event.target.value }));
                }}
                style={inputStyle}
              />
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={loginData.password}
                  onChange={(event) => setLoginData((prev) => ({ ...prev, password: event.target.value }))}
                  style={{ ...inputStyle, paddingRight: "42px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: 0,
                    color: ANDROID_THEME.primaryText,
                  }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleEmailLogin()}
                disabled={loading}
                style={{
                  width: "100%",
                  background: "#ffffff",
                  color: "#0a1f5c",
                  borderRadius: ANDROID_THEME.buttonRadius,
                  padding: "11px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 700,
                  fontFamily: ANDROID_THEME.fontFamily,
                }}
              >
                {loading ? "Signing in..." : "Sign in ->"}
              </button>
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "rgba(255,255,255,0.55)",
                  fontSize: "10px",
                  textAlign: "right",
                  fontFamily: ANDROID_THEME.fontFamily,
                }}
              >
                Forgot password?
              </button>
              {signupPrompt}
            </motion.div>
          ) : null}

          {activePanel === "signup" ? (
            <motion.div
              key="signup-form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              style={{ display: "flex", flexDirection: "column", gap: "9px" }}
            >
              <input
                type="text"
                placeholder="Full name"
                value={signupData.name}
                onChange={(event) => setSignupData((prev) => ({ ...prev, name: event.target.value }))}
                style={inputStyle}
              />
              <input
                type="email"
                placeholder="Email address"
                value={signupData.email}
                onChange={(event) => setSignupData((prev) => ({ ...prev, email: event.target.value }))}
                style={inputStyle}
              />
              <input
                type="url"
                placeholder="LinkedIn profile (optional)"
                value={signupData.linkedinProfile}
                onChange={(event) => setSignupData((prev) => ({ ...prev, linkedinProfile: event.target.value }))}
                style={inputStyle}
              />
              <select
                value={signupData.countryCode}
                onChange={(event) => setSignupData((prev) => ({ ...prev, countryCode: event.target.value }))}
                style={{ ...inputStyle, color: signupData.countryCode ? "#ffffff" : "rgba(255,255,255,0.35)" }}
              >
                <option value="" style={{ color: "#0a1f5c" }}>Select country</option>
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.code} value={country.code} style={{ color: "#0a1f5c" }}>
                    {country.name}
                  </option>
                ))}
              </select>
              <div style={{ position: "relative" }}>
                <input
                  type={showSignupPassword ? "text" : "password"}
                  placeholder="Password"
                  value={signupData.password}
                  onChange={(event) => setSignupData((prev) => ({ ...prev, password: event.target.value }))}
                  style={{ ...inputStyle, paddingRight: "42px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: 0,
                    color: ANDROID_THEME.primaryText,
                  }}
                >
                  {showSignupPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showSignupConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={signupData.confirmPassword}
                  onChange={(event) => setSignupData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  style={{ ...inputStyle, paddingRight: "42px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowSignupConfirmPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: 0,
                    color: ANDROID_THEME.primaryText,
                  }}
                >
                  {showSignupConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleSignup()}
                disabled={loading}
                style={{
                  width: "100%",
                  background: "#ffffff",
                  color: "#0a1f5c",
                  borderRadius: ANDROID_THEME.buttonRadius,
                  padding: "11px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 700,
                  fontFamily: ANDROID_THEME.fontFamily,
                }}
              >
                {loading ? "Creating account..." : "Create account ->"}
              </button>
              <button
                type="button"
                onClick={() => handleLinkedInAuth("signup")}
                style={{
                  ...buttonBaseStyle,
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: ANDROID_THEME.primaryText,
                }}
              >
                <span
                  style={{
                    width: "13px",
                    height: "13px",
                    borderRadius: "2px",
                    background: "#0077B5",
                    color: "#ffffff",
                    fontSize: "7px",
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  in
                </span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: ANDROID_THEME.primaryText }}>
                  {"LinkedIn sign in ->"}
                </span>
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

export default AndroidLoginScreen;
