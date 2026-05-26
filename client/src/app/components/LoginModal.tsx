import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Checkbox } from "./ui/checkbox";
import {
  Apple,
  ArrowRight,
  Eye,
  EyeOff,
  Linkedin,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  appleLoginUser,
  forgotPassword,
  googleLoginUser,
  loginUser,
  signupUser,
} from "../../utils/api";
import {
  APPLE_AUTH_CONFIG,
  GOOGLE_AUTH_CONFIG,
  IS_IOS_NATIVE_APP,
  LINKEDIN_AUTH_CONFIG,
} from "../../config/appConfig";
import { startAppleAuth } from "../../utils/appleAuth";
import { AuthPopup } from "./AuthPopup";
import { TermsModal } from "./TermsModal";
import { CURRENT_POLICY_VERSION } from "../../config/legal";
import { COMPANY_LEGAL_NAME } from "../../config/branding";
import { COUNTRY_OPTIONS } from "../utils/countries";

interface LoginModalProps {
  onClose: () => void;
  disableClose?: boolean;
  initialMode?: "login" | "signup";
  hideSupportBanner?: boolean;
  hideSocialSection?: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const linkedInUrlPattern = /^https?:\/\/(?:www\.)?linkedin\.com\/.+/i;
const MIN_PASSWORD_LENGTH = 8;

const getApiErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const trustSignals = [
  { icon: ShieldCheck, label: "Secure Authentication" },
  { icon: LockKeyhole, label: "Enterprise-grade encryption" },
  { icon: Sparkles, label: "AI + CPA Assisted Platform" },
] as const;

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        <span className="rounded-full bg-[#081121]/90 px-3">{label}</span>
      </div>
    </div>
  );
}

function SocialAuthButton({
  icon,
  label,
  onClick,
  disabled,
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
      disabled={disabled}
      onClick={onClick}
      className="h-12 w-full justify-center rounded-2xl border-white/12 bg-white/[0.05] px-4 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.09] hover:text-white"
    >
      <span className="inline-flex items-center gap-2.5">
        <span className="inline-flex size-5 items-center justify-center text-slate-200">{icon}</span>
        <span>{label}</span>
      </span>
    </Button>
  );
}

export function LoginModal({
  onClose,
  disableClose = false,
  initialMode = "login",
  hideSupportBanner = false,
  hideSocialSection = false,
}: LoginModalProps) {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    linkedinProfile: "",
    countryCode: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"login" | "signup">(initialMode);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [signupTermsModalOpen, setSignupTermsModalOpen] = useState(false);
  const [signupTermsModalType, setSignupTermsModalType] = useState<"terms" | "privacy">("terms");
  const [popup, setPopup] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const canUseGoogleAuth = Boolean(GOOGLE_AUTH_CONFIG.clientId);
  const canUseLinkedInAuth = Boolean(LINKEDIN_AUTH_CONFIG.authBaseUrl);
  const canUseAppleAuth = APPLE_AUTH_CONFIG.isConfigured || IS_IOS_NATIVE_APP;
  const selectedSignupCountry = COUNTRY_OPTIONS.find((country) => country.code === signupData.countryCode);
  const termsErrorMessage = "Please review and accept the Terms of Service and Privacy Policy.";
  const signupCanContinue = signupData.termsAccepted && Boolean(signupData.countryCode);
  const signupTermsAcceptedRef = useRef(false);

  const passwordHint = useMemo(() => {
    if (!signupData.password) {
      return { text: "Use 8+ characters for better account security.", tone: "text-slate-400" };
    }

    if (signupData.password.length < MIN_PASSWORD_LENGTH) {
      return { text: `Add ${MIN_PASSWORD_LENGTH - signupData.password.length} more character(s) to strengthen your password.`, tone: "text-amber-300" };
    }

    return { text: "Password length looks good.", tone: "text-emerald-300" };
  }, [signupData.password]);

  const confirmPasswordHint = useMemo(() => {
    if (!signupData.confirmPassword) return null;
    return signupData.password === signupData.confirmPassword
      ? { text: "Passwords match.", tone: "text-emerald-300" }
      : { text: "Passwords do not match yet.", tone: "text-rose-300" };
  }, [signupData.confirmPassword, signupData.password]);

  const authCopy =
    activeTab === "signup"
      ? {
          eyebrow: "Global NRI Onboarding",
          title: "Create your NRITAX.AI account",
          description: "Get instant DTAA guidance, FEMA support, and global tax insights.",
          cta: "Create Account",
          altPrompt: "Already have an account?",
          altAction: "Switch to login",
        }
      : {
          eyebrow: "Secure Client Access",
          title: "Welcome back to NRITAX.AI",
          description: "Access AI-powered global tax guidance for NRIs.",
          cta: "Login",
          altPrompt: "New to NRITAX.AI?",
          altAction: "Create an account",
        };

  const resolveAuthUser = (response: any) =>
    response?.user || response?.data?.user || response?.data || null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionAccepted = sessionStorage.getItem("termsAccepted") === "true";
    signupTermsAcceptedRef.current = sessionAccepted;
    if (sessionAccepted) {
      setSignupData((prev) => ({ ...prev, termsAccepted: true }));
    }
  }, []);

  const showPopup = (message: string, type: "success" | "error", duration = 2500) => {
    setPopup({ message, type });
    window.setTimeout(() => setPopup(null), duration);
  };

  const clearSignupTermsSession = () => {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem("termsAccepted");
    sessionStorage.removeItem("termsAcceptedAt");
  };

  const openSignupTermsModal = (type: "terms" | "privacy") => {
    setSignupTermsModalType(type);
    setSignupTermsModalOpen(true);
  };

  const handleSignupTermsAccepted = () => {
    signupTermsAcceptedRef.current = true;
    setSignupData((prev) => ({ ...prev, termsAccepted: true }));
    setSignupTermsModalOpen(false);
    setSignupError((prev) => (prev === termsErrorMessage ? null : prev));
  };

  const handleLinkedInAuth = (mode: "login" | "signup") => {
    try {
      if (mode === "signup" && !signupCanContinue) {
        setSignupError("Please select your country and accept the Terms of Service and Privacy Policy to continue.");
        return;
      }
      if (!LINKEDIN_AUTH_CONFIG.authBaseUrl) {
        throw new Error("LinkedIn Sign-In configuration is missing.");
      }

      const authUrl = new URL("/auth/linkedin", `${LINKEDIN_AUTH_CONFIG.authBaseUrl}/`);
      authUrl.searchParams.set("mode", mode);
      authUrl.searchParams.set("origin", window.location.origin);
      if (mode === "signup") {
        authUrl.searchParams.set("termsAccepted", "true");
        authUrl.searchParams.set("policyVersion", CURRENT_POLICY_VERSION);
        authUrl.searchParams.set("countryCode", signupData.countryCode);
        authUrl.searchParams.set("country", selectedSignupCountry?.name || "");
      }

      console.info("[auth] starting LinkedIn auth", {
        mode,
        origin: window.location.origin,
      });

      window.location.href = authUrl.toString();
    } catch (error: any) {
      showPopup(getApiErrorMessage(error, "LinkedIn Sign-In could not start."), "error");
    }
  };

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
        detail: { message, type: "success", duration: 1000 },
      })
    );
    window.setTimeout(() => {
      onClose();
    }, 1000);
  };

  const handleForgotPassword = async () => {
    setLoginError(null);
    const email = forgotPasswordEmail.trim() || loginData.email.trim();

    if (!EMAIL_PATTERN.test(email)) {
      setLoginError("Please enter a valid email address to reset your password.");
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPassword({ email });
      setForgotPasswordEmail(email);
      showPopup(
        response?.message || "If an account exists, a reset link has been sent to your email.",
        "success",
        3000
      );
    } catch (error: any) {
      setLoginError(getApiErrorMessage(error, "Unable to send password reset email right now."));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginData.email.trim() || !loginData.password.trim()) {
      setLoginError("Please enter both email address and password.");
      return;
    }

    if (!EMAIL_PATTERN.test(loginData.email.trim())) {
      setLoginError("Please enter a valid email address.");
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
      const message = getApiErrorMessage(error, "Login failed.");
      console.error("[auth] email login failed", {
        mode: "login",
        platform: IS_IOS_NATIVE_APP ? "ios-native" : "web",
        message,
      });
      setLoginError(message);
      showPopup(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (!signupData.name.trim() || !signupData.email.trim() || !signupData.password || !signupData.confirmPassword) {
      setSignupError("Please complete your name, email address, password, and confirmation.");
      return;
    }

    if (!EMAIL_PATTERN.test(signupData.email.trim())) {
      setSignupError("Please enter a valid email address.");
      return;
    }

    if (signupData.linkedinProfile.trim() && !linkedInUrlPattern.test(signupData.linkedinProfile.trim())) {
      setSignupError("LinkedIn profile must be a valid linkedin.com URL.");
      return;
    }

    if (signupData.password.length < MIN_PASSWORD_LENGTH) {
      setSignupError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }

    if (!signupTermsAcceptedRef.current) {
      setSignupError(termsErrorMessage);
      openSignupTermsModal("terms");
      return;
    }

    if (!signupData.countryCode || !selectedSignupCountry) {
      setSignupError("Please select your country.");
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
        termsAcceptedAt:
          typeof window !== "undefined"
            ? sessionStorage.getItem("termsAcceptedAt") || new Date().toISOString()
            : new Date().toISOString(),
        policyVersion: CURRENT_POLICY_VERSION,
      });
      const user = resolveAuthUser(response);
      clearSignupTermsSession();
      handleAuthSuccess(response, `Account created successfully! WELCOME ${user?.name || "User"}`);
    } catch (error: any) {
      const message = getApiErrorMessage(error, "Signup failed.");
      console.error("[auth] email signup failed", {
        mode: "signup",
        platform: IS_IOS_NATIVE_APP ? "ios-native" : "web",
        message,
      });
      setSignupError(message);
      showPopup(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async (mode: "login" | "signup") => {
    if (mode === "signup" && !signupCanContinue) {
      setSignupError("Please select your country and accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoginError(null);
    setSignupError(null);
    setLoading(true);

    try {
      const appleResponse = await startAppleAuth();
      const response = await appleLoginUser({
        authorizationCode: appleResponse?.authorization?.code,
        identityToken: appleResponse?.authorization?.id_token,
        user: appleResponse?.user,
        fullName: appleResponse?.user?.name,
        termsAccepted: mode === "signup" ? true : undefined,
        policyVersion: mode === "signup" ? CURRENT_POLICY_VERSION : undefined,
        country: mode === "signup" ? selectedSignupCountry?.name : undefined,
        countryCode: mode === "signup" ? signupData.countryCode : undefined,
      });
      const user = resolveAuthUser(response);
      handleAuthSuccess(
        response,
        mode === "signup"
          ? `Account created successfully! WELCOME ${user?.name || "User"}`
          : `WELCOME ${user?.name || "User"}!`
      );
    } catch (error: any) {
      const message = getApiErrorMessage(
        error,
        "Apple Sign in could not be completed. Please try again."
      );
      console.error("[auth] apple sign-in failed", {
        mode,
        platform: IS_IOS_NATIVE_APP ? "ios-native" : "web",
        configured: APPLE_AUTH_CONFIG.isConfigured,
        message,
      });
      if (mode === "signup") {
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
    mode: "login" | "signup",
    credentialResponse: { credential?: string }
  ) => {
    try {
      if (!credentialResponse.credential) {
        throw new Error("Missing Google credential.");
      }

      const payload =
        mode === "signup"
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
          : {
              credential: credentialResponse.credential,
            };

      const response = await googleLoginUser(payload);
      const user = resolveAuthUser(response);
      if (mode === "signup") {
        clearSignupTermsSession();
      }
      handleAuthSuccess(
        response,
        mode === "signup"
          ? `Account created successfully! WELCOME ${user?.name || "User"}`
          : `WELCOME ${user?.name || "User"}!`
      );
    } catch (error: any) {
      const message = getApiErrorMessage(error, mode === "signup" ? "Google signup failed." : "Google login failed.");
      console.error(`[auth] google ${mode} failed`, { message });
      if (mode === "signup") {
        setSignupError(message);
      } else {
        setLoginError(message);
      }
      showPopup(message, "error");
    }
  };

  const fieldClassName =
    "h-12 rounded-2xl border border-white/12 bg-white/[0.07] px-4 text-[15px] text-white placeholder:text-slate-500 focus-visible:border-[#60A5FA] focus-visible:ring-[#2563EB]/30";

  const renderGoogleButton = (mode: "login" | "signup") => (
    <div className="relative flex w-full justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {mode === "signup" && !signupCanContinue ? (
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={() => {
            if (!signupData.countryCode) {
              setSignupError("Please select your country.");
              return;
            }
            openSignupTermsModal("terms");
          }}
          title={!signupData.countryCode ? "Please select your country first" : "Please accept Terms of Service first"}
        />
      ) : null}
      <div className="w-full max-w-[360px] overflow-hidden rounded-xl [&>div]:!w-full [&>div>div]:!w-full">
        <GoogleLogin
          text={mode === "signup" ? "signup_with" : "signin_with"}
          {...googleButtonProps}
          onSuccess={(credentialResponse) => {
            if (mode === "signup") {
              if (!signupData.countryCode) {
                setSignupError("Please select your country.");
                return;
              }
              if (!signupTermsAcceptedRef.current) {
                setSignupError(termsErrorMessage);
                openSignupTermsModal("terms");
                return;
              }
            }
            void handleGoogleAuthSuccess(mode, credentialResponse);
          }}
          onError={() => {
            const message =
              mode === "signup"
                ? `Google Sign-Up is blocked for ${GOOGLE_AUTH_CONFIG.origin || window.location.origin}.`
                : `Google Sign-In is blocked for ${GOOGLE_AUTH_CONFIG.origin || window.location.origin}.`;
            if (mode === "signup") {
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(125,211,252,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#081121_52%,#0F172A_100%)]">
      <TermsModal
        isOpen={signupTermsModalOpen}
        type={signupTermsModalType}
        onAccept={handleSignupTermsAccepted}
        onClose={() => setSignupTermsModalOpen(false)}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[-8%] top-[8%] h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute right-[-6%] top-[16%] h-64 w-64 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="absolute bottom-[10%] left-[18%] h-48 w-48 rounded-full bg-sky-300/8 blur-3xl" />
      </div>

      <div className="relative flex min-h-dvh items-start justify-center px-4 py-6 sm:items-center sm:px-6 lg:px-8">
        <Card className="relative max-h-[92dvh] w-full max-w-[34rem] overflow-y-auto rounded-[24px] border-white/8 bg-[rgba(15,23,42,0.72)] text-white shadow-[0_10px_40px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[16px]">
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" aria-hidden="true" />

          <CardHeader className="space-y-5 pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                  <Sparkles className="size-3.5" />
                  {authCopy.eyebrow}
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
                    {authCopy.title}
                  </CardTitle>
                  <CardDescription className="max-w-[30rem] text-[15px] leading-7 text-slate-300">
                    {authCopy.description}
                  </CardDescription>
                </div>
                <p className="text-sm font-medium text-slate-400">
                  Powered by {COMPANY_LEGAL_NAME}
                </p>
              </div>

              {!disableClose ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-5" />
                </Button>
              ) : null}
            </div>

            {!hideSupportBanner ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-slate-300">
                Your sign-in, session access, subscription state, and payment workflows remain securely connected.
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-3">
              {trustSignals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <div
                    key={signal.label}
                    className="rounded-2xl border border-white/8 bg-white/[0.04] px-3.5 py-3 text-sm text-slate-200"
                  >
                    <div className="mb-2 inline-flex size-8 items-center justify-center rounded-full bg-sky-400/10 text-sky-200">
                      <Icon className="size-4" />
                    </div>
                    <p className="text-sm font-medium leading-5">{signal.label}</p>
                  </div>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="pb-6 pt-6">
            <Tabs
              defaultValue={initialMode}
              value={activeTab}
              onValueChange={(value) => {
                setActiveTab(value as "login" | "signup");
                setForgotPasswordMode(false);
                setLoginError(null);
                setSignupError(null);
              }}
              className="w-full"
            >
              <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.05] p-1 text-slate-400">
                <TabsTrigger
                  value="login"
                  className="rounded-[14px] text-sm font-semibold data-[state=active]:border-white/10 data-[state=active]:bg-[linear-gradient(135deg,rgba(37,99,235,0.95),rgba(29,78,216,0.88))] data-[state=active]:text-white data-[state=active]:shadow-[0_12px_24px_rgba(37,99,235,0.24)]"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-[14px] text-sm font-semibold data-[state=active]:border-white/10 data-[state=active]:bg-[linear-gradient(135deg,rgba(37,99,235,0.95),rgba(29,78,216,0.88))] data-[state=active]:text-white data-[state=active]:shadow-[0_12px_24px_rgba(37,99,235,0.24)]"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-0 pt-5">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="login-email" className="text-slate-100">Email Address</Label>
                    <Input
                      id="login-email"
                      className={fieldClassName}
                      type="email"
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      placeholder="name@company.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    />
                  </div>

                  <div className="relative space-y-2.5">
                    <Label htmlFor="login-password" className="text-slate-100">Password</Label>
                    <Input
                      id="login-password"
                      className={`${fieldClassName} pr-12`}
                      type={showLoginPassword ? "text" : "password"}
                      required
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      className="absolute right-3 top-[2.75rem] rounded-full p-1 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                      aria-label={showLoginPassword ? "Hide password" : "Show password"}
                    >
                      {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm font-medium text-sky-300 transition-colors hover:text-sky-200"
                      onClick={() => {
                        setForgotPasswordMode((prev) => !prev);
                        setLoginError(null);
                        setForgotPasswordEmail(loginData.email);
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  {forgotPasswordMode ? (
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-password-email" className="text-slate-100">Reset Email</Label>
                        <Input
                          className={fieldClassName}
                          id="forgot-password-email"
                          type="email"
                          placeholder="name@company.com"
                          value={forgotPasswordEmail}
                          onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-12 w-full rounded-2xl border-white/10 bg-white/10 text-white hover:bg-white/14"
                        disabled={loading}
                        onClick={() => void handleForgotPassword()}
                      >
                        {loading ? "Sending reset link..." : "Send Reset Link"}
                      </Button>
                    </div>
                  ) : null}

                  {loginError ? (
                    <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                      {loginError}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#3B82F6,#1D4ED8)] text-base font-semibold text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(37,99,235,0.32)]"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {authCopy.cta}
                        <ArrowRight className="size-4" />
                      </span>
                    )}
                  </Button>

                  {!hideSocialSection ? (
                    <>
                      <SectionDivider label="or continue with" />

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {canUseAppleAuth ? (
                          <SocialAuthButton
                            icon={<Apple className="size-4" />}
                            label="Apple"
                            disabled={loading}
                            onClick={() => void handleAppleLogin("login")}
                          />
                        ) : null}
                        {canUseLinkedInAuth ? (
                          <SocialAuthButton
                            icon={<Linkedin className="size-4" />}
                            label="LinkedIn"
                            disabled={loading}
                            onClick={() => handleLinkedInAuth("login")}
                          />
                        ) : null}
                      </div>

                      {canUseGoogleAuth ? renderGoogleButton("login") : null}
                    </>
                  ) : null}

                  <p className="text-center text-sm text-slate-400">
                    {authCopy.altPrompt}{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("signup")}
                      className="font-semibold text-sky-300 transition-colors hover:text-sky-200"
                    >
                      {authCopy.altAction}
                    </button>
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-0 pt-5">
                <form onSubmit={handleSignup} className="space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="signup-name" className="text-slate-100">Full Name</Label>
                    <Input
                      id="signup-name"
                      className={fieldClassName}
                      required
                      value={signupData.name}
                      placeholder="Your full name"
                      onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="signup-email" className="text-slate-100">Email Address</Label>
                    <Input
                      id="signup-email"
                      className={fieldClassName}
                      type="email"
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      placeholder="name@company.com"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="signup-linkedin" className="text-slate-100">LinkedIn Profile (Optional)</Label>
                    <Input
                      id="signup-linkedin"
                      className={fieldClassName}
                      type="url"
                      placeholder="https://www.linkedin.com/in/your-profile"
                      value={signupData.linkedinProfile}
                      onChange={(e) => setSignupData({ ...signupData, linkedinProfile: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="signup-country" className="text-slate-100">Country</Label>
                    <select
                      id="signup-country"
                      required
                      value={signupData.countryCode}
                      onChange={(e) => setSignupData({ ...signupData, countryCode: e.target.value })}
                      className="h-12 w-full rounded-2xl border border-white/12 bg-white/[0.07] px-4 text-[15px] text-white outline-none transition-[border-color,box-shadow] focus:border-[#60A5FA] focus:ring-[3px] focus:ring-[#2563EB]/30"
                    >
                      <option value="" className="text-slate-900">Select your country</option>
                      {COUNTRY_OPTIONS.map((country) => (
                        <option key={country.code} value={country.code} className="text-slate-900">
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative space-y-2.5">
                    <Label htmlFor="signup-password" className="text-slate-100">Password</Label>
                    <Input
                      id="signup-password"
                      className={`${fieldClassName} pr-12`}
                      type={showSignupPassword ? "text" : "password"}
                      required
                      placeholder="Create a password"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword((prev) => !prev)}
                      className="absolute right-3 top-[2.75rem] rounded-full p-1 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                      aria-label={showSignupPassword ? "Hide password" : "Show password"}
                    >
                      {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <p className={`text-xs leading-5 ${passwordHint.tone}`}>{passwordHint.text}</p>
                  </div>

                  <div className="relative space-y-2.5">
                    <Label htmlFor="signup-confirm-password" className="text-slate-100">Confirm Password</Label>
                    <Input
                      id="signup-confirm-password"
                      className={`${fieldClassName} pr-12`}
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="Re-enter your password"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-[2.75rem] rounded-full p-1 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    {confirmPasswordHint ? (
                      <p className={`text-xs leading-5 ${confirmPasswordHint.tone}`}>{confirmPasswordHint.text}</p>
                    ) : null}
                  </div>

                  {signupError ? (
                    <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                      {signupError}
                    </p>
                  ) : null}

                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-300">
                      <Checkbox
                        checked={signupData.termsAccepted}
                        onCheckedChange={(checked) => {
                          if (checked && !signupData.termsAccepted) {
                            openSignupTermsModal("terms");
                            return;
                          }
                          signupTermsAcceptedRef.current = false;
                          clearSignupTermsSession();
                          setSignupData({ ...signupData, termsAccepted: false });
                        }}
                        className="mt-1 border-white/18 bg-white/5 text-[#0F172A] data-[state=checked]:border-sky-400 data-[state=checked]:bg-sky-300"
                        aria-label="Agree to Terms of Service and Privacy Policy"
                      />
                      <span>
                        I agree to the{" "}
                        <button
                          type="button"
                          onClick={() => openSignupTermsModal("terms")}
                          className="font-semibold text-sky-300 transition-colors hover:text-sky-200"
                        >
                          Terms of Service
                        </button>{" "}
                        and{" "}
                        <button
                          type="button"
                          onClick={() => openSignupTermsModal("privacy")}
                          className="font-semibold text-sky-300 transition-colors hover:text-sky-200"
                        >
                          Privacy Policy
                        </button>
                        .
                      </span>
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#3B82F6,#1D4ED8)] text-base font-semibold text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(37,99,235,0.32)]"
                    disabled={loading || !signupCanContinue}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {authCopy.cta}
                        <ArrowRight className="size-4" />
                      </span>
                    )}
                  </Button>

                  {!hideSocialSection ? (
                    <>
                      <SectionDivider label="or continue with" />

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {canUseAppleAuth ? (
                          <SocialAuthButton
                            icon={<Apple className="size-4" />}
                            label="Apple"
                            disabled={loading || !signupCanContinue}
                            onClick={() => void handleAppleLogin("signup")}
                          />
                        ) : null}
                        {canUseLinkedInAuth ? (
                          <SocialAuthButton
                            icon={<Linkedin className="size-4" />}
                            label="LinkedIn"
                            disabled={loading || !signupCanContinue}
                            onClick={() => handleLinkedInAuth("signup")}
                          />
                        ) : null}
                      </div>

                      {canUseGoogleAuth ? renderGoogleButton("signup") : null}
                    </>
                  ) : null}

                  <p className="text-center text-sm text-slate-400">
                    {authCopy.altPrompt}{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("login")}
                      className="font-semibold text-sky-300 transition-colors hover:text-sky-200"
                    >
                      {authCopy.altAction}
                    </button>
                  </p>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex flex-col items-center gap-2 border-t border-white/10 pt-5 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Trusted onboarding for global NRI tax workflows
              </p>
              <p className="text-sm leading-6 text-slate-400">
                NRITAX.AI helps you access treaty guidance, compliance workflows, and expert-assisted next steps with secure account protection.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {popup ? <AuthPopup message={popup.message} type={popup.type} /> : null}
    </div>
  );
}
