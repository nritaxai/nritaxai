import { lazy, Suspense, useState, useEffect, useRef, useLayoutEffect, type FormEvent, type ReactNode } from "react";
import { Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { WifiOff } from "lucide-react";

import { Header } from "./components/Header";
import { AndroidHeader } from "./components/AndroidHeader";
import { AndroidPageWrapper } from "./components/AndroidPageWrapper";
import { iOSHeader as IOSHeader } from "./components/iOSHeader";
import NewsTicker from "./components/NewsTicker";
import { ComplianceStandards } from "./components/ComplianceStandards";
import { Footer } from "./components/Footer";
import { AuthPopup } from "./components/AuthPopup";
import { TigerBotAvatar } from "./components/TigerBotAvatar";
import { Button } from "./components/ui/button";
import { AndroidBottomNav } from "../components/AndroidBottomNav";
import { AndroidHomePage } from "../components/AndroidHomePage";
import { iOSBottomNav as IOSBottomNav } from "../components/iOSBottomNav";
import { iOSHomePage as IOSHomePage } from "../components/iOSHomePage";
import { AndroidYuktiPage } from "../pages/AndroidYuktiPage";
import { iOSYuktiPage as IOSYuktiPage } from "../pages/iOSYuktiPage";
import { Chat } from "./pages/Chat";
import { Home } from "./pages/Home";
import { Pricing } from "./pages/Pricing";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { IS_IOS_NATIVE_APP } from "../config/appConfig";
import { buildApiUrl, getStoredAuthToken } from "../utils/api";
import { syncPersistedAuthToLocalStorage } from "../services/authStorage";
const AndroidLauncher = lazy(() => import("./pages/AndroidLauncher").then((m) => ({ default: m.AndroidLauncher })));
const Calculators = lazy(() => import("./pages/Calculators").then((m) => ({ default: m.Calculators })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Profile = lazy(() => import("./pages/Profile").then((m) => ({ default: m.Profile })));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const Consult = lazy(() => import("./pages/Consult").then((m) => ({ default: m.Consult })));
const JoinAsExpertPage = lazy(() => import("./pages/JoinAsExpert"));
const Reschedule = lazy(() => import("./pages/Reschedule").then((m) => ({ default: m.Reschedule })));
const Cancel = lazy(() => import("./pages/Cancel").then((m) => ({ default: m.Cancel })));
const Builder = lazy(() => import("./pages/Builder").then((m) => ({ default: m.Builder })));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));
const AboutUs = lazy(() => import("./pages/AboutUs").then((m) => ({ default: m.AboutUs })));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions").then((m) => ({ default: m.TermsAndConditions })));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy").then((m) => ({ default: m.RefundPolicy })));
const Disclaimer = lazy(() => import("./pages/Disclaimer").then((m) => ({ default: m.Disclaimer })));
const ResetPassword = lazy(() => import("./pages/ResetPassword").then((m) => ({ default: m.ResetPassword })));
function PageScaffold({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <div className="w-full px-4 py-8 md:px-6 md:py-10">{children}</div>
    </div>
  );
}

type NativeWrapperWindow = Window & {
  __NRITAX_IOS_WRAPPER__?: boolean;
};

const isTransientWelcomeMessage = (message?: string | null) => {
  if (!message) return false;
  return /^welcome\b/i.test(message.trim());
};

export default function App() {
  const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const isIosNativeWrapper =
    typeof window !== "undefined" &&
    (Boolean((window as NativeWrapperWindow).__NRITAX_IOS_WRAPPER__) ||
      window.localStorage.getItem("nritax_ios_wrapper") === "true" ||
      /NRITAXIOSWrapper/i.test(window.navigator.userAgent));
  const isIosNativeApp = Capacitor.getPlatform() === "ios" || IS_IOS_NATIVE_APP || isIosNativeWrapper;
  const stagingModeEnabled = import.meta.env.VITE_STAGING_MODE === "true";
  const stagingPassword = String(import.meta.env.VITE_STAGING_ACCESS_PASSWORD || "");
  const promoUpgradePromptSessionKey = "promo_upgrade_prompt_seen";
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(typeof window !== "undefined" && getStoredAuthToken())
  );
  const [successPopup, setSuccessPopup] = useState<string | null>(null);
  const [showPromoUpgradePrompt, setShowPromoUpgradePrompt] = useState(false);
  const popupTimeoutRef = useRef<number | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [stagingInput, setStagingInput] = useState("");
  const [stagingError, setStagingError] = useState("");
  const [stagingAuthorized, setStagingAuthorized] = useState(() => {
    if (!stagingModeEnabled || !stagingPassword) return true;
    return localStorage.getItem("staging_access_granted") === "true";
  });

  const location = useLocation();
  const navigate = useNavigate();
  const routeContentRef = useRef<HTMLDivElement>(null);

  const openWebAuthPage = (mode: "login" | "signup" = "login", redirectTo?: string) => {
    const params = new URLSearchParams();
    params.set("mode", mode);
    if (redirectTo) {
      params.set("redirect", redirectTo);
    }
    navigate(`/login?${params.toString()}`);
  };

  useEffect(() => {
    if (!isNative) return;

    let isCancelled = false;

    const hydrateNativeAuth = async () => {
      const persisted = await syncPersistedAuthToLocalStorage();
      if (isCancelled) return;
      setIsAuthenticated(Boolean(persisted?.token || getStoredAuthToken()));
    };

    void hydrateNativeAuth();

    return () => {
      isCancelled = true;
    };
  }, [isNative]);

  useEffect(() => {
    if (!isIosNativeApp) return;

    if (location.pathname === "/" || location.pathname === "/dashboard") {
      navigate("/home", { replace: true });
    }
  }, [isIosNativeApp, location.pathname, navigate]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    const handleRequireLogin = () => {
      if (isNative) {
        navigate("/login");
        return;
      }
      openWebAuthPage("login", `${location.pathname}${location.search}${location.hash}`);
    };
    const syncAuthState = () => setIsAuthenticated(Boolean(getStoredAuthToken()));
    const handleAuthPopup = (event: Event) => {
      const customEvent = event as CustomEvent<{
        message?: string;
        type?: "success" | "error";
        duration?: number;
      }>;
      const message = customEvent.detail?.message;
      const duration = customEvent.detail?.duration ?? 1000;
      if (!message) return;
      if (location.pathname === "/home" && isTransientWelcomeMessage(message)) {
        return;
      }

      setSuccessPopup(message);
      if (popupTimeoutRef.current) {
        window.clearTimeout(popupTimeoutRef.current);
      }
      popupTimeoutRef.current = window.setTimeout(() => {
        setSuccessPopup(null);
        popupTimeoutRef.current = null;
      }, duration);
    };

    window.addEventListener("nritax:require-login", handleRequireLogin as EventListener);
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("auth-changed", syncAuthState);
    window.addEventListener("nritax:auth-popup", handleAuthPopup as EventListener);

    return () => {
      window.removeEventListener("nritax:require-login", handleRequireLogin as EventListener);
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("auth-changed", syncAuthState);
      window.removeEventListener("nritax:auth-popup", handleAuthPopup as EventListener);
      if (popupTimeoutRef.current) {
        window.clearTimeout(popupTimeoutRef.current);
      }
    };
  }, [isNative, location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const protectedTermsRoutes = new Set(["/chat", "/yukti", "/ios-yukti"]);
    if (!protectedTermsRoutes.has(location.pathname)) return;

    try {
      const rawUser = localStorage.getItem("user");
      const user = rawUser ? JSON.parse(rawUser) : null;
      if (!user?.termsAccepted || !user?.acceptedAt) {
        navigate("/profile", {
          replace: true,
          state: { requiresLegalAcceptance: true, returnTo: location.pathname },
        });
      }
    } catch {
      navigate("/profile", {
        replace: true,
        state: { requiresLegalAcceptance: true, returnTo: location.pathname },
      });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  useEffect(() => {
    let isCancelled = false;
    const pingHealth = async () => {
      try {
        const response = await fetch(buildApiUrl("/health"), { method: "GET" });
        if (!response.ok) {
          console.error("[health] backend not healthy", response.status);
          return;
        }
        if (!isCancelled) {
          const payload = await response.json();
          if (payload?.status !== "ok") {
            console.error("[health] unexpected payload", payload);
          }
        }
      } catch (error: any) {
        console.error("[health] failed", error?.message || error);
      }
    };

    void pingHealth();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/home") return;
    const message =
      sessionStorage.getItem("auth_popup") ||
      sessionStorage.getItem("subscription_popup");
    if (!message) return;

    sessionStorage.removeItem("auth_popup");
    sessionStorage.removeItem("subscription_popup");

    setSuccessPopup(message);

    const timeout = window.setTimeout(() => {
      setSuccessPopup(null);
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/home" && location.hash) {
      const element = document.querySelector(location.hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  }, [location]);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowPromoUpgradePrompt(false);
      return;
    }

    let isCancelled = false;

    const loadSubscriptionStatus = async () => {
      try {
        const token = getStoredAuthToken();
        if (!token) return;

        const response = await fetch(buildApiUrl("/api/subscription/status"), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        if (isCancelled) return;

        const subscription = data?.subscription || null;
        const subscriptionDetails = data?.subscriptionDetails || null;
        const promptKey = `${promoUpgradePromptSessionKey}:${subscription?.subscriptionId || "promo-expired"}`;
        const hasSeenPrompt = sessionStorage.getItem(promptKey) === "true";
        const shouldShowPrompt =
          subscription?.provider === "promo" &&
          subscriptionDetails?.subscriptionStatus === "inactive";

        if (shouldShowPrompt && !hasSeenPrompt) {
          sessionStorage.setItem(promptKey, "true");
          setShowPromoUpgradePrompt(true);
          return;
        }

        if (!shouldShowPrompt) {
          setShowPromoUpgradePrompt(false);
        }
      } catch (error) {
        console.error("[subscription-status] failed to load promo upgrade state", error);
      }
    };

    void loadSubscriptionStatus();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, location.pathname]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("auth_provider") !== "linkedin") return;

    const authError = params.get("auth_error");
    const token = params.get("token");
    const encodedUser = params.get("user");
    const authMode = params.get("auth_mode") === "signup" ? "signup" : "login";

    if (authError) {
      sessionStorage.setItem("auth_popup", decodeURIComponent(authError));
      navigate("/home", { replace: true });
      return;
    }

    if (!token || !encodedUser) {
      navigate("/home", { replace: true });
      return;
    }

    try {
      const user = JSON.parse(encodedUser);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("auth-changed"));
      setIsAuthenticated(true);
      sessionStorage.setItem(
        "auth_popup",
        authMode === "signup"
          ? `Account created successfully! WELCOME ${user?.name || "User"}!`
          : `WELCOME ${user?.name || "User"}!`
      );
    } catch (error) {
      console.error("[linkedin-auth] failed to hydrate auth result", error);
      sessionStorage.setItem("auth_popup", "LinkedIn authentication failed");
    }

    navigate("/home", { replace: true });
  }, [location.search, navigate]);

  useLayoutEffect(() => {
    const root = routeContentRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = root.querySelectorAll<HTMLElement>(
      [
        "main section",
        "main article",
        "main form",
        "main [data-slot='card']",
        "main .rounded-xl",
        "main .rounded-2xl",
        "main input",
        "main select",
        "main textarea",
        "main [data-slot='button']",
        "main [data-slot='input']",
        "main [data-slot='select-trigger']",
        "main [data-slot='textarea']",
        "[role='tab']",
        "[role='tabpanel']",
      ].join(", ")
    );

    let order = 0;
    targets.forEach((element) => {
      if (element.classList.contains("reveal-drop") || element.classList.contains("reveal-tile")) return;
      if (element.closest("header, footer, nav")) return;
      if (element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true") return;

      element.classList.add("auto-reveal");
      element.style.setProperty("--auto-reveal-delay", `${Math.min(order, 12) * 60}ms`);
      order += 1;
    });

    const fields = root.querySelectorAll<HTMLElement>(
      "input, textarea, select, [data-slot='input'], [data-slot='select-trigger'], [data-slot='textarea']"
    );
    fields.forEach((field, index) => {
      const distance = 12 + (index % 6) * 2;
      const duration = 420;
      field.style.setProperty("--field-drop-distance", `${distance}px`);
      field.style.setProperty("--field-drop-duration", `${duration}ms`);
    });
  }, [location.pathname]);

  const withPageScaffold = (element: ReactNode) =>
    isNative ? (
      <AndroidPageWrapper>{element}</AndroidPageWrapper>
    ) : isIosNativeApp ? (
      <div className="min-h-screen bg-white px-4 py-4 pb-[calc(88px+env(safe-area-inset-bottom))]">
        {element}
      </div>
    ) : (
      <PageScaffold>{element}</PageScaffold>
    );

  const handleStagingUnlock = (event: FormEvent) => {
    event.preventDefault();
    if (!stagingPassword) {
      setStagingAuthorized(true);
      return;
    }
    if (stagingInput.trim() !== stagingPassword) {
      setStagingError("Invalid staging password.");
      return;
    }
    setStagingError("");
    setStagingAuthorized(true);
    localStorage.setItem("staging_access_granted", "true");
  };

  if (stagingModeEnabled && !stagingAuthorized) {
    return (
      <div className="min-h-screen bg-[#F7FAFC] flex items-center justify-center px-4">
        <form onSubmit={handleStagingUnlock} className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#F7FAFC] p-6 space-y-4">
          <h1 className="text-2xl font-semibold text-[#0F172A]">Staging Access</h1>
          <p className="text-sm text-[#0F172A]">This environment is password-protected for testing.</p>
          <input
            type="password"
            value={stagingInput}
            onChange={(e) => setStagingInput(e.target.value)}
            className="w-full h-11 border border-[#E2E8F0] rounded-lg px-3.5 bg-[#F7FAFC] outline-none"
            placeholder="Enter staging password"
          />
          {stagingError && <p className="text-sm text-red-600">{stagingError}</p>}
          <Button type="submit" className="w-full h-11">
            Continue
          </Button>
        </form>
      </div>
    );
  }

  const isHeroRoute = location.pathname === "/" || location.pathname === "/hero" || location.pathname === "/Hero";
  const isStandaloneRoute =
    isHeroRoute || location.pathname === "/reset-password" || (!isNative && !isIosNativeApp && location.pathname === "/login");
  const isYuktiRoute =
    location.pathname === "/yukti" ||
    location.pathname === "/ios-yukti" ||
    location.pathname === "/tigerbot-avatar" ||
    location.pathname === "/tigerbot-avator";
  const protectedPaths = new Set(
    isNative
      ? ["/profile", "/dashboard", "/compliance", "/builder"]
      : [
          "/calculators",
          "/profile",
          "/chat",
          "/dashboard",
          "/compliance",
          "/builder",
          "/consult",
          "/android-yukti",
          "/reschedule",
          "/cancel",
          "/privacy-policy",
          "/about-us",
          "/terms-and-conditions",
          "/refund-policy",
          "/disclaimer",
        ]
  );
  const requiresAuthentication = protectedPaths.has(location.pathname);
  const isAuthRoute = location.pathname === "/login";
  const hasSiteHeader = !isNative && !isIosNativeApp && !isStandaloneRoute;
  const shouldShowAndroidHeader =
    isNative &&
    location.pathname !== "/reset-password" &&
    location.pathname !== "/login" &&
    location.pathname !== "/home" &&
    location.pathname !== "/";
  const shouldShowAndroidBottomNav =
    isNative &&
    location.pathname !== "/reset-password" &&
    location.pathname !== "/login" &&
    location.pathname !== "/";
  const shouldShowNewsTicker = !isNative && !isIosNativeApp && location.pathname === "/home"; // Android only
  const shouldShowYuktiWidget = !isStandaloneRoute && !isYuktiRoute && isAuthenticated;
  const nativeHomeRoute = isIosNativeApp ? <IOSHomePage /> : isNative ? (
    <AndroidLauncher />
  ) : (
    <Navigate to="/home" replace />
  );
  const nativeHomeScreen = isIosNativeApp
    ? <IOSHomePage />
    : isNative
    ? (
      isAuthenticated ? (
        <AndroidPageWrapper includeHeaderOffset={false} includeBottomNavOffset={false} scrollable={true}>
          <AndroidHomePage onRequireLogin={() => navigate("/login")} />
        </AndroidPageWrapper>
      ) : <Navigate to="/login" replace />
    )
    : withPageScaffold(<Home onRequireLogin={(redirectTo) => openWebAuthPage("login", redirectTo || "/home")} />);

  return (
    <div className="app-shell">
      {!isOnline && (
        <div className="sticky top-0 z-[60] bg-red-600 text-[#0F172A]">
          <div className="max-w-7xl mx-auto px-4 py-2 text-sm flex items-center gap-2">
            <WifiOff className="size-4" />
            You are offline. Some features may not work until your connection is restored.
          </div>
        </div>
      )}
      {requiresAuthentication && !isAuthenticated ? (
        <Navigate
          to={
            isNative
              ? "/login"
              : `/login?${new URLSearchParams({
                  mode: "login",
                  redirect: `${location.pathname}${location.search}${location.hash}`,
                }).toString()}`
          }
          replace
        />
      ) : null}
      {hasSiteHeader && (
        <Header
          onLogin={() => openWebAuthPage("login", `${location.pathname}${location.search}${location.hash}`)}
          onSignup={() => openWebAuthPage("signup")}
        />
      )}
      {shouldShowAndroidHeader && (
        <AndroidHeader onLogin={() => navigate("/login")} />
      )}
      {isIosNativeApp && !isYuktiRoute && !isAuthRoute && <IOSHeader onLogin={() => navigate("/login")} />}
      {shouldShowNewsTicker ? <NewsTicker /> : null}

      <div ref={routeContentRef}>
        <Suspense fallback={<div className="p-6 text-sm text-[#0F172A]">Loading...</div>}>
          <Routes location={location}>
            <Route
              path="/"
              element={isNative ? nativeHomeRoute : isIosNativeApp ? <Navigate to="/home" replace /> : nativeHomeRoute}
            />
            <Route
              path="/Hero"
              element={isNative ? nativeHomeRoute : isIosNativeApp ? <Navigate to="/home" replace /> : nativeHomeRoute}
            />
            <Route
              path="/hero"
              element={isNative ? nativeHomeRoute : isIosNativeApp ? <Navigate to="/home" replace /> : nativeHomeRoute}
            />
            <Route path="/home" element={nativeHomeScreen} />
            <Route path="/ios-yukti" element={isNative ? <AndroidYuktiPage /> : <IOSYuktiPage />} />
            <Route path="/android-yukti" element={isNative ? <AndroidYuktiPage /> : <Navigate to="/yukti" replace />} />
            <Route path="/yukti" element={isNative ? <AndroidYuktiPage /> : <IOSYuktiPage />} />
            <Route path="/tigerbot-avatar" element={isNative ? <AndroidYuktiPage /> : <IOSYuktiPage />} />
            <Route path="/tigerbot-avator" element={isNative ? <AndroidYuktiPage /> : <IOSYuktiPage />} />

            <Route
              path="/calculators"
              element={withPageScaffold(<Calculators onRequireLogin={() => openWebAuthPage("login", "/calculators")} />)}
            />
            <Route path="/Pricing" element={withPageScaffold(<Pricing onRequireLogin={() => openWebAuthPage("login", "/pricing")} />)} />
            <Route path="/pricing" element={withPageScaffold(<Pricing onRequireLogin={() => openWebAuthPage("login", "/pricing")} />)} />
            <Route
              path="/checkout"
              element={withPageScaffold(<CheckoutPage onRequireLogin={() => openWebAuthPage("login", "/checkout")} />)}
            />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={withPageScaffold(<ResetPassword />)} />
            <Route path="/profile" element={withPageScaffold(<Profile />)} />
            <Route path="/chat" element={isIosNativeApp ? <Chat onRequireLogin={() => openWebAuthPage("login", "/chat")} /> : withPageScaffold(<Chat onRequireLogin={() => openWebAuthPage("login", "/chat")} />)} />
            <Route path="/dashboard" element={isIosNativeApp ? <Navigate to="/home" replace /> : withPageScaffold(<AdminDashboard />)} />
            <Route path="/compliance" element={withPageScaffold(<ComplianceStandards />)} />
            <Route path="/builder" element={withPageScaffold(<Builder />)} />
            <Route path="/consult" element={withPageScaffold(<Consult onRequireLogin={() => openWebAuthPage("login", "/consult")} />)} />
            <Route path="/join-as-expert" element={isNative || isIosNativeApp ? withPageScaffold(<JoinAsExpertPage />) : <JoinAsExpertPage />} />
            <Route path="/reschedule" element={withPageScaffold(<Reschedule />)} />
            <Route path="/cancel" element={withPageScaffold(<Cancel />)} />
            <Route path="/privacy-policy" element={withPageScaffold(<PrivacyPolicy />)} />
            <Route path="/about-us" element={withPageScaffold(<AboutUs />)} />
            <Route path="/terms-and-conditions" element={withPageScaffold(<TermsAndConditions />)} />
            <Route path="/refund-policy" element={withPageScaffold(<RefundPolicy />)} />
            <Route path="/disclaimer" element={withPageScaffold(<Disclaimer />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>

      {!isNative && shouldShowYuktiWidget && <TigerBotAvatar />}

      {hasSiteHeader && <Footer />}
      {shouldShowAndroidBottomNav && <AndroidBottomNav />}
      {isIosNativeApp && !isAuthRoute && <IOSBottomNav />}

      {successPopup && <AuthPopup message={successPopup} type="success" />}
      {showPromoUpgradePrompt ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0F172A]/55 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold text-[#0F172A]">Your free month has ended</h2>
            <p className="mt-3 text-sm leading-6 text-[#475569]">
              Your 1-month free trial has expired. Upgrade now to continue using paid features and complete payment on the website.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  setShowPromoUpgradePrompt(false);
                  navigate("/pricing");
                }}
              >
                Upgrade Plan
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowPromoUpgradePrompt(false)}
              >
                Maybe Later
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}




