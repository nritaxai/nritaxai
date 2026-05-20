import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Bot, ChartPie, Calculator, UserCheck, Briefcase, Globe2, Newspaper, ShieldCheck } from "lucide-react";
import { IS_IOS_NATIVE_APP } from "../config/appConfig";

export function iOSHomePage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Guest");

  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        if (parsed?.name) setUserName(parsed.name.split(" ")[0]);
      } catch {
        setUserName("Guest");
      }
    }
  }, []);

  if (!IS_IOS_NATIVE_APP) return null;

  const triggerHaptic = () => {
    if (!Capacitor.isNativePlatform()) return;
    navigator.vibrate?.(10);
  };

  const cards = [
    { label: "AI Chat", icon: Bot, action: () => navigate("/chat"), color: "#E8EEFF" },
    { label: "Reports", icon: ChartPie, action: () => navigate("/profile"), color: "#F5F7FF" },
    { label: "Consult", icon: UserCheck, action: () => navigate("/consult"), color: "#EFF4FF" },
    { label: "Calculate", icon: Calculator, action: () => navigate("/calculators"), color: "#EEF2FF" },
    { label: "Tax Updates", icon: Newspaper, action: () => document.getElementById("ios-tax-updates")?.scrollIntoView({ behavior: "smooth" }), color: "#F0F9FF" },
    { label: "Join Expert", icon: Briefcase, action: () => navigate("/join-as-expert"), color: "#F8FAFC" },
  ];

  const featureCards = [
    { title: "AI-Powered Assistance", description: "Instant answers for DTAA, NRI filing, residency, and remittance questions.", icon: Bot },
    { title: "Expert CPA Support", description: "Connect with specialists for personalized planning and compliance.", icon: UserCheck },
    { title: "Multi-Language Support", description: "Use English, Hindi, Tamil, and Indonesian for tax guidance.", icon: Globe2 },
    { title: "Compliance Protection", description: "Track key filings, documents, and cross-border tax obligations.", icon: ShieldCheck },
  ];

  const taxUpdates = [
    { label: "DTAA UPDATE", title: "DTAA filing checklist refresh for FY 2025-26", source: "CBDT" },
    { label: "INTERNATIONAL TAX ALERT", title: "Updated NRI tax residency documentation guidance", source: "Gazette" },
    { label: "TAX TREATY UPDATE", title: "Revised remittance notes for Form 15CA/15CB", source: "NRITAX Research" },
  ];

  const stats = useMemo(
    () => [
      { label: "Tax Questions", value: "24", description: "Answered" },
      { label: "Savings", value: "₹3.8L", description: "Projected" },
    ],
    [],
  );

  return (
    <main
      style={{
        minHeight: "100dvh",
        paddingTop: "calc(44px + env(safe-area-inset-top))",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom))",
        backgroundColor: "#f2f2f7",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <p style={{ margin: 0, color: "#3b3b3b", fontSize: 20, fontWeight: 600 }}>Good morning, {userName}! 👋</p>
            <h1 style={{ margin: "8px 0 0", fontSize: 32, lineHeight: 1.05, fontWeight: 700, color: "#0f172a", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', sans-serif" }}>
              Your AI Tax Assistant
            </h1>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    card.action();
                  }}
                  style={{
                    width: "100%",
                    borderRadius: 20,
                    border: "none",
                    padding: "18px",
                    backgroundColor: "white",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <Icon style={{ width: 24, height: 24, color: "#1a3cff" }} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{card.label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {stats.map((item) => (
              <div
                key={item.label}
                style={{
                  backgroundColor: "white",
                  borderRadius: 20,
                  padding: "18px 20px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                }}
              >
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: 0.08, color: "#6b7280" }}>{item.label}</p>
                <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 700, color: "#0f172a" }}>{item.value}</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>{item.description}</p>
              </div>
            ))}
          </div>

          <section style={{ display: "grid", gap: 14 }}>
            <div>
              <p style={{ margin: 0, color: "#2563eb", fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}>Why NRITAX</p>
              <h2 style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 24, lineHeight: 1.15, fontWeight: 800 }}>Core features</h2>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {featureCards.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    style={{
                      borderRadius: 20,
                      backgroundColor: "white",
                      padding: 18,
                      boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                      display: "grid",
                      gridTemplateColumns: "40px minmax(0, 1fr)",
                      gap: 14,
                      alignItems: "start",
                    }}
                  >
                    <span style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "#e8eeff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon style={{ width: 22, height: 22, color: "#1a3cff" }} />
                    </span>
                    <span>
                      <strong style={{ display: "block", color: "#0f172a", fontSize: 16 }}>{feature.title}</strong>
                      <span style={{ display: "block", marginTop: 6, color: "#64748b", fontSize: 14, lineHeight: 1.45 }}>{feature.description}</span>
                    </span>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="ios-tax-updates" style={{ display: "grid", gap: 14 }}>
            <div>
              <p style={{ margin: 0, color: "#2563eb", fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}>Regulatory Intelligence</p>
              <h2 style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 24, lineHeight: 1.15, fontWeight: 800 }}>Tax Updates</h2>
            </div>
            {taxUpdates.map((update) => (
              <article
                key={update.title}
                style={{
                  borderRadius: 20,
                  backgroundColor: "white",
                  padding: 18,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                }}
              >
                <span style={{ display: "inline-flex", borderRadius: 8, backgroundColor: "#0f172a", color: "white", padding: "4px 8px", fontSize: 10, fontWeight: 800, letterSpacing: 0.6 }}>
                  {update.label}
                </span>
                <p style={{ margin: "12px 0 0", color: "#0f172a", fontSize: 16, lineHeight: 1.35, fontWeight: 700 }}>{update.title}</p>
                <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>Source: {update.source}</p>
              </article>
            ))}
          </section>

          <button
            type="button"
            onClick={() => navigate("/join-as-expert")}
            style={{
              minHeight: 58,
              border: "none",
              borderRadius: 20,
              backgroundColor: "#0f172a",
              color: "white",
              fontSize: 16,
              fontWeight: 800,
              boxShadow: "0 8px 22px rgba(0,0,0,0.16)",
              cursor: "pointer",
            }}
          >
            Join as an Expert
          </button>
        </div>
      </div>
    </main>
  );
}
