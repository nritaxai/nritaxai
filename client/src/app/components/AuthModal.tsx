import { useEffect, useMemo, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Apple, ArrowLeft, Linkedin, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AuthPopup } from "./AuthPopup";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { COMPANY_LEGAL_NAME } from "../../config/branding";
import { CURRENT_POLICY_VERSION } from "../../config/legal";
import {
  APPLE_AUTH_CONFIG,
  GOOGLE_AUTH_CONFIG,
  IS_IOS_NATIVE_APP,
  LINKEDIN_AUTH_CONFIG,
} from "../../config/appConfig";
import { startAppleAuth } from "../../utils/appleAuth";
import {
  appleLoginUser,
  forgotPassword,
  getApiErrorMessage,
  googleLoginUser,
  loginUser,
  signupUser,
} from "../../utils/api";
import { COUNTRY_OPTIONS } from "../utils/countries";

interface AuthModalProps {
  initialMode?: "login" | "signup";
  redirectTo?: string;
  onModeChange?: (mode: "login" | "signup") => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINKEDIN_URL_PATTERN = /^https?:\/\/(?:www\.)?linkedin\.com\/.+/i;
const MIN_PASSWORD_LENGTH = 8;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function SocialButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 w-full justify-center rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="mr-2 inline-flex items-center justify-center">{icon}</span>
      {label}
    </Button>
  );
}

function SocialDivider({ label }: { label: string }) {
  return (
    <div className="relative my-1">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span className="bg-white px-3">{label}</span>
      </div>
    </div>
  );
}

export function AuthModal({
  initialMode = "login",
  redirectTo = "/home",
  onModeChange,
}: AuthModalProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    linkedinProfile: "",
    countryCode: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });

  const canUseGoogleAuth = Boolean(GOOGLE_AUTH_CONFIG.clientId);
  const canUseLinkedInAuth = Boolean(LINKEDIN_AUTH_CONFIG.authBaseUrl);
  const canUseAppleAuth = APPLE_AUTH_CONFIG.isConfigured || IS_IOS_NATIVE_APP;
  const selectedSignupCountry = COUNTRY_OPTIONS.find((country) => country.code === signupData.countryCode);
  const signupCanContinue = signupData.termsAccepted && Boolean(signupData.countryCode);
  const fullName = `${signupData.firstName} ${signupData.lastName}`.trim();
  const shellMaxWidthClassName = mode === "signup" ? "max-w-[68rem]" : "max-w-5xl";
  const formMaxWidthClassName = mode === "signup" ? "max-w-[500px]" : "max-w-[540px]";

  const passwordHint = useMemo(() => {
    if (!signupData.password) return "Use 8 or more characters.";
    if (signupData.password.length < MIN_PASSWORD_LENGTH) {
      return `Add ${MIN_PASSWORD_LENGTH - signupData.password.length} more character(s).`;
    }
    if (signupData.confirmPassword && signupData.password !== signupData.confirmPassword) {
      return "Passwords do not match.";
    }
    if (signupData.confirmPassword && signupData.password === signupData.confirmPassword) {
      return "Passwords match.";
    }
    return "Password looks good.";
  }, [signupData.confirmPassword, signupData.password]);

  useEffect(() => {
    setMode(initialMode);
    setLoginError(null);
    setSignupError(null);
  }, [initialMode]);

  const showPopup = (message: string, type: "success" | "error", duration = 2500) => {
    setPopup({ message, type });
    window.setTimeout(() => setPopup(null), duration);
  };

  const switchMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setLoginError(null);
    setSignupError(null);
    onModeChange?.(nextMode);
  };

  const resolveAuthUser = (response: any) =>
    response?.user || response?.data?.user || response?.data || null;

  const handleAuthSuccess = (response: any, message: string) => {
    const token = response?.token;
    const user = resolveAuthUser(response);

    if (!token || !user) {
      throw new Error("Invalid authentication response.");
    }

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("auth-changed"));
    window.dispatchEvent(
      new CustomEvent("nritax:auth-popup", {
        detail: { message, type: "success", duration: 1500 },
      })
    );
    navigate(redirectTo || "/home", { replace: true });
  };

  const handleForgotPassword = async () => {
    const email = loginData.email.trim();

    if (!EMAIL_PATTERN.test(email)) {
      setLoginError("Please enter a valid email address to reset your password.");
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPassword({ email });
      showPopup(response?.message || "If an account exists, a reset link has been sent to your email.", "success", 3200);
    } catch (error: any) {
      const message = getApiErrorMessage(error, "Unable to send password reset email right now.");
      setLoginError(message);
      showPopup(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);

    if (!EMAIL_PATTERN.test(loginData.email.trim())) {
      setLoginError("Please enter a valid email address.");
      return;
    }

    if (!loginData.password) {
      setLoginError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser({
        email: loginData.email.trim().toLowerCase(),
        password: loginData.password,
      });
      const user = resolveAuthUser(response);
      handleAuthSuccess(response, `WELCOME ${user?.name || "User"}!`);
    } catch (error: any) {
      const message = getApiErrorMessage(error, "Unable to login right now.");
      setLoginError(message);
      showPopup(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const validateSignup = () => {
    if (!signupData.firstName.trim() || !signupData.lastName.trim()) {
      return "Please enter your first and last name.";
    }
    if (!EMAIL_PATTERN.test(signupData.email.trim())) {
      return "Please enter a valid email address.";
    }
    if (signupData.linkedinProfile.trim() && !LINKEDIN_URL_PATTERN.test(signupData.linkedinProfile.trim())) {
      return "LinkedIn profile must be a valid linkedin.com URL.";
    }
    if (!signupData.countryCode || !selectedSignupCountry) {
      return "Please select your country.";
    }
    if (signupData.password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (signupData.password !== signupData.confirmPassword) {
      return "Passwords do not match.";
    }
    if (!signupData.termsAccepted) {
      return "Please accept the Terms of Service and Privacy Policy.";
    }
    return null;
  };

  const validateSocialSignup = () => {
    if (!signupData.countryCode || !selectedSignupCountry) {
      return "Please select your country.";
    }
    if (!signupData.termsAccepted) {
      return "Please accept the Terms of Service and Privacy Policy.";
    }
    return null;
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setSignupError(null);

    const validationError = validateSignup();
    if (validationError) {
      setSignupError(validationError);
      return;
    }

    setLoading(true);
    try {
      const acceptedAt =
        typeof window !== "undefined"
          ? sessionStorage.getItem("termsAcceptedAt") || new Date().toISOString()
          : new Date().toISOString();

      const response = await signupUser({
        name: fullName,
        email: signupData.email.trim().toLowerCase(),
        linkedinProfile: signupData.linkedinProfile.trim(),
        country: selectedSignupCountry?.name,
        countryCode: signupData.countryCode,
        password: signupData.password,
        confirmPassword: signupData.confirmPassword,
        termsAccepted: true,
        acceptedTerms: true,
        termsAcceptedAt: acceptedAt,
        policyVersion: CURRENT_POLICY_VERSION,
      });
      const user = resolveAuthUser(response);
      handleAuthSuccess(response, `Account created successfully! WELCOME ${user?.name || "User"}`);
    } catch (error: any) {
      const message = getApiErrorMessage(error, "Unable to create your account right now.");
      setSignupError(message);
      showPopup(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLinkedInAuth = (currentMode: "login" | "signup") => {
    try {
      if (currentMode === "signup") {
        const validationError = validateSocialSignup();
        if (validationError) {
          setSignupError(validationError);
          return;
        }
      }

      if (!LINKEDIN_AUTH_CONFIG.authBaseUrl) {
        throw new Error("LinkedIn Sign-In configuration is missing.");
      }

      const authUrl = new URL("/auth/linkedin", `${LINKEDIN_AUTH_CONFIG.authBaseUrl}/`);
      authUrl.searchParams.set("mode", currentMode);
      authUrl.searchParams.set("origin", window.location.origin);
      if (currentMode === "signup") {
        authUrl.searchParams.set("termsAccepted", "true");
        authUrl.searchParams.set("policyVersion", CURRENT_POLICY_VERSION);
        authUrl.searchParams.set("countryCode", signupData.countryCode);
        authUrl.searchParams.set("country", selectedSignupCountry?.name || "");
      }

      window.location.href = authUrl.toString();
    } catch (error: any) {
      const message = getApiErrorMessage(error, "LinkedIn Sign-In could not start.");
      if (currentMode === "signup") {
        setSignupError(message);
      } else {
        setLoginError(message);
      }
      showPopup(message, "error");
    }
  };

  const handleAppleLogin = async (currentMode: "login" | "signup") => {
    if (currentMode === "signup") {
      const validationError = validateSocialSignup();
      if (validationError) {
        setSignupError(validationError);
        return;
      }
    }

    setLoading(true);
    try {
      const appleResponse = await startAppleAuth();
      const response = await appleLoginUser({
        authorizationCode: appleResponse?.authorization?.code,
        identityToken: appleResponse?.authorization?.id_token,
        user: appleResponse?.user,
        fullName: appleResponse?.user?.name,
        termsAccepted: currentMode === "signup" ? true : undefined,
        policyVersion: currentMode === "signup" ? CURRENT_POLICY_VERSION : undefined,
        country: currentMode === "signup" ? selectedSignupCountry?.name : undefined,
        countryCode: currentMode === "signup" ? signupData.countryCode : undefined,
      });
      const user = resolveAuthUser(response);
      handleAuthSuccess(
        response,
        currentMode === "signup"
          ? `Account created successfully! WELCOME ${user?.name || "User"}`
          : `WELCOME ${user?.name || "User"}!`
      );
    } catch (error: any) {
      const message = getApiErrorMessage(error, "Apple Sign in could not be completed. Please try again.");
      if (currentMode === "signup") {
        setSignupError(message);
      } else {
        setLoginError(message);
      }
      showPopup(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const googleButtonProps = {
    theme: "outline" as const,
    shape: "rectangular" as const,
    size: "large" as const,
    width: "360",
    logo_alignment: "left" as const,
  };

  const handleGoogleAuthSuccess = async (
    currentMode: "login" | "signup",
    credentialResponse: { credential?: string }
  ) => {
    try {
      if (!credentialResponse.credential) {
        throw new Error("Missing Google credential.");
      }

      const payload =
        currentMode === "signup"
          ? {
              credential: credentialResponse.credential,
              termsAccepted: true,
              acceptedTerms: true,
              termsAcceptedAt:
                typeof window !== "undefined"
                  ? sessionStorage.getItem("termsAcceptedAt") || new Date().toISOString()
                  : new Date().toISOString(),
              policyVersion: CURRENT_POLICY_VERSION,
              country: selectedSignupCountry?.name,
              countryCode: signupData.countryCode,
            }
          : { credential: credentialResponse.credential };

      const response = await googleLoginUser(payload);
      const user = resolveAuthUser(response);
      handleAuthSuccess(
        response,
        currentMode === "signup"
          ? `Account created successfully! WELCOME ${user?.name || "User"}`
          : `WELCOME ${user?.name || "User"}!`
      );
    } catch (error: any) {
      const message = getApiErrorMessage(
        error,
        currentMode === "signup" ? "Google signup failed." : "Google login failed."
      );
      if (currentMode === "signup") {
        setSignupError(message);
      } else {
        setLoginError(message);
      }
      showPopup(message, "error");
    }
  };

  const renderGoogleButton = (currentMode: "login" | "signup") => (
    <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-1">
      <div className="w-full max-w-[360px] overflow-hidden rounded-xl [&>div]:!w-full [&>div>div]:!w-full">
        <GoogleLogin
          text={currentMode === "signup" ? "signup_with" : "signin_with"}
          {...googleButtonProps}
          onSuccess={(credentialResponse) => {
            if (currentMode === "signup") {
              const validationError = validateSocialSignup();
              if (validationError) {
                setSignupError(validationError);
                return;
              }
            }
            void handleGoogleAuthSuccess(currentMode, credentialResponse);
          }}
          onError={() => {
            const message =
              currentMode === "signup"
                ? `Google Sign-Up is blocked for ${GOOGLE_AUTH_CONFIG.origin || window.location.origin}.`
                : `Google Sign-In is blocked for ${GOOGLE_AUTH_CONFIG.origin || window.location.origin}.`;
            if (currentMode === "signup") {
              setSignupError(message);
            } else {
              setLoginError(message);
            }
            showPopup(message, "error", 4000);
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#f8fafc_45%,#e2e8f0_100%)] px-4 py-4 sm:px-5 lg:px-6">
      <div className={`mx-auto flex min-h-[calc(100dvh-2rem)] ${shellMaxWidthClassName} items-center justify-center`}>
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur lg:grid-cols-[0.95fr_1.05fr]">
          <section className="hidden bg-[linear-gradient(165deg,#dbeafe_0%,#bfdbfe_45%,#7dd3fc_100%)] p-8 text-sky-950 lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => navigate("/home")}
                className="inline-flex items-center gap-2 text-sm font-medium text-sky-900/75 transition hover:text-sky-950"
              >
                <ArrowLeft className="size-4" />
                Back to home
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-900/10 bg-white/35 px-4 py-2 text-[11px] font-semibold tracking-[0.18em] text-sky-900/80">
                <Sparkles className="size-4" />
                SECURE CLIENT ACCESS
              </div>
              <div className="space-y-3">
                <h1 className="text-[2rem] font-semibold leading-tight">
                  {mode === "signup" ? "Create your NRITAX.AI account" : "Welcome back to NRITAX.AI"}
                </h1>
                <p className="max-w-sm text-[15px] leading-7 text-sky-950/72">
                  {mode === "signup"
                    ? "Create your account and continue directly into your NRI tax workflow with faster onboarding."
                    : "Access AI-powered global tax guidance for NRIs with your secure account."}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-sky-950/68">
              <p>AI-powered guidance for NRIs, built for cross-border tax workflows.</p>
              <p>Powered by {COMPANY_LEGAL_NAME}.</p>
            </div>
          </section>

          <section className="p-5 sm:p-6 lg:p-7">
            <div className={`mx-auto flex w-full ${formMaxWidthClassName} flex-col gap-5`}>
              <div className="space-y-2 text-center lg:text-left">
                <div className="inline-flex items-center justify-center gap-2 text-sm text-slate-500 lg:justify-start">
                  <Sparkles className="size-4" />
                  <span className="tracking-wide">SECURE CLIENT ACCESS</span>
                </div>
                <h2 className="text-[2rem] font-semibold text-slate-900">
                  {mode === "signup" ? "Create your account" : "Login to NRITAX.AI"}
                </h2>
                <p className="text-sm leading-6 text-slate-500">
                  {mode === "signup"
                    ? "Sign up with email or your social account and continue right into onboarding."
                    : "Login with email or your preferred social account."}
                </p>
              </div>

              <Tabs value={mode} onValueChange={(value) => switchMode(value === "signup" ? "signup" : "login")} className="w-full gap-5">
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-2xl bg-slate-100 p-1">
                  <TabsTrigger value="login" className="rounded-[14px] data-[state=active]:bg-white data-[state=active]:text-slate-900">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-[14px] data-[state=active]:bg-white data-[state=active]:text-slate-900">
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-slate-700">Email Address</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="name@company.com"
                        value={loginData.email}
                        onChange={(event) => setLoginData((prev) => ({ ...prev, email: event.target.value }))}
                        className="h-11 rounded-2xl border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-slate-700">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        value={loginData.password}
                        onChange={(event) => setLoginData((prev) => ({ ...prev, password: event.target.value }))}
                        className="h-11 rounded-2xl border-slate-200"
                      />
                    </div>
                    {loginError ? <p className="text-sm text-rose-600">{loginError}</p> : null}
                    <Button type="submit" className="h-11 w-full rounded-2xl bg-slate-900 text-white hover:bg-slate-800" disabled={loading}>
                      {loading ? "Logging in..." : "Login"}
                    </Button>
                    <button
                      type="button"
                      className="w-full text-center text-sm font-medium text-blue-600 hover:underline"
                      onClick={() => void handleForgotPassword()}
                      disabled={loading}
                    >
                      Forgot password?
                    </button>
                  </form>

                  <SocialDivider label="Or continue with" />

                  <div className="space-y-3">
                    {canUseGoogleAuth ? renderGoogleButton("login") : null}
                    {canUseLinkedInAuth ? (
                      <SocialButton
                        icon={<Linkedin className="size-5 text-[#0A66C2]" />}
                        label="Continue with LinkedIn"
                        onClick={() => handleLinkedInAuth("login")}
                        disabled={loading}
                      />
                    ) : null}
                    {canUseAppleAuth ? (
                      <SocialButton
                        icon={<Apple className="size-5 text-slate-900" />}
                        label="Continue with Apple"
                        onClick={() => void handleAppleLogin("login")}
                        disabled={loading}
                      />
                    ) : null}
                  </div>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4">
                  <div className="space-y-3">
                    {canUseGoogleAuth ? renderGoogleButton("signup") : null}
                    {canUseLinkedInAuth ? (
                      <SocialButton
                        icon={<Linkedin className="size-5 text-[#0A66C2]" />}
                        label="Continue with LinkedIn"
                        onClick={() => handleLinkedInAuth("signup")}
                        disabled={loading || !signupCanContinue}
                      />
                    ) : null}
                    {canUseAppleAuth ? (
                      <SocialButton
                        icon={<Apple className="size-5 text-slate-900" />}
                        label="Continue with Apple"
                        onClick={() => void handleAppleLogin("signup")}
                        disabled={loading || !signupCanContinue}
                      />
                    ) : null}
                  </div>

                  <SocialDivider label="Or sign up with email" />

                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-first-name" className="text-slate-700">First Name</Label>
                        <Input
                          id="signup-first-name"
                          type="text"
                          placeholder="John"
                          value={signupData.firstName}
                          onChange={(event) => setSignupData((prev) => ({ ...prev, firstName: event.target.value }))}
                          className="h-11 rounded-2xl border-slate-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-last-name" className="text-slate-700">Last Name</Label>
                        <Input
                          id="signup-last-name"
                          type="text"
                          placeholder="Doe"
                          value={signupData.lastName}
                          onChange={(event) => setSignupData((prev) => ({ ...prev, lastName: event.target.value }))}
                          className="h-11 rounded-2xl border-slate-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-slate-700">Email Address</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="name@company.com"
                        value={signupData.email}
                        onChange={(event) => setSignupData((prev) => ({ ...prev, email: event.target.value }))}
                        className="h-11 rounded-2xl border-slate-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-country" className="text-slate-700">Country</Label>
                      <select
                        id="signup-country"
                        value={signupData.countryCode}
                        onChange={(event) => setSignupData((prev) => ({ ...prev, countryCode: event.target.value }))}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                      >
                        <option value="">Select your country</option>
                        {COUNTRY_OPTIONS.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-linkedin" className="text-slate-700">LinkedIn Profile (Optional)</Label>
                      <Input
                        id="signup-linkedin"
                        type="url"
                        placeholder="https://www.linkedin.com/in/your-profile"
                        value={signupData.linkedinProfile}
                        onChange={(event) => setSignupData((prev) => ({ ...prev, linkedinProfile: event.target.value }))}
                        className="h-11 rounded-2xl border-slate-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-slate-700">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Create a password"
                        value={signupData.password}
                        onChange={(event) => setSignupData((prev) => ({ ...prev, password: event.target.value }))}
                        className="h-11 rounded-2xl border-slate-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm-password" className="text-slate-700">Confirm Password</Label>
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="Re-enter your password"
                        value={signupData.confirmPassword}
                        onChange={(event) => setSignupData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                        className="h-11 rounded-2xl border-slate-200"
                      />
                      <p className="text-xs text-slate-400">{passwordHint}</p>
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                      <Checkbox
                        checked={signupData.termsAccepted}
                        onCheckedChange={(checked) =>
                          setSignupData((prev) => ({ ...prev, termsAccepted: checked === true }))
                        }
                        className="mt-0.5"
                      />
                      <span>
                        I accept the <a href="/terms-and-conditions" className="font-medium text-blue-600 hover:underline">Terms of Service</a> and{" "}
                        <a href="/privacy-policy" className="font-medium text-blue-600 hover:underline">Privacy Policy</a>.
                      </span>
                    </label>

                    {signupError ? <p className="text-sm text-rose-600">{signupError}</p> : null}

                    <Button
                      type="submit"
                      className="h-11 w-full rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                      disabled={loading || !signupCanContinue}
                    >
                      {loading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          </section>
        </div>
      </div>

      {popup ? <AuthPopup message={popup.message} type={popup.type} /> : null}
    </div>
  );
}
