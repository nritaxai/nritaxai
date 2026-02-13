import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { TaxUpdates } from "./components/TaxUpdates";
import { ComplianceStandards } from "./components/ComplianceStandards";
import { Footer } from "./components/Footer";
import { AIChat } from "./components/AIChat";
import { CPAContact } from "./components/CPAContact";
import { LoginModal } from "./components/LoginModal";
import { Calculators } from "./pages/Calculators";

export default function App() {
  const [showCPAContact, setShowCPAContact] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const location = useLocation();

  useEffect(() => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "auto",
  });
}, [location.pathname]);

  useEffect(() => {
  if (location.pathname === "/" && location.hash) {
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
    <div className="min-h-screen bg-white">
      <Header
        onAskAI={scrollToAIChat}
        onLogin={() => setShowLoginModal(true)}
      />

      <Routes>
        {/* Landing Page */}
        <Route
          path="/"
          element={
            <main>
              <Hero
                onAskAI={scrollToAIChat}
                onContactCPA={() => setShowCPAContact(true)}
              />

              <section id="features">
                <Features />
              </section>

              <section id="updates">
                <TaxUpdates />
              </section>

              <section id="ai-chat">
                <AIChat />
              </section>

              <section id="compliance">
                <ComplianceStandards />
              </section>
            </main>
          }
        />

        {/* Calculator Page */}
        <Route path="/calculators" element={<Calculators />} />
      </Routes>

      <Footer />

      {showCPAContact && (
        <CPAContact onClose={() => setShowCPAContact(false)} />
      )}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}
    </div>
  );
}
