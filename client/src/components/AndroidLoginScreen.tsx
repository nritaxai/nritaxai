import { Capacitor } from "@capacitor/core";
import { Eye, EyeOff, Lock, Mail, User, X } from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";

import { COUNTRY_OPTIONS } from "../app/utils/countries";
import { LINKEDIN_AUTH_CONFIG } from "../config/appConfig";
import { CURRENT_POLICY_VERSION } from "../config/legal";
import { persistAuth } from "../services/authStorage";
import { signInWithNativeGoogle } from "../services/googleSignIn";
import { forgotPassword, loginUser, signupUser } from "../utils/api";

type AndroidLoginScreenProps = {
  onClose: () => void;
  disableClose?: boolean;
  onLoginSuccess?: () => void;
};

type AuthMode = "login" | "register";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINKEDIN_URL_PATTERN = /^https?:\/\/(?:www\.)?linkedin\.com\/.+/i;

const TOKENS = {
  primaryGreen: "#5B8A3C",
  greenHover: "#4a7230",
  greenLight: "#f0f7eb",
  background: "#ffffff",
  inputBorder: "#e2e8f0",
  inputFocus: "#5B8A3C",
  textPrimary: "#1a1a1a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  tabBg: "#f1f5f9",
  fontFamily: "system-ui,-apple-system,sans-serif",
} as const;

const baseInputStyle = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  color: TOKENS.textPrimary,
  fontSize: "13px",
  fontFamily: TOKENS.fontFamily,
  padding: 0,
} as const;

export function AndroidLoginScreen({
  onClose,
  disableClose = false,
  onLoginSuccess,
}: AndroidLoginScreenProps) {
  const isNativePlatform = Capacitor.isNativePlatform();

  const [mode, setMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
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
  const forgotEmailRef = useRef("");

  const selectedSignupCountry = useMemo(
    () => COUNTRY_OPTIONS.find((country) => country.code === signupData.countryCode),
    [signupData.countryCode],
  );

  if (!isNativePlatform) {
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
          detail: {
            message: `WELCOME ${String((user as { name?: string })?.name || "User")}!`,
            type: "success",
            duration: 1200,
          },
        }),
      );
    }
    onLoginSuccess?.();
  };

  const handleGoogleSignIn = async () => {
    if (!Capacitor.isNativePlatform()) return;

    setAuthError("");
    setLoading(true);

    try {
      await signInWithNativeGoogle();
      onLoginSuccess?.();
    } catch (error: any) {
      console.error("[google-auth] failed:", error);
      setAuthError(
        error?.code === "USER_CANCELLED" || String(error?.message || "").includes("could not reach Google services")
          ? "Google Sign-In could not reach Google services. Please check the emulator internet and try again."
          : error?.message || "Google Sign-In failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLinkedInAuth = (authMode: AuthMode) => {
    try {
      if (!LINKEDIN_AUTH_CONFIG.authBaseUrl) {
        throw new Error("LinkedIn Sign-In is not configured.");
      }

      const authUrl = new URL("/auth/linkedin", `${LINKEDIN_AUTH_CONFIG.authBaseUrl}/`);
      authUrl.searchParams.set("mode", authMode === "register" ? "signup" : "login");
      authUrl.searchParams.set("origin", window.location.origin);

      if (authMode === "register") {
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

  const handleSignup = async () => {
    setAuthError("");

    if (!signupData.name.trim() || !EMAIL_PATTERN.test(signupData.email.trim())) {
      setAuthError("Please add your name and a valid email address.");
      return;
    }
    if (signupData.linkedinProfile.trim() && !LINKEDIN_URL_PATTERN.test(signupData.linkedinProfile.trim())) {
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

  const handleForgotPassword = async () => {
    const email = forgotEmailRef.current.trim() || loginData.email.trim();

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

  const renderLayersIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 4 7l8 4 8-4-8-4Z" fill="#fff" opacity="0.95" />
      <path d="M4 12l8 4 8-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16.5l8 4 8-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );

  const renderGoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="M6.3 14.7 12.9 19.5C14.7 15.2 19 12 24 12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.2C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.5 16.3 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.2 5.5-6.1 7.1l.1-.1 6.2 5.2C35 40.5 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
    </svg>
  );

  const fieldShell = (icon: ReactNode, label: string, child: ReactNode, withBottomMargin = true) => (
    <div
      style={{
        border: `1.5px solid ${TOKENS.inputBorder}`,
        borderRadius: "10px",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: withBottomMargin ? "8px" : 0,
        background: TOKENS.background,
      }}
    >
      <div style={{ color: TOKENS.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "8px",
            fontWeight: 600,
            color: TOKENS.textMuted,
            letterSpacing: "0.3px",
            marginBottom: "4px",
          }}
        >
          {label}
        </div>
        {child}
      </div>
    </div>
  );

  return (
    <main
      style={{
        height: "100dvh",
        background: TOKENS.background,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        paddingTop: "env(safe-area-inset-top)",
        fontFamily: TOKENS.fontFamily,
      }}
    >
      <section
        style={{
          background: TOKENS.primaryGreen,
          padding: "28px 20px 28px",
          textAlign: "center",
          position: "relative",
        }}
      >
        {!disableClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login screen"
            style={{
              position: "absolute",
              top: "18px",
              right: "16px",
              border: 0,
              background: "transparent",
              color: "rgba(255,255,255,0.9)",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        ) : null}

        <div
          style={{
            fontSize: "11px",
            fontWeight: 800,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "3px",
            marginBottom: "12px",
          }}
        >
          NRITAX.AI
        </div>

        <div
          style={{
            width: "48px",
            height: "48px",
            margin: "0 auto 12px",
            borderRadius: "14px",
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {renderLayersIcon()}
        </div>

        <div
          style={{
            fontSize: "20px",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.4px",
            lineHeight: 1.2,
            marginBottom: "6px",
          }}
        >
          Sign in to your NRI Tax account
        </div>

        <div
          style={{
            fontSize: "12px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          Manage your taxes with AI
        </div>
      </section>

      <section
        style={{
          background: TOKENS.background,
          borderRadius: "24px 24px 0 0",
          flex: 1,
          padding: "20px 18px 0",
          overflowY: "auto",
          marginTop: "-8px",
        }}
      >
        <div
          style={{
            background: TOKENS.tabBg,
            borderRadius: "10px",
            padding: "3px",
            display: "flex",
            marginBottom: "16px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setAuthError("");
            }}
            style={{
              flex: 1,
              border: 0,
              borderRadius: "8px",
              padding: "9px",
              background: mode === "login" ? TOKENS.primaryGreen : "transparent",
              color: mode === "login" ? "#ffffff" : TOKENS.textSecondary,
              fontSize: "12px",
              fontWeight: mode === "login" ? 700 : 600,
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setAuthError("");
            }}
            style={{
              flex: 1,
              border: 0,
              borderRadius: "8px",
              padding: "9px",
              background: mode === "register" ? TOKENS.primaryGreen : "transparent",
              color: mode === "register" ? "#ffffff" : TOKENS.textSecondary,
              fontSize: "12px",
              fontWeight: mode === "register" ? 700 : 600,
            }}
          >
            Register
          </button>
        </div>

        {mode === "login" ? (
          <>
            {fieldShell(
              <Mail size={14} />,
              "EMAIL ADDRESS",
              <input
                type="email"
                placeholder="Enter your email"
                value={loginData.email}
                onChange={(event) => {
                  forgotEmailRef.current = event.target.value;
                  setLoginData((prev) => ({ ...prev, email: event.target.value }));
                }}
                style={baseInputStyle}
              />,
            )}

            {fieldShell(
              <Lock size={14} />,
              "PASSWORD",
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={loginData.password}
                  onChange={(event) => setLoginData((prev) => ({ ...prev, password: event.target.value }))}
                  style={{ ...baseInputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: TOKENS.textMuted,
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showLoginPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>,
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                disabled={loading}
                style={{
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  color: TOKENS.primaryGreen,
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleEmailLogin()}
              disabled={loading}
              style={{
                width: "100%",
                border: 0,
                borderRadius: "12px",
                padding: "12px 16px",
                background: TOKENS.primaryGreen,
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                marginBottom: "12px",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={loading}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  padding: "11px 14px",
                  border: `1px solid ${TOKENS.inputBorder}`,
                  background: TOKENS.background,
                  color: TOKENS.textPrimary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {renderGoogleIcon()}
                Continue with Google
              </button>

              <button
                type="button"
                onClick={() => handleLinkedInAuth("login")}
                disabled={loading}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  padding: "11px 14px",
                  border: `1px solid ${TOKENS.inputBorder}`,
                  background: TOKENS.greenLight,
                  color: TOKENS.textPrimary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    background: "#0077B5",
                    color: "#ffffff",
                    fontSize: "10px",
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  in
                </span>
                Continue with LinkedIn
              </button>
            </div>
          </>
        ) : (
          <>
            {fieldShell(
              <User size={14} />,
              "FULL NAME",
              <input
                type="text"
                placeholder="Enter your full name"
                value={signupData.name}
                onChange={(event) => setSignupData((prev) => ({ ...prev, name: event.target.value }))}
                style={baseInputStyle}
              />,
            )}

            {fieldShell(
              <Mail size={14} />,
              "EMAIL ADDRESS",
              <input
                type="email"
                placeholder="Enter your email"
                value={signupData.email}
                onChange={(event) => setSignupData((prev) => ({ ...prev, email: event.target.value }))}
                style={baseInputStyle}
              />,
            )}

            {fieldShell(
              <span style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1 }}>in</span>,
              "LINKEDIN PROFILE",
              <input
                type="url"
                placeholder="Optional linkedin.com profile"
                value={signupData.linkedinProfile}
                onChange={(event) => setSignupData((prev) => ({ ...prev, linkedinProfile: event.target.value }))}
                style={baseInputStyle}
              />,
            )}

            {fieldShell(
              <span style={{ fontSize: "14px", lineHeight: 1 }}>+</span>,
              "COUNTRY",
              <select
                value={signupData.countryCode}
                onChange={(event) => setSignupData((prev) => ({ ...prev, countryCode: event.target.value }))}
                style={{ ...baseInputStyle, color: signupData.countryCode ? TOKENS.textPrimary : TOKENS.textMuted }}
              >
                <option value="">Select your country</option>
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>,
            )}

            {fieldShell(
              <Lock size={14} />,
              "PASSWORD",
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type={showSignupPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={signupData.password}
                  onChange={(event) => setSignupData((prev) => ({ ...prev, password: event.target.value }))}
                  style={{ ...baseInputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword((prev) => !prev)}
                  aria-label={showSignupPassword ? "Hide password" : "Show password"}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: TOKENS.textMuted,
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showSignupPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>,
            )}

            {fieldShell(
              <Lock size={14} />,
              "CONFIRM PASSWORD",
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type={showSignupConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={signupData.confirmPassword}
                  onChange={(event) => setSignupData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  style={{ ...baseInputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setShowSignupConfirmPassword((prev) => !prev)}
                  aria-label={showSignupConfirmPassword ? "Hide password" : "Show password"}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: TOKENS.textMuted,
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showSignupConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>,
              false,
            )}

            <div
              style={{
                marginTop: "12px",
                marginBottom: "12px",
                fontSize: "11px",
                lineHeight: 1.5,
                color: TOKENS.textSecondary,
              }}
            >
              By continuing, you agree to the latest NRITAX.AI terms and privacy policy.
            </div>

            <button
              type="button"
              onClick={() => void handleSignup()}
              disabled={loading}
              style={{
                width: "100%",
                border: 0,
                borderRadius: "12px",
                padding: "12px 16px",
                background: TOKENS.primaryGreen,
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                marginBottom: "12px",
              }}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => handleLinkedInAuth("register")}
              disabled={loading}
              style={{
                width: "100%",
                borderRadius: "12px",
                padding: "11px 14px",
                border: `1px solid ${TOKENS.inputBorder}`,
                background: TOKENS.greenLight,
                color: TOKENS.textPrimary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "4px",
                  background: "#0077B5",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                in
              </span>
              Continue with LinkedIn
            </button>
          </>
        )}

        {authError ? (
          <div
            style={{
              borderRadius: "12px",
              background: mode === "login" && authError.includes("Reset link sent") ? TOKENS.greenLight : "#fef2f2",
              color: mode === "login" && authError.includes("Reset link sent") ? TOKENS.primaryGreen : "#b91c1c",
              padding: "10px 12px",
              fontSize: "12px",
              lineHeight: 1.4,
              marginBottom: "18px",
            }}
          >
            {authError}
          </div>
        ) : null}

        <div
          style={{
            paddingBottom: "max(18px, env(safe-area-inset-bottom))",
            textAlign: "center",
            fontSize: "12px",
            color: TOKENS.textSecondary,
          }}
        >
          {mode === "login" ? "New to NRITAX.AI?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setAuthError("");
            }}
            style={{
              border: 0,
              background: "transparent",
              color: TOKENS.primaryGreen,
              fontSize: "12px",
              fontWeight: 700,
              padding: 0,
            }}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}

export default AndroidLoginScreen;
