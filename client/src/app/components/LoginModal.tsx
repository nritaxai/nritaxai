import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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

import { AuthPopup } from "./AuthPopup";
import { TermsModal } from "./TermsModal";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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
  googleLoginUser,
  loginUser,
  signupUser,
} from "../../utils/api";
import { COUNTRY_OPTIONS } from "../utils/countries";

interface LoginModalProps {
  onClose: () => void;
  disableClose?: boolean;
  initialMode?: "login" | "signup";
  hideSupportBanner?: boolean;
  hideSocialSection?: boolean;
  presentation?: "modal" | "page";
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
      className="h-11 w-full justify-center rounded-[18px] border-white/12 bg-white/[0.05] px-4 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300/25 hover:bg-white/[0.09] hover:text-white hover:shadow-[0_10px_24px_rgba(56,189,248,0.08)] disabled:hover:translate-y-0"
    >
      <span className="inline-flex items-center gap-2.5">
        <span className="inline-flex size-5 items-center justify-center text-slate-200">{icon}</span>
        <span>{label}</span>
      </span>
    </Button>
  );
}

const getFocusableElements = (container: HTMLElement | null) => {
  if (!container) return [] as HTMLElement[];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(",")
    )
  ).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
};

export function LoginModal({
  onClose,
  disableClose = false,
  initialMode = "login",
  hideSupportBanner = false,
  hideSocialSection = false,
  presentation = "modal",
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
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [signupTermsModalOpen, setSignupTermsModalOpen] = useState(false);
  const [signupTermsModalType, setSignupTermsModalType] = useState<"terms" | "privacy">("terms");
  const [popup, setPopup] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const loginEmailRef = useRef<HTMLInputElement | null>(null);
  const signupNameRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const isPagePresentation = presentation === "page";
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
      return {
        text: `Add ${MIN_PASSWORD_LENGTH - signupData.password.length} more character(s) to strengthen your password.`,
        tone: "text-amber-300",
      };
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
    mode === "signup"
      ? {
          eyebrow: "Global NRI Onboarding",
          title: "Create your NRITAX.AI account",
          description: "Start with a simple registration form and continue directly into your NRI tax journey.",
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

  useEffect(() => {
    setMode(initialMode);
    setForgotPasswordMode(false);
    setLoginError(null);
    setSignupError(null);
  }, [initialMode]);

  useEffect(() => {
    const input = mode === "signup" ? signupNameRef.current : loginEmailRef.current;
    if (!input) return;

    const timeoutId = window.setTimeout(() => {
      input.focus();
      input.select?.();
    }, shouldReduceMotion ? 0 : 170);

    return () => window.clearTimeout(timeoutId);
  }, [mode, shouldReduceMotion]);

  useEffect(() => {
    if (isPagePresentation || typeof document === "undefined") return;

    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = getFocusableElements(dialogRef.current);
    const firstFocusable = focusables[0];
    window.setTimeout(() => firstFocusable?.focus(), shouldReduceMotion ? 0 : 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      lastFocusedElementRef.current?.focus?.();
    };
  }, [isPagePresentation, shouldReduceMotion]);

  useEffect(() => {
    if (isPagePresentation || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disableClose && !signupTermsModalOpen) {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = getFocusableElements(dialogRef.current);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!activeElement || activeElement === first || !dialogRef.current?.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!activeElement || activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disableClose, isPagePresentation, onClose, signupTermsModalOpen]);

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

  const handleLinkedInAuth = (currentMode: "login" | "signup") => {
    try {
      if (currentMode === "signup" && !signupCanContinue) {
        setSignupError("Please select your country and accept the Terms of Service and Privacy Policy to continue.");
        return;
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
        detail: { message, type: "success", duration: 1500 },
      })
    );
    window.setTimeout(() => {
      onClose();
    }, 900);
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

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
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
      setLoginError(message);
      showPopup(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
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
      setSignupError(message);
      showPopup(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async (currentMode: "login" | "signup") => {
    if (currentMode === "signup" && !signupCanContinue) {
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
          : {
              credential: credentialResponse.credential,
            };

      const response = await googleLoginUser(payload);
      const user = resolveAuthUser(response);
      if (currentMode === "signup") {
        clearSignupTermsSession();
      }
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

  const fieldClassName =
    "h-11 rounded-[18px] border border-white/10 bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow,background-color] duration-200 focus-visible:border-sky-300/70 focus-visible:bg-white/[0.08] focus-visible:ring-[3px] focus-visible:ring-sky-400/20";

  const switchAuthMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setForgotPasswordMode(false);
    setLoginError(null);
    setSignupError(null);
  };

  const renderGoogleButton = (currentMode: "login" | "signup") => (
    <div className="relative flex w-full justify-center overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors duration-200 hover:border-sky-300/20 hover:bg-white/[0.05]">
      {currentMode === "signup" && !signupCanContinue ? (
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
          text={currentMode === "signup" ? "signup_with" : "signin_with"}
          {...googleButtonProps}
          onSuccess={(credentialResponse) => {
            if (currentMode === "signup") {
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

  const formStatus = mode === "signup" ? signupError : loginError;
  const pageShellClassName = isPagePresentation
    ? "relative min-h-[calc(100dvh-5rem)] overflow-hidden bg-[linear-gradient(180deg,#020617_0%,#07111f_42%,#0f172a_100%)]"
    : "fixed inset-0 z-50 overflow-hidden bg-[#020617]/72 backdrop-blur-sm";
  const cardClassName = isPagePresentation
    ? "relative overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(15,23,42,0.76)] text-white shadow-[0_30px_90px_rgba(2,6,23,0.48)] backdrop-blur-[20px]"
    : "relative w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(15,23,42,0.78)] text-white shadow-[0_30px_90px_rgba(2,6,23,0.55)] backdrop-blur-[20px]";

  const formContent = (
    <Card
      ref={dialogRef}
      className={cardClassName}
      role={isPagePresentation ? undefined : "dialog"}
      aria-modal={isPagePresentation ? undefined : true}
      aria-labelledby="auth-title"
      aria-describedby="auth-description"
    >
      <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/55 to-transparent" aria-hidden="true" />
      <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_minmax(420px,500px)]">
        <div className="hidden border-b border-white/10 px-6 py-6 lg:block lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                <Sparkles className="size-3.5" />
                {mode === "signup" ? "Direct registration flow" : "Secure account access"}
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-semibold tracking-[-0.03em] text-white">
                  {mode === "signup" ? "Create your account and continue immediately." : "Login without losing your context."}
                </h2>
                <p className="max-w-xl text-base leading-7 text-slate-300">
                  {mode === "signup"
                    ? "No extra popup step. Fill the registration form, confirm your policy acceptance, and move straight into the platform."
                    : "Your AI tax workspace, profile, subscription, and onboarding progress stay connected across NRITAX.AI."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {trustSignals.map((signal) => {
                  const Icon = signal.icon;
                  return (
                    <div
                      key={signal.label}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
                    >
                      <div className="mb-2 inline-flex rounded-xl bg-sky-400/12 p-2 text-sky-200">
                        <Icon className="size-4" />
                      </div>
                      <p className="font-medium text-white">{signal.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-sky-300/15 bg-sky-400/10 px-4 py-4 text-sm leading-6 text-slate-200">
              {mode === "signup"
                ? "Next step is obvious by design: complete the registration form and submit when the CTA turns active."
                : "Use email or a connected provider to return to your dashboard quickly."}
            </div>
          </div>
        </div>

        <div className="flex min-h-full flex-col">
          <CardHeader className="space-y-4 px-4 pb-0 pt-4 sm:px-6 sm:pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100 lg:hidden">
                  <Sparkles className="size-3.5" />
                  {authCopy.eyebrow}
                </div>
                <div className="space-y-1.5">
                  <CardTitle id="auth-title" className="text-[1.65rem] font-semibold tracking-[-0.02em] text-white sm:text-[1.85rem]">
                    {authCopy.title}
                  </CardTitle>
                  <CardDescription id="auth-description" className="max-w-[32rem] text-sm leading-6 text-slate-300">
                    {authCopy.description}
                  </CardDescription>
                </div>
              </div>

              {!disableClose && !isPagePresentation ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="mt-0.5 shrink-0 rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors duration-200 hover:bg-white/10 hover:text-white"
                  aria-label="Close sign in dialog"
                >
                  <X className="size-5" />
                </Button>
              ) : null}
            </div>

            <div className="relative grid h-11 grid-cols-2 rounded-[18px] border border-white/10 bg-white/[0.04] p-1">
              <motion.span
                aria-hidden="true"
                initial={false}
                animate={{ x: mode === "signup" ? "100%" : "0%" }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-[14px] bg-[linear-gradient(135deg,rgba(59,130,246,1),rgba(29,78,216,1))] shadow-[0_12px_28px_rgba(37,99,235,0.28)]"
              />
              <button
                type="button"
                onClick={() => switchAuthMode("login")}
                className={`relative z-10 rounded-[14px] text-sm font-semibold transition-colors ${
                  mode === "login" ? "text-white" : "text-slate-400"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchAuthMode("signup")}
                className={`relative z-10 rounded-[14px] text-sm font-semibold transition-colors ${
                  mode === "signup" ? "text-white" : "text-slate-400"
                }`}
              >
                Signup
              </button>
            </div>

            <div className="flex flex-wrap gap-2 lg:hidden">
              {trustSignals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <div
                    key={signal.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-200"
                  >
                    <Icon className="size-3.5 text-sky-200" />
                    {signal.label}
                  </div>
                );
              })}
            </div>

            {!hideSupportBanner ? (
              <div className="rounded-[18px] border border-sky-300/15 bg-sky-400/10 px-4 py-3 text-sm leading-6 text-slate-200">
                {mode === "signup"
                  ? "Registration opens directly here. Complete the fields below and use the primary CTA to continue."
                  : "Use your existing account to continue with secure tax workflows and subscriptions."}
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-4 px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
            <div className="rounded-full border border-sky-300/18 bg-sky-400/10 px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
              {mode === "signup" ? "Complete registration" : "Secure account login"}
            </div>

            <div aria-live="polite" aria-atomic="true">
              {formStatus ? (
                <p className="rounded-[18px] border border-rose-300/18 bg-rose-300/8 px-4 py-3 text-sm text-rose-100/95">
                  {formStatus}
                </p>
              ) : null}
            </div>

            <div className="min-h-0">
              <AnimatePresence mode="wait" initial={false}>
                {mode === "login" ? (
                  <motion.form
                    key="login"
                    onSubmit={handleLogin}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-4"
                  >
                    <div className="space-y-2.5">
                      <Label htmlFor="login-email" className="text-slate-100">Email Address</Label>
                      <Input
                        id="login-email"
                        ref={loginEmailRef}
                        className={fieldClassName}
                        type="email"
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        placeholder="name@company.com"
                        value={loginData.email}
                        onChange={(event) => setLoginData({ ...loginData, email: event.target.value })}
                        aria-invalid={loginError ? true : undefined}
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
                        onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
                        aria-invalid={loginError ? true : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        className="absolute right-3 top-[2.55rem] rounded-full p-1 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
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
                      <div className="space-y-3 rounded-[18px] border border-white/10 bg-white/[0.045] p-4">
                        <div className="space-y-2">
                          <Label htmlFor="forgot-password-email" className="text-slate-100">Reset Email</Label>
                          <Input
                            className={fieldClassName}
                            id="forgot-password-email"
                            type="email"
                            placeholder="name@company.com"
                            value={forgotPasswordEmail}
                            onChange={(event) => setForgotPasswordEmail(event.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-11 w-full rounded-[18px] border-white/10 bg-white/10 text-white hover:bg-white/14"
                          disabled={loading}
                          onClick={() => void handleForgotPassword()}
                        >
                          {loading ? "Sending reset link..." : "Send Reset Link"}
                        </Button>
                      </div>
                    ) : null}

                    <Button
                      type="submit"
                      className="h-11 w-full rounded-[18px] bg-[linear-gradient(135deg,#3B82F6,#1D4ED8)] text-base font-semibold text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(37,99,235,0.32)] disabled:hover:translate-y-0"
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
                        onClick={() => switchAuthMode("signup")}
                        className="font-semibold text-sky-300 transition-colors hover:text-sky-200"
                      >
                        {authCopy.altAction}
                      </button>
                    </p>
                  </motion.form>
                ) : (
                  <motion.form
                    key="signup"
                    onSubmit={handleSignup}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-3.5"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name" className="text-slate-100">Full Name</Label>
                        <Input
                          id="signup-name"
                          ref={signupNameRef}
                          className={fieldClassName}
                          required
                          value={signupData.name}
                          placeholder="Your full name"
                          onChange={(event) => setSignupData({ ...signupData, name: event.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
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
                          onChange={(event) => setSignupData({ ...signupData, email: event.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-country" className="text-slate-100">Country</Label>
                        <select
                          id="signup-country"
                          required
                          value={signupData.countryCode}
                          onChange={(event) => setSignupData({ ...signupData, countryCode: event.target.value })}
                          className="h-11 w-full rounded-[18px] border border-white/10 bg-white/[0.06] px-4 text-[15px] text-white outline-none transition-[border-color,box-shadow,background-color] duration-200 focus:border-sky-300/70 focus:bg-white/[0.08] focus:ring-[3px] focus:ring-sky-400/20"
                        >
                          <option value="" className="text-slate-900">Select your country</option>
                          {COUNTRY_OPTIONS.map((country) => (
                            <option key={country.code} value={country.code} className="text-slate-900">
                              {country.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-400">Choose your current country to unlock the correct onboarding rules.</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-linkedin" className="text-slate-100">LinkedIn Profile</Label>
                        <Input
                          id="signup-linkedin"
                          className={fieldClassName}
                          type="url"
                          placeholder="Optional: https://www.linkedin.com/in/your-profile"
                          value={signupData.linkedinProfile}
                          onChange={(event) => setSignupData({ ...signupData, linkedinProfile: event.target.value })}
                        />
                      </div>

                      <div className="relative space-y-2">
                        <Label htmlFor="signup-password" className="text-slate-100">Password</Label>
                        <Input
                          id="signup-password"
                          className={`${fieldClassName} pr-12`}
                          type={showSignupPassword ? "text" : "password"}
                          required
                          placeholder="Create a password"
                          value={signupData.password}
                          onChange={(event) => setSignupData({ ...signupData, password: event.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword((prev) => !prev)}
                          className="absolute right-3 top-[2.55rem] rounded-full p-1 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                          aria-label={showSignupPassword ? "Hide password" : "Show password"}
                        >
                          {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        <p className={`text-xs leading-5 ${passwordHint.tone}`}>{passwordHint.text}</p>
                      </div>

                      <div className="relative space-y-2">
                        <Label htmlFor="signup-confirm-password" className="text-slate-100">Confirm Password</Label>
                        <Input
                          id="signup-confirm-password"
                          className={`${fieldClassName} pr-12`}
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          placeholder="Re-enter your password"
                          value={signupData.confirmPassword}
                          onChange={(event) => setSignupData({ ...signupData, confirmPassword: event.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute right-3 top-[2.55rem] rounded-full p-1 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        {confirmPasswordHint ? (
                          <p className={`text-xs leading-5 ${confirmPasswordHint.tone}`}>{confirmPasswordHint.text}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
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
                          className="mt-1 border-white/18 bg-white/5 text-[#0F172A] transition-all duration-200 data-[state=checked]:border-sky-400 data-[state=checked]:bg-sky-300"
                          aria-label="Agree to Terms of Service and Privacy Policy"
                        />
                        <span>
                          I agree to the{" "}
                          <button
                            type="button"
                            onClick={() => openSignupTermsModal("terms")}
                            className="font-semibold text-sky-300 underline-offset-4 transition-colors hover:text-sky-200 hover:underline"
                          >
                            Terms of Service
                          </button>{" "}
                          and{" "}
                          <button
                            type="button"
                            onClick={() => openSignupTermsModal("privacy")}
                            className="font-semibold text-sky-300 underline-offset-4 transition-colors hover:text-sky-200 hover:underline"
                          >
                            Privacy Policy
                          </button>
                          .
                        </span>
                      </label>
                    </div>

                    <Button
                      type="submit"
                      className="h-11 w-full rounded-[18px] bg-[linear-gradient(135deg,#3B82F6,#1D4ED8)] text-base font-semibold text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(37,99,235,0.32)] disabled:hover:translate-y-0"
                      disabled={loading || !signupCanContinue}
                    >
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          Creating account...
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
                        onClick={() => switchAuthMode("login")}
                        className="font-semibold text-sky-300 transition-colors hover:text-sky-200"
                      >
                        {authCopy.altAction}
                      </button>
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-white/10 pt-4 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Powered by {COMPANY_LEGAL_NAME}
              </p>
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );

  return (
    <div className={pageShellClassName}>
      <TermsModal
        isOpen={signupTermsModalOpen}
        type={signupTermsModalType}
        onAccept={handleSignupTermsAccepted}
        onClose={() => setSignupTermsModalOpen(false)}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(37,99,235,0.16),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(96,165,250,0.08),transparent_36%)]" />
        <div className="absolute left-[-8%] top-[10%] h-64 w-64 rounded-full bg-blue-500/12 blur-3xl" />
        <div className="absolute right-[-10%] top-[12%] h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute bottom-[-8%] left-[20%] h-56 w-56 rounded-full bg-cyan-300/8 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      {isPagePresentation ? (
        <div className="relative mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl items-center px-4 py-6 sm:px-6 lg:px-8">
          {formContent}
        </div>
      ) : (
        <div
          className="relative flex min-h-screen items-center justify-center px-4 py-4 sm:px-6"
          onMouseDown={(event) => {
            if (!disableClose && event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          {formContent}
        </div>
      )}

      {popup ? <AuthPopup message={popup.message} type={popup.type} /> : null}
    </div>
  );
}
