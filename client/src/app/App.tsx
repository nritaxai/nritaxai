import { lazy, Suspense, useState, useEffect, useRef, useLayoutEffect, type FormEvent, type ReactNode } from "react";
import { Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { WifiOff } from "lucide-react";

import { Header } from "./components/Header";
import NewsTicker from "./components/NewsTicker";
import { ComplianceStandards } from "./components/ComplianceStandards";
import { Footer } from "./components/Footer";
import { AuthPopup } from "./components/AuthPopup";
import { TigerBotAvatar } from "./components/TigerBotAvatar";
import { Button } from "./components/ui/button";
import { Chat } from "./pages/Chat";
import { Home } from "./pages/Home";
import { HeroPage } from "./pages/HeroPage";
import { Pricing } from "./pages/Pricing";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { buildApiUrl, getStoredAuthToken } from "../utils/api";
const LoginModal = lazy(() => import("./components/LoginModal").then((m) => ({ default: m.LoginModal })));
const Calculators = lazy(() => import("./pages/Calculators").then((m) => ({ default: m.Calculators })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Profile = lazy(() => import("./pages/Profile").then((m) => ({ default: m.Profile })));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const Consult = lazy(() => import("./pages/Consult").then((m) => ({ default: m.Consult })));
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

export default function App() {
  const stagingModeEnabled = import.meta.env.VITE_STAGING_MODE === "true";
  const stagingPassword = String(import.meta.env.VITE_STAGING_ACCESS_PASSWORD || "");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(typeof window !== "undefined" && getStoredAuthToken())
  );
  const [successPopup, setSuccessPopup] = useState<string | null>(null);
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
    const handleRequireLogin = () => setShowLoginModal(true);
    const syncAuthState = () => setIsAuthenticated(Boolean(getStoredAuthToken()));

    window.addEventListener("nritax:require-login", handleRequireLogin as EventListener);
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("auth-changed", syncAuthState);

    return () => {
      window.removeEventListener("nritax:require-login", handleRequireLogin as EventListener);
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("auth-changed", syncAuthState);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setShowLoginModal(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated || location.pathname !== "/home") return;

    const timeoutId = window.setTimeout(() => {
      setShowLoginModal(true);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [isAuthenticated, location.pathname]);

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

    setSuccessPopup(message);
    sessionStorage.removeItem("auth_popup");
    sessionStorage.removeItem("subscription_popup");

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
          ? `Account created successfully! WELCOME ${user?.name || "User"}`
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

  const withPageScaffold = (element: ReactNode) => <PageScaffold>{element}</PageScaffold>;

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
  const isStandaloneRoute = isHeroRoute || location.pathname === "/reset-password";
  const protectedPaths = new Set([
    "/calculators",
    "/Pricing",
    "/pricing",
    "/checkout",
    "/login",
    "/profile",
    "/chat",
    "/dashboard",
    "/compliance",
    "/builder",
    "/consult",
    "/reschedule",
    "/cancel",
    "/privacy-policy",
    "/about-us",
    "/terms-and-conditions",
    "/refund-policy",
    "/disclaimer",
  ]);
  const requiresAuthentication = protectedPaths.has(location.pathname);
  const requiresHomeLoginGate = !isAuthenticated && location.pathname === "/home";
  const hasSiteHeader = !isStandaloneRoute && isAuthenticated;
  const shouldShowNewsTicker = location.pathname === "/home";

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
      {requiresAuthentication && !isAuthenticated ? <Navigate to="/home" replace /> : null}
      {hasSiteHeader && (
        <Header onLogin={() => setShowLoginModal(true)} />
      )}
      {shouldShowNewsTicker ? <NewsTicker /> : null}

      <div ref={routeContentRef}>
        <Suspense fallback={<div className="p-6 text-sm text-[#0F172A]">Loading...</div>}>
          <Routes location={location}>
            <Route path="/" element={<HeroPage />} />
            <Route path="/Hero" element={<HeroPage />} />
            <Route path="/hero" element={<HeroPage />} />
            <Route path="/home" element={withPageScaffold(<Home onRequireLogin={() => setShowLoginModal(true)} />)} />

            <Route
              path="/calculators"
              element={<Calculators onRequireLogin={() => setShowLoginModal(true)} />}
            />
            <Route path="/Pricing" element={withPageScaffold(<Pricing onRequireLogin={() => setShowLoginModal(true)} />)} />
            <Route path="/pricing" element={withPageScaffold(<Pricing onRequireLogin={() => setShowLoginModal(true)} />)} />
            <Route
              path="/checkout"
              element={withPageScaffold(<CheckoutPage onRequireLogin={() => setShowLoginModal(true)} />)}
            />
            <Route path="/login" element={withPageScaffold(<Login />)} />
            <Route path="/reset-password" element={withPageScaffold(<ResetPassword />)} />
            <Route path="/profile" element={withPageScaffold(<Profile />)} />
            <Route path="/chat" element={withPageScaffold(<Chat onRequireLogin={() => setShowLoginModal(true)} />)} />
            <Route path="/dashboard" element={withPageScaffold(<AdminDashboard />)} />
            <Route path="/compliance" element={withPageScaffold(<ComplianceStandards />)} />
            <Route path="/builder" element={withPageScaffold(<Builder />)} />
            <Route path="/consult" element={withPageScaffold(<Consult onRequireLogin={() => setShowLoginModal(true)} />)} />
            <Route path="/reschedule" element={withPageScaffold(<Reschedule />)} />
            <Route path="/cancel" element={withPageScaffold(<Cancel />)} />
            <Route path="/privacy-policy" element={withPageScaffold(<PrivacyPolicy />)} />
            <Route path="/about-us" element={withPageScaffold(<AboutUs />)} />
            <Route path="/terms-and-conditions" element={withPageScaffold(<TermsAndConditions />)} />
            <Route path="/refund-policy" element={withPageScaffold(<RefundPolicy />)} />
            <Route path="/disclaimer" element={withPageScaffold(<Disclaimer />)} />
          </Routes>
        </Suspense>
      </div>

      {!isStandaloneRoute && isAuthenticated && <TigerBotAvatar />}

      {hasSiteHeader && <Footer />}

      {showLoginModal && (
        <Suspense fallback={null}>
          <LoginModal
            onClose={() => setShowLoginModal(false)}
            disableClose={requiresHomeLoginGate}
          />
        </Suspense>
      )}

      {successPopup && <AuthPopup message={successPopup} type="success" />}
    </div>
  );
}











