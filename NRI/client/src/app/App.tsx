import { lazy, Suspense, useState, useEffect, useMemo, useRef } from "react";
import { Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { WifiOff } from "lucide-react";

import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { TaxUpdates } from "./components/TaxUpdates";
import { ComplianceStandards } from "./components/ComplianceStandards";
import { Footer } from "./components/Footer";
const AIChat = lazy(() => import("./components/AIChat").then((m) => ({ default: m.AIChat })));
const CPAContact = lazy(() => import("./components/CPAContact").then((m) => ({ default: m.CPAContact })));
const LoginModal = lazy(() => import("./components/LoginModal").then((m) => ({ default: m.LoginModal })));
const Calculators = lazy(() => import("./pages/Calculators").then((m) => ({ default: m.Calculators })));
const Pricing = lazy(() => import("./pages/Pricing").then((m) => ({ default: m.Pricing })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Profile = lazy(() => import("./pages/Profile").then((m) => ({ default: m.Profile })));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const Chat = lazy(() => import("./pages/Chat").then((m) => ({ default: m.Chat })));
const Consult = lazy(() => import("./pages/Consult").then((m) => ({ default: m.Consult })));
const HeroPage = lazy(() => import("./pages/HeroPage").then((m) => ({ default: m.HeroPage })));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy })));

export default function App() {
  const [showCPAContact, setShowCPAContact] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const routeOrder = useMemo(
    () => ["/", "/hero", "/privacy", "/home", "/calculators", "/pricing", "/checkout", "/chat", "/consult", "/profile"],
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
  const normalizedPath = location.pathname.toLowerCase();
  const hasAcceptedPrivacy =
    typeof window !== "undefined" && window.localStorage.getItem("privacyPolicyAccepted") === "true";
  const isPublicRoute = normalizedPath === "/" || normalizedPath === "/hero" || normalizedPath === "/privacy";

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

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [location.pathname]);

  // Handle hash scrolling on home page
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

  const scrollToAIChat = () => {
    const element = document.getElementById("ai-chat");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="app-shell bg-white">
      {!isOnline && (
        <div className="sticky top-0 z-[60] bg-red-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-2 text-sm flex items-center gap-2">
            <WifiOff className="size-4" />
            You are offline. Some features may not work until your connection is restored.
          </div>
        </div>
      )}
      {!isPublicRoute && (
        <Header
          onAskAI={scrollToAIChat}
          onLogin={() => setShowLoginModal(true)}
        />
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
          <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading...</div>}>
            <Routes location={location}>
              <Route path="/" element={<HeroPage />} />
              <Route path="/Hero" element={<HeroPage />} />
              <Route path="/hero" element={<HeroPage />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route
                path="/home"
                element={
                  hasAcceptedPrivacy ? (
                    <main>
                      <Hero
                        onAskAI={scrollToAIChat}
                        onContactCPA={() => setShowCPAContact(true)}
                      />

                      <section id="features" className="bg-slate-50">
                        <Features />
                      </section>

                      <section id="updates" className="bg-gradient-to-b from-slate-50 to-white">
                        <TaxUpdates />
                      </section>

                      <section id="ai-chat" className="bg-white">
                        <AIChat onRequireLogin={() => setShowLoginModal(true)} />
                      </section>

                      <section id="compliance" className="bg-slate-50">
                        <ComplianceStandards />
                      </section>
                    </main>
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />

              <Route
                path="/calculators"
                element={
                  hasAcceptedPrivacy ? (
                    <Calculators onRequireLogin={() => setShowLoginModal(true)} />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route path="/pricing" element={hasAcceptedPrivacy ? <Pricing /> : <Navigate to="/" replace />} />
              <Route path="/Pricing" element={hasAcceptedPrivacy ? <Pricing /> : <Navigate to="/" replace />} />
              <Route
                path="/checkout"
                element={
                  hasAcceptedPrivacy ? (
                    <CheckoutPage onRequireLogin={() => setShowLoginModal(true)} />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route path="/login" element={hasAcceptedPrivacy ? <Login /> : <Navigate to="/" replace />} />
              <Route path="/profile" element={hasAcceptedPrivacy ? <Profile /> : <Navigate to="/" replace />} />
              <Route
                path="/chat"
                element={
                  hasAcceptedPrivacy ? (
                    <Chat onRequireLogin={() => setShowLoginModal(true)} />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route path="/consult" element={hasAcceptedPrivacy ? <Consult /> : <Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>

      {!isPublicRoute && <Footer />}

      {showCPAContact && (
        <Suspense fallback={null}>
          <CPAContact onClose={() => setShowCPAContact(false)} />
        </Suspense>
      )}

      {showLoginModal && (
        <Suspense fallback={null}>
          <LoginModal onClose={() => setShowLoginModal(false)} />
        </Suspense>
      )}
    </div>
  );
}
