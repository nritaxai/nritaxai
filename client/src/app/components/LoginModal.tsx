import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "./ui/button";
import { Tabs, TabsContent } from "./ui/tabs";
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
import { AuthLayout } from "./AuthLayout";
import { AuthCard } from "./AuthCard";
import { AuthToggle } from "./AuthToggle";
import { CountrySelect } from "./CountrySelect";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

interface LoginModalProps {
  onClose: () => void;
  disableClose?: boolean;
  initialMode?: "login" | "signup";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const linkedInUrlPattern = /^https?:\/\/(?:www\.)?linkedin\.com\/.+/i;

const getApiErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

export function LoginModal({ onClose, disableClose = false, initialMode = "login" }: LoginModalProps) {
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
  const canUseLinkedInAuth =
    Boolean(LINKEDIN_AUTH_CONFIG.authBaseUrl);
  const selectedSignupCountry = COUNTRY_OPTIONS.find((country) => country.code === signupData.countryCode);
  const termsErrorMessage = "Please read and accept the Terms & Conditions and Privacy Policy.";
  const signupCanContinue = signupData.termsAccepted && Boolean(signupData.countryCode);
  const signupTermsAcceptedRef = useRef(false);

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
        setSignupError("Please select your country and accept the Terms & Conditions and Privacy Policy to continue.");
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
      setLoginError("Please enter both email and password.");
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
      setSignupError("Please fill name, email, password, and confirm password.");
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

    if (signupData.password.length < 6) {
      setSignupError("Password must be at least 6 characters.");
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
      setSignupError("Country is required");
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
      setSignupError("Please select your country and accept the Terms & Conditions and Privacy Policy to continue.");
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

  const loginSocialButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-13 w-full rounded-2xl border-slate-200 bg-white text-slate-900 shadow-[0_10px_28px_rgba(148,163,184,0.14)] hover:bg-slate-50"
        disabled={loading}
        onClick={() => void handleAppleLogin("login")}
      >
        Sign in with Apple
      </Button>
      {canUseLinkedInAuth ? (
        <Button
          type="button"
          variant="outline"
          className="h-13 w-full rounded-2xl border-[#bfd7f4] bg-white text-[#0A66C2] shadow-[0_10px_28px_rgba(10,102,194,0.08)] hover:bg-[#f3f8fe]"
          disabled={loading}
          onClick={() => handleLinkedInAuth("login")}
        >
          Sign in with LinkedIn
        </Button>
      ) : null}
      {canUseGoogleAuth ? (
        <GoogleAuthButton
          text="signin_with"
          onSuccess={(credentialResponse) => void handleGoogleAuthSuccess("login", credentialResponse)}
          onError={() => {
            const message = `Google Sign-In is blocked for ${GOOGLE_AUTH_CONFIG.origin || window.location.origin}.`;
            setLoginError(message);
            showPopup(message, "error", 4000);
          }}
        />
      ) : null}
    </>
  );

  const signupSocialButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-13 w-full rounded-2xl border-slate-200 bg-white text-slate-900 shadow-[0_10px_28px_rgba(148,163,184,0.14)] hover:bg-slate-50"
        disabled={!signupCanContinue}
        onClick={() => void handleAppleLogin("signup")}
      >
        Sign up with Apple
      </Button>
      {canUseLinkedInAuth ? (
        <Button
          type="button"
          variant="outline"
          className="h-13 w-full rounded-2xl border-[#bfd7f4] bg-white text-[#0A66C2] shadow-[0_10px_28px_rgba(10,102,194,0.08)] hover:bg-[#f3f8fe]"
          onClick={() => handleLinkedInAuth("signup")}
          disabled={!signupCanContinue}
        >
          Sign up with LinkedIn
        </Button>
      ) : null}
      {canUseGoogleAuth ? (
        <GoogleAuthButton
          text="signup_with"
          disabled={!signupCanContinue}
          onBlockedClick={() => {
            if (!signupData.countryCode) {
              setSignupError("Country is required");
              return;
            }
            openSignupTermsModal("terms");
          }}
          onSuccess={(credentialResponse) => {
            if (!signupData.countryCode) {
              setSignupError("Country is required");
              return;
            }
            if (!signupTermsAcceptedRef.current) {
              setSignupError(termsErrorMessage);
              openSignupTermsModal("terms");
              return;
            }
            void handleGoogleAuthSuccess("signup", credentialResponse);
          }}
          onError={() => {
            const message = `Google Sign-Up is blocked for ${GOOGLE_AUTH_CONFIG.origin || window.location.origin}.`;
            setSignupError(message);
            showPopup(message, "error", 4000);
          }}
        />
      ) : null}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.50),rgba(15,23,42,0.72))] p-3 backdrop-blur-sm sm:p-4 sm:py-6">
      <TermsModal
        isOpen={signupTermsModalOpen}
        type={signupTermsModalType}
        onAccept={handleSignupTermsAccepted}
        onClose={() => setSignupTermsModalOpen(false)}
      />
      <div className="flex min-h-[100dvh] items-center justify-center">
        <AuthLayout>
          <AuthCard
            title={`Welcome to ${COMPANY_LEGAL_NAME}`}
            description="Sign in to continue where you left off, or create a new account with the same secure NRITAX.AI workflow."
            onClose={onClose}
            disableClose={disableClose}
          >
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
              <AuthToggle />

              <AnimatePresence mode="wait" initial={false}>
                {activeTab === "login" ? (
                  <TabsContent key="login" value="login" forceMount className="mt-6 space-y-0 data-[state=inactive]:hidden">
                    <motion.div
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <LoginForm
                        loginData={loginData}
                        showPassword={showLoginPassword}
                        loading={loading}
                        error={loginError}
                        forgotPasswordMode={forgotPasswordMode}
                        forgotPasswordEmail={forgotPasswordEmail}
                        onSubmit={handleLogin}
                        onEmailChange={(value) => setLoginData({ ...loginData, email: value })}
                        onPasswordChange={(value) => setLoginData({ ...loginData, password: value })}
                        onTogglePassword={() => setShowLoginPassword((prev) => !prev)}
                        onToggleForgotPassword={() => {
                          setForgotPasswordMode((prev) => !prev);
                          setLoginError(null);
                          setForgotPasswordEmail(loginData.email);
                        }}
                        onForgotPasswordEmailChange={setForgotPasswordEmail}
                        onForgotPassword={() => void handleForgotPassword()}
                        socialButtons={loginSocialButtons}
                      />
                    </motion.div>
                  </TabsContent>
                ) : (
                  <TabsContent key="signup" value="signup" forceMount className="mt-6 space-y-0 data-[state=inactive]:hidden">
                    <motion.div
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <SignupForm
                        signupData={{
                          name: signupData.name,
                          email: signupData.email,
                          linkedinProfile: signupData.linkedinProfile,
                          password: signupData.password,
                          confirmPassword: signupData.confirmPassword,
                          termsAccepted: signupData.termsAccepted,
                        }}
                        loading={loading}
                        error={signupError}
                        canContinue={signupCanContinue}
                        showPassword={showSignupPassword}
                        showConfirmPassword={showConfirmPassword}
                        onSubmit={handleSignup}
                        onFieldChange={(field, value) => setSignupData({ ...signupData, [field]: value })}
                        onTogglePassword={() => setShowSignupPassword((prev) => !prev)}
                        onToggleConfirmPassword={() => setShowConfirmPassword((prev) => !prev)}
                        onTermsChange={(checked) => {
                          if (checked && !signupData.termsAccepted) {
                            openSignupTermsModal("terms");
                            return;
                          }
                          signupTermsAcceptedRef.current = false;
                          clearSignupTermsSession();
                          setSignupData({ ...signupData, termsAccepted: false });
                        }}
                        onOpenTerms={openSignupTermsModal}
                        countryField={
                          <CountrySelect
                            value={signupData.countryCode}
                            onChange={(value) => setSignupData({ ...signupData, countryCode: value })}
                          />
                        }
                        socialButtons={signupSocialButtons}
                      />
                    </motion.div>
                  </TabsContent>
                )}
              </AnimatePresence>
            </Tabs>
          </AuthCard>
        </AuthLayout>
      </div>

      {popup ? <AuthPopup message={popup.message} type={popup.type} /> : null}
    </div>
  );
}
