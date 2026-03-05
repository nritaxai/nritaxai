import { lazy, Suspense, useState, useEffect, useMemo, useRef, type FormEvent, type ReactNode } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { WifiOff } from "lucide-react";

import { Header } from "./components/Header";
import { ComplianceStandards } from "./components/ComplianceStandards";
import { Footer } from "./components/Footer";
import { AuthPopup } from "./components/AuthPopup";
import { TigerBotAvatar } from "./components/TigerBotAvatar";
import { Button } from "./components/ui/button";
import { buildApiUrl } from "../utils/api";
const LoginModal = lazy(() => import("./components/LoginModal").then((m) => ({ default: m.LoginModal })));
const Calculators = lazy(() => import("./pages/Calculators").then((m) => ({ default: m.Calculators })));
const Pricing = lazy(() => import("./pages/Pricing").then((m) => ({ default: m.Pricing })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Profile = lazy(() => import("./pages/Profile").then((m) => ({ default: m.Profile })));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const Chat = lazy(() => import("./pages/Chat").then((m) => ({ default: m.Chat })));
const Consult = lazy(() => import("./pages/Consult").then((m) => ({ default: m.Consult })));
const HomePage = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const HeroPage = lazy(() => import("./pages/HeroPage").then((m) => ({ default: m.HeroPage })));
const Builder = lazy(() => import("./pages/Builder").then((m) => ({ default: m.Builder })));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy })));
const AboutUs = lazy(() => import("./pages/AboutUs").then((m) => ({ default: m.AboutUs })));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions").then((m) => ({ default: m.TermsAndConditions })));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy").then((m) => ({ default: m.RefundPolicy })));
const Disclaimer = lazy(() => import("./pages/Disclaimer").then((m) => ({ default: m.Disclaimer })));
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
  const prefersReducedMotion = useReducedMotion();
  const routeOrder = useMemo(
    () =>
      [
        "/",
        "/hero",
        "/home",
        "/calculators",
        "/pricing",
        "/checkout",
        "/chat",
        "/dashboard",
        "/compliance",
        "/builder",
        "/consult",
        "/profile",
        "/privacy-policy",
        "/about-us",
        "/terms-and-conditions",
        "/refund-policy",
        "/disclaimer",
      ],
    []
  );
  const getRouteIndex = (pathname: string) => {
    const normalized = pathname.toLowerCase();
    const index = routeOrder.indexOf(normalized);
    return index >= 0 ? index : routeOrder.length;
  };
  const previousRouteIndexRef = useRef(getRouteIndex(location.pathname));
  const currentRouteIndex = getRouteIndex(location.pathname);
  const direction = currentRouteIndex >= previousRouteIndexRef.current ? 1 : -1;

  useEffect(() => {
    previousRouteIndexRef.current = currentRouteIndex;
  }, [currentRouteIndex]);

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
    const message = sessionStorage.getItem("subscription_popup");
    if (!message) return;

    setSuccessPopup(message);
    sessionStorage.removeItem("subscription_popup");

    const timeout = window.setTimeout(() => {
      setSuccessPopup(null);
    }, 2200);

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

  const hasSiteHeader = location.pathname !== "/";

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
      {hasSiteHeader && (
        <Header onLogin={() => setShowLoginModal(true)} />
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 0, x: 26 * direction, y: 8, filter: "blur(10px)", scale: 0.992 }
          }
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 1, x: 0, y: 0, filter: "blur(0px)", scale: 1 }
          }
          exit={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 0, x: -20 * direction, y: -8, filter: "blur(8px)", scale: 0.994 }
          }
          transition={{
            duration: prefersReducedMotion ? 0.01 : 0.34,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Suspense fallback={<div className="p-6 text-sm text-[#0F172A]">Loading...</div>}>
            <Routes location={location}>
              <Route path="/" element={<HeroPage />} />
              <Route path="/Hero" element={<HeroPage />} />
              <Route path="/hero" element={<HeroPage />} />
              <Route path="/home" element={withPageScaffold(<HomePage />)} />

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
              <Route path="/profile" element={withPageScaffold(<Profile />)} />
              <Route path="/chat" element={withPageScaffold(<Chat onRequireLogin={() => setShowLoginModal(true)} />)} />
              <Route path="/dashboard" element={withPageScaffold(<AdminDashboard />)} />
              <Route path="/compliance" element={withPageScaffold(<ComplianceStandards />)} />
              <Route path="/builder" element={withPageScaffold(<Builder />)} />
              <Route path="/consult" element={withPageScaffold(<Consult />)} />
              <Route path="/privacy-policy" element={withPageScaffold(<PrivacyPolicy />)} />
              <Route path="/about-us" element={withPageScaffold(<AboutUs />)} />
              <Route path="/terms-and-conditions" element={withPageScaffold(<TermsAndConditions />)} />
              <Route path="/refund-policy" element={withPageScaffold(<RefundPolicy />)} />
              <Route path="/disclaimer" element={withPageScaffold(<Disclaimer />)} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>

      <TigerBotAvatar />

      {hasSiteHeader && <Footer />}

      {showLoginModal && (
        <Suspense fallback={null}>
          <LoginModal onClose={() => setShowLoginModal(false)} />
        </Suspense>
      )}

      {successPopup && <AuthPopup message={successPopup} type="success" />}
    </div>
  );
}











