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
import { forgotPassword, loginUser, signupUser, googleLoginUser } from "../../utils/api";
import { GOOGLE_AUTH_CONFIG, LINKEDIN_AUTH_CONFIG } from "../../config/appConfig";
import { AuthPopup } from "./AuthPopup";

interface LoginModalProps {
  onClose: () => void;
  disableClose?: boolean;
}

export function LoginModal({ onClose, disableClose = false }: LoginModalProps) {
  const linkedInUrlPattern = /^https?:\/\/(?:www\.)?linkedin\.com\/.+/i;
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
  const canUseGoogleAuth = Boolean(GOOGLE_AUTH_CONFIG.clientId);
  const canUseLinkedInAuth = Boolean(LINKEDIN_AUTH_CONFIG.clientId && LINKEDIN_AUTH_CONFIG.authBaseUrl);

  const resolveAuthUser = (response: any) =>
    response?.user || response?.data?.user || response?.data || null;

  const showGoogleOriginMismatchHint = (mode: "login" | "signup") => {
    const currentOrigin = GOOGLE_AUTH_CONFIG.origin || window.location.origin;
    const actionLabel = mode === "signup" ? "Sign-Up" : "Sign-In";
    setPopup({
      message: `Google ${actionLabel} blocked. Add '${currentOrigin}' to Authorized JavaScript origins in Google Cloud Console.`,
      type: "error",
    });
    setTimeout(() => setPopup(null), 4500);
  };

  const handleLinkedInAuth = (mode: "login" | "signup") => {
    try {
      if (!LINKEDIN_AUTH_CONFIG.clientId || !LINKEDIN_AUTH_CONFIG.authBaseUrl) {
        throw new Error("LinkedIn Sign-In configuration is missing");
      }

      const authUrl = new URL("/auth/linkedin", `${LINKEDIN_AUTH_CONFIG.authBaseUrl}/`);
      authUrl.searchParams.set("mode", mode);
      authUrl.searchParams.set("origin", window.location.origin);

      console.log("[linkedin-oauth] opening authorization url", {
        origin: window.location.origin,
        redirectUri: `${LINKEDIN_AUTH_CONFIG.authBaseUrl}/auth/linkedin/callback`,
        authorizationUrl: authUrl.toString(),
      });

      window.location.href = authUrl.toString();
    } catch (error: any) {
      setPopup({
        message: error?.message || "LinkedIn Sign-In could not start",
        type: "error",
      });
      setTimeout(() => setPopup(null), 2200);
    }
  };

  const handleAuthSuccess = (response: any, message: string) => {
    const token = response?.token;
    const user = resolveAuthUser(response);

    if (!token || !user) {
      throw new Error("Invalid authentication response");
    }

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    setPopup({
      message,
      type: "success",
    });

    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("auth-changed"));

    setTimeout(() => {
      setPopup(null);
      onClose();
    }, 800);
  };

  const handleForgotPassword = async () => {
    setLoginError(null);

    const email = forgotPasswordEmail.trim() || loginData.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError("Please enter a valid email address to reset your password.");
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPassword({ email });
      setPopup({
        message: response?.message || "If an account exists, a reset link has been sent to your email.",
        type: "success",
      });
      setForgotPasswordEmail(email);
      setTimeout(() => setPopup(null), 2600);
    } catch (err: any) {
      setLoginError(err?.response?.data?.message || "Unable to send password reset email right now.");
    } finally {
      setLoading(false);
    }
  };

  // ================= LOGIN =================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginData.email.trim() || !loginData.password.trim()) {
      setLoginError("Please enter both email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email.trim())) {
      setLoginError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await loginUser(loginData);
      const user = resolveAuthUser(response);
      handleAuthSuccess(response, `WELCOME ${user?.name || "User"}!`);

    } catch (err: any) {
      setLoginError(err.response?.data?.message || "Login failed");
      setPopup({
        message: err.response?.data?.message || "Login failed",
        type: "error",
      });

      setTimeout(() => setPopup(null), 2000);
    } finally {
      setLoading(false);
    }
  };

  // ================= SIGNUP =================
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (!signupData.name.trim() || !signupData.email.trim() || !signupData.linkedinProfile.trim() || !signupData.password || !signupData.confirmPassword) {
      setSignupError("Please fill all fields to create your account.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email.trim())) {
      setSignupError("Please enter a valid email address.");
      return;
    }

    if (!linkedInUrlPattern.test(signupData.linkedinProfile.trim())) {
      setSignupError("Please enter a valid LinkedIn profile URL.");
      return;
    }

    if (signupData.password.length < 6) {
      setSignupError("Password must be at least 6 characters.");
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      setSignupError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await signupUser({
        ...signupData,
        name: signupData.name.trim(),
        email: signupData.email.trim(),
        linkedinProfile: signupData.linkedinProfile.trim(),
      });
      const user = resolveAuthUser(response);
      handleAuthSuccess(
        response,
        `Account created successfully! WELCOME ${user?.name || "User"}`
      );
    } catch (err: any) {
      setSignupError(err.response?.data?.message || "Signup failed");
      setPopup({
        message: err.response?.data?.message || "Signup failed",
        type: "error",
      });

      setTimeout(() => setPopup(null), 2000);
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
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 py-6 overflow-y-auto">
      <Card className="w-full max-w-md max-h-[92dvh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Welcome to NRITAX.AI</CardTitle>
              <CardDescription>
                Login or create an account to continue
              </CardDescription>
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
            onValueChange={(v) => {
              setActiveTab(v as "login" | "signup");
              setForgotPasswordMode(false);
              setLoginError(null);
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {/* ================= LOGIN TAB ================= */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    placeholder="your.email@example.com"
                    value={loginData.email}
                    onChange={(e) =>
                      setLoginData({ ...loginData, email: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2 relative">
                  <Label>Password</Label>
                  <Input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({ ...loginData, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowLoginPassword(!showLoginPassword)
                    }
                    className="absolute right-3 top-9 text-[#E2E8F0]"
                  >
                    {showLoginPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
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
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F7FAFC] p-4 space-y-3">
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
                    <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => void handleForgotPassword()}>
                      {loading ? "Sending reset link..." : "Send Reset Link"}
                    </Button>
                  </div>
                ) : null}

                {loginError && activeTab === "login" && (
                  <p className="text-red-500 text-sm">{loginError}</p>
                )}

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
                {loading && <p className="text-xs text-[#0F172A] text-center">Processing...</p>}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#F7FAFC] px-2 text-[#E2E8F0]">Or continue with</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-[#0A66C2] text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white"
                    onClick={() => handleLinkedInAuth("login")}
                  >
                    Sign in with LinkedIn
                  </Button>
                  {canUseGoogleAuth ? (
                    <div className="w-full overflow-hidden rounded-md [&>div]:!w-full [&>div>div]:!w-full">
                      <GoogleLogin
                      text="signin_with"
                      {...googleButtonProps}
                      onSuccess={async (credentialResponse) => {
                        try {
                          if (!credentialResponse.credential) {
                            throw new Error("Missing Google credential");
                          }

                          const response = await googleLoginUser(
                            credentialResponse.credential
                          );
                          const user = resolveAuthUser(response);
                          handleAuthSuccess(
                            response,
                            `WELCOME ${user?.name || "User"}!`
                          );
                        } catch (err: any) {
                          setPopup({
                            message: err.response?.data?.message || "Google login failed",
                            type: "error",
                          });
                          setTimeout(() => setPopup(null), 2000);
                        }
                      }}
                      onError={() => {
                        showGoogleOriginMismatchHint("login");
                      }}
                      />
                    </div>
                  ) : null}
                </div>

              </form>
            </TabsContent>

            {/* ================= SIGNUP TAB ================= */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    required
                    value={signupData.name}
                    placeholder="Your full name"
                    onChange={(e) =>
                      setSignupData({ ...signupData, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    placeholder="your.email@example.com"
                    value={signupData.email}
                    onChange={(e) =>
                      setSignupData({ ...signupData, email: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>LinkedIn Profile</Label>
                  <Input
                    type="url"
                    required
                    placeholder="https://www.linkedin.com/in/your-profile"
                    value={signupData.linkedinProfile}
                    onChange={(e) =>
                      setSignupData({ ...signupData, linkedinProfile: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2 relative">
                  <Label>Password</Label>
                  <Input
                    type={showSignupPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={signupData.password}
                    onChange={(e) =>
                      setSignupData({
                        ...signupData,
                        password: e.target.value,
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowSignupPassword(!showSignupPassword)
                    }
                    className="absolute right-3 top-9 text-[#E2E8F0]"
                  >
                    {showSignupPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                <div className="space-y-2 relative">
                  <Label>Confirm Password</Label>
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={signupData.confirmPassword}
                    onChange={(e) =>
                      setSignupData({
                        ...signupData,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-3 top-9 text-[#E2E8F0]"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                {signupError && activeTab === "signup" && (
                  <p className="text-red-500 text-sm">{signupError}</p>
                )}

                <p className="text-xs text-[#0F172A]">
                  Use at least 6 characters for a secure password.
                </p>

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
                {loading && <p className="text-xs text-[#0F172A] text-center">Processing...</p>}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" /> </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#F7FAFC] px-2 text-[#E2E8F0]">Or continue with</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
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
                      <GoogleLogin
                      text="signup_with"
                      {...googleButtonProps}
                      onSuccess={async (credentialResponse) => {
                        try {
                          if (!credentialResponse.credential) {
                            throw new Error("Missing Google credential");
                          }

                          const response = await googleLoginUser(
                            credentialResponse.credential
                          );
                          const user = resolveAuthUser(response);
                          handleAuthSuccess(
                            response,
                            `Account created successfully! WELCOME ${user?.name || "User"}`
                          );
                        } catch (err: any) {
                          setPopup({
                            message: err.response?.data?.message || "Google signup failed",
                            type: "error",
                          });

                          setTimeout(() => setPopup(null), 2000);
                        }
                      }}
                      onError={() => {
                        showGoogleOriginMismatchHint("signup");
                      }}
                      />
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-[#E2E8F0] text-center">
                  By signing up, you agree to our Terms of Service and Privacy Policy
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {popup && <AuthPopup message={popup.message} type={popup.type} />}

    </div>
  );
}












