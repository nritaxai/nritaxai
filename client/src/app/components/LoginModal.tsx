import { useState } from "react";
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
import { X, Eye, EyeOff, Loader2 } from "lucide-react";
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
  IS_ANDROID_NATIVE_APP,
  IS_IOS_NATIVE_APP,
  LINKEDIN_AUTH_CONFIG,
  NATIVE_APP_CALLBACK_URL,
} from "../../config/appConfig";
import { startAppleAuth } from "../../utils/appleAuth";
import { AuthPopup } from "./AuthPopup";
import { signInWithNativeGoogle } from "../../services/googleSignIn";

interface LoginModalProps {
  onClose: () => void;
  disableClose?: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const linkedInUrlPattern = /^https?:\/\/(?:www\.)?linkedin\.com\/.+/i;

const getApiErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

export function LoginModal({ onClose, disableClose = false }: LoginModalProps) {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    linkedinProfile: "",
    password: "",
    confirmPassword: "",
  });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [popup, setPopup] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const canUseGoogleAuth = (IS_ANDROID_NATIVE_APP || Boolean(GOOGLE_AUTH_CONFIG.clientId)) && !IS_IOS_NATIVE_APP;
  const canUseLinkedInAuth =
    Boolean(LINKEDIN_AUTH_CONFIG.clientId && LINKEDIN_AUTH_CONFIG.authBaseUrl) && !IS_IOS_NATIVE_APP;
  const canUseAppleAuth = APPLE_AUTH_CONFIG.isConfigured;

  const resolveAuthUser = (response: any) =>
    response?.user || response?.data?.user || response?.data || null;

  const showPopup = (message: string, type: "success" | "error", duration = 2500) => {
    setPopup({ message, type });
    window.setTimeout(() => setPopup(null), duration);
  };

  const handleLinkedInAuth = (mode: "login" | "signup") => {
    try {
      if (!LINKEDIN_AUTH_CONFIG.clientId || !LINKEDIN_AUTH_CONFIG.authBaseUrl) {
        throw new Error("LinkedIn Sign-In configuration is missing.");
      }

      const authUrl = new URL("/auth/linkedin", `${LINKEDIN_AUTH_CONFIG.authBaseUrl}/`);
      authUrl.searchParams.set("mode", mode);
      const authOrigin = IS_ANDROID_NATIVE_APP ? NATIVE_APP_CALLBACK_URL : window.location.origin;
      authUrl.searchParams.set("origin", authOrigin);

      console.info("[auth] starting LinkedIn auth", {
        mode,
        origin: authOrigin,
      });

      if (IS_ANDROID_NATIVE_APP) {
        const openedWindow = window.open(authUrl.toString(), "_blank", "noopener,noreferrer");
        if (!openedWindow) {
          window.location.href = authUrl.toString();
        }
        return;
      }

      window.location.href = authUrl.toString();
    } catch (error: any) {
      showPopup(getApiErrorMessage(error, "LinkedIn Sign-In could not start."), "error");
    }
  };

  const handleGoogleNativeAuth = async (mode: "login" | "signup") => {
    try {
      setLoginError(null);
      setSignupError(null);
      setLoading(true);
      const response = await signInWithNativeGoogle();
      const user = resolveAuthUser(response);
      handleAuthSuccess(
        response,
        mode === "signup"
          ? `Account created successfully! WELCOME ${user?.name || "User"}`
          : `WELCOME ${user?.name || "User"}!`
      );
    } catch (error: any) {
      const message = getApiErrorMessage(error, "Google Sign-In could not start.");
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

    setLoading(true);
    try {
      const response = await signupUser({
        name: signupData.name.trim(),
        email: signupData.email.trim().toLowerCase(),
        linkedinProfile: signupData.linkedinProfile.trim(),
        password: signupData.password,
        confirmPassword: signupData.confirmPassword,
      });
      const user = resolveAuthUser(response);
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
    width: "100%",
    logo_alignment: "left" as const,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-6 sm:items-center">
      <Card className="w-full max-w-lg max-h-[92dvh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Welcome to NRITAX.AI</CardTitle>
              <CardDescription>Login or create an account to continue</CardDescription>
            </div>
            {!disableClose ? (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="size-5" />
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          <Tabs
            defaultValue="login"
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as "login" | "signup");
              setForgotPasswordMode(false);
              setLoginError(null);
              setSignupError(null);
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="your.email@example.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  />
                </div>

                <div className="relative space-y-2">
                  <Label>Password</Label>
                  <Input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    placeholder="........"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-3 top-9 text-slate-500"
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-sm text-[#2563eb] hover:underline"
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
                  <div className="space-y-3 rounded-lg border border-[#E2E8F0] bg-[#F7FAFC] p-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-password-email">Reset Email</Label>
                      <Input
                        id="forgot-password-email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={loading}
                      onClick={() => void handleForgotPassword()}
                    >
                      {loading ? "Sending reset link..." : "Send Reset Link"}
                    </Button>
                  </div>
                ) : null}

                {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    "Login"
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#F7FAFC] px-2 text-slate-500">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {canUseAppleAuth ? (
                    <Button type="button" variant="outline" className="w-full" onClick={() => void handleAppleLogin("login")}>
                      Sign in with Apple
                    </Button>
                  ) : null}
                  {canUseLinkedInAuth ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-[#0A66C2] text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white"
                      onClick={() => handleLinkedInAuth("login")}
                    >
                      Sign in with LinkedIn
                    </Button>
                  ) : null}
                  {canUseGoogleAuth ? (
                    <div className="w-full overflow-hidden rounded-md [&>div]:!w-full [&>div>div]:!w-full">
                      {IS_ANDROID_NATIVE_APP ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                          disabled={loading}
                          onClick={() => void handleGoogleNativeAuth("login")}
                        >
                          Sign in with Google
                        </Button>
                      ) : (
                        <GoogleLogin
                          text="signin_with"
                          {...googleButtonProps}
                          onSuccess={async (credentialResponse) => {
                            try {
                              if (!credentialResponse.credential) {
                                throw new Error("Missing Google credential.");
                              }
                              const response = await googleLoginUser(credentialResponse.credential);
                              const user = resolveAuthUser(response);
                              handleAuthSuccess(response, `WELCOME ${user?.name || "User"}!`);
                            } catch (error: any) {
                              const message = getApiErrorMessage(error, "Google login failed.");
                              console.error("[auth] google login failed", { message });
                              setLoginError(message);
                              showPopup(message, "error");
                            }
                          }}
                          onError={() => {
                            const message = `Google Sign-In is blocked for ${GOOGLE_AUTH_CONFIG.origin || window.location.origin}.`;
                            setLoginError(message);
                            showPopup(message, "error", 4000);
                          }}
                        />
                      )}
                    </div>
                  ) : null}
                </div>

                {IS_IOS_NATIVE_APP ? (
                  <p className="text-xs text-slate-600">
                    Google and LinkedIn sign-in are hidden in the iOS app build to keep authentication inside the app
                    during App Review. Use email/password or Sign in with Apple.
                  </p>
                ) : null}
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    required
                    value={signupData.name}
                    placeholder="Your full name"
                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="your.email@example.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>LinkedIn Profile (optional)</Label>
                  <Input
                    type="url"
                    placeholder="https://www.linkedin.com/in/your-profile"
                    value={signupData.linkedinProfile}
                    onChange={(e) => setSignupData({ ...signupData, linkedinProfile: e.target.value })}
                  />
                </div>

                <div className="relative space-y-2">
                  <Label>Password</Label>
                  <Input
                    type={showSignupPassword ? "text" : "password"}
                    required
                    placeholder="........"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((prev) => !prev)}
                    className="absolute right-3 top-9 text-slate-500"
                    aria-label={showSignupPassword ? "Hide password" : "Show password"}
                  >
                    {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="relative space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="........"
                    value={signupData.confirmPassword}
                    onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-9 text-slate-500"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {signupError ? <p className="text-sm text-red-600">{signupError}</p> : null}

                <p className="text-xs text-[#0F172A]">Use at least 6 characters for a secure password.</p>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    "Create Account"
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#F7FAFC] px-2 text-slate-500">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {canUseAppleAuth ? (
                    <Button type="button" variant="outline" className="w-full" onClick={() => void handleAppleLogin("signup")}>
                      Sign up with Apple
                    </Button>
                  ) : null}
                  {canUseLinkedInAuth ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-[#0A66C2] text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white"
                      onClick={() => handleLinkedInAuth("signup")}
                    >
                      Sign up with LinkedIn
                    </Button>
                  ) : null}
                  {canUseGoogleAuth ? (
                    <div className="w-full overflow-hidden rounded-md [&>div]:!w-full [&>div>div]:!w-full">
                      {IS_ANDROID_NATIVE_APP ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                          disabled={loading}
                          onClick={() => void handleGoogleNativeAuth("signup")}
                        >
                          Sign up with Google
                        </Button>
                      ) : (
                        <GoogleLogin
                          text="signup_with"
                          {...googleButtonProps}
                          onSuccess={async (credentialResponse) => {
                            try {
                              if (!credentialResponse.credential) {
                                throw new Error("Missing Google credential.");
                              }
                              const response = await googleLoginUser(credentialResponse.credential);
                              const user = resolveAuthUser(response);
                              handleAuthSuccess(
                                response,
                                `Account created successfully! WELCOME ${user?.name || "User"}`
                              );
                            } catch (error: any) {
                              const message = getApiErrorMessage(error, "Google signup failed.");
                              console.error("[auth] google signup failed", { message });
                              setSignupError(message);
                              showPopup(message, "error");
                            }
                          }}
                          onError={() => {
                            const message = `Google Sign-Up is blocked for ${GOOGLE_AUTH_CONFIG.origin || window.location.origin}.`;
                            setSignupError(message);
                            showPopup(message, "error", 4000);
                          }}
                        />
                      )}
                    </div>
                  ) : null}
                </div>

                <p className="text-center text-xs text-slate-600">
                  By signing up, you agree to our Terms of Service and Privacy Policy.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {popup ? <AuthPopup message={popup.message} type={popup.type} /> : null}
    </div>
  );
}
