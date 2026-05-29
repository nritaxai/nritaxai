import { Capacitor } from "@capacitor/core";
import {
  Bot,
  BriefcaseBusiness,
  Calculator,
  CircleDollarSign,
  Menu,
  Newspaper,
  Search,
  UserCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getStoredAuthToken } from "../utils/api";
import { AndroidDecorBackground, ANDROID_THEME } from "./androidTheme";

type AndroidHomePageProps = {
  onRequireLogin: () => void;
};

type QuickAction = {
  title: string;
  subtitle: string;
  icon: typeof Bot;
  to: string;
  requiresAuth?: boolean;
  tint: string;
};

type StatItem = {
  label: string;
  value: string;
};

type TaxUpdateItem = {
  label: string;
  title: string;
  source: string;
};

const quickActions: QuickAction[] = [
  { title: "AI Chat", subtitle: "Ask Yukti", icon: Bot, to: "/chat", requiresAuth: true, tint: "rgba(66,133,244,0.3)" },
  { title: "Consult a CPA", subtitle: "Expert support", icon: UserCheck, to: "/consult", requiresAuth: true, tint: "rgba(52,168,83,0.3)" },
  { title: "Calculate", subtitle: "Tax estimators", icon: Calculator, to: "/calculators", tint: "rgba(251,188,4,0.25)" },
  { title: "Tax Updates", subtitle: "Latest guidance", icon: Newspaper, to: "#android-tax-updates", tint: "rgba(66,133,244,0.22)" },
  { title: "Join Expert", subtitle: "Advisor onboarding", icon: BriefcaseBusiness, to: "/join-as-expert", tint: "rgba(255,255,255,0.15)" },
  { title: "Pricing", subtitle: "Plans & access", icon: CircleDollarSign, to: "/pricing", tint: "rgba(255,255,255,0.15)" },
];

const stats: StatItem[] = [
  { label: "Savings guided", value: "₹3.8L" },
  { label: "Questions", value: "24" },
  { label: "Availability", value: "24/7" },
  { label: "Languages", value: "4" },
];

const taxUpdates: TaxUpdateItem[] = [
  { label: "DTAA UPDATE", title: "DTAA filing checklist refresh for FY 2025-26", source: "CBDT" },
  { label: "TAX ALERT", title: "Updated NRI tax residency documentation guidance", source: "Gazette" },
  { label: "REMITTANCE", title: "Revised notes for Form 15CA and 15CB compliance", source: "NRITAX Research" },
];

// Android only
export function AndroidHomePage({ onRequireLogin }: AndroidHomePageProps) {
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");

  const firstName = useMemo(() => {
    const parts = userName.trim().split(/\s+/);
    return parts[0] || "Demo";
  }, [userName]);

  useEffect(() => {
    const syncUser = () => {
      try {
        const rawUser = localStorage.getItem("user");
        const parsedUser = rawUser ? JSON.parse(rawUser) : null;
        setUserName(typeof parsedUser?.name === "string" ? parsedUser.name.trim() : "");
      } catch {
        setUserName("");
      }
    };

    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("auth-changed", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("auth-changed", syncUser);
    };
  }, []);

  if (!isAndroidNative) {
    return null;
  }

  const handleNavigate = (path: string, requiresAuth = false) => {
    if (path === "#android-tax-updates") {
      document.getElementById("android-tax-updates")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (requiresAuth && !getStoredAuthToken()) {
      onRequireLogin();
      return;
    }

    navigate(path);
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: ANDROID_THEME.background,
        color: ANDROID_THEME.primaryText,
        fontFamily: ANDROID_THEME.fontFamily,
        position: "relative",
        overflow: "visible",
        touchAction: "pan-y",
      }}
    >
      <AndroidDecorBackground />

      <div style={{ position: "relative", zIndex: 2 }}>
        <section
          style={{
            position: "sticky",
            top: 0,
            zIndex: 9999,
            padding: "12px 14px",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
            background: "rgba(255,255,255,0.08)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "12px",
                }}
              >
                {userName ? userName.charAt(0).toUpperCase() : <UserRound size={16} />}
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 800, color: ANDROID_THEME.primaryText }}>
                  NRITAX.AI
                </div>
                <div style={{ fontSize: "11px", color: ANDROID_THEME.secondaryText }}>
                  Good morning, {firstName}
                </div>
              </div>
            </div>

            <button
              type="button"
              aria-label="Open profile"
              onClick={() => handleNavigate("/profile", true)}
              style={{ background: "transparent", border: 0, color: ANDROID_THEME.primaryText }}
            >
              <Menu size={20} />
            </button>
          </div>
        </section>

        <div style={{ padding: "12px 14px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "10px",
              color: ANDROID_THEME.primaryText,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Search size={14} color={ANDROID_THEME.secondaryText} />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
              Search tax questions, tools, or reports
            </span>
          </div>

          <div style={{ marginTop: "18px", fontSize: "13px", fontWeight: 700, color: ANDROID_THEME.primaryText }}>
            What can we help with?
          </div>

          <div
            style={{
              marginTop: "10px",
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "8px",
            }}
          >
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleNavigate(item.to, item.requiresAuth)}
                  style={{
                    background: ANDROID_THEME.cardBackground,
                    border: ANDROID_THEME.cardBorder,
                    borderRadius: ANDROID_THEME.cardRadius,
                    padding: "10px 12px",
                    textAlign: "left",
                    minHeight: "88px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: item.tint,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: ANDROID_THEME.primaryText,
                    }}
                  >
                    <Icon size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: ANDROID_THEME.primaryText }}>
                      {item.title}
                    </div>
                    <div style={{ marginTop: "4px", fontSize: "9px", color: "rgba(255,255,255,0.55)" }}>
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginTop: "14px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "14px",
              padding: "12px 10px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "8px",
              }}
            >
              {stats.map((item) => (
                <div key={item.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: ANDROID_THEME.accent }}>
                    {item.label === "Savings guided" ? "Rs 3.8L" : item.value}
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "8px", color: "rgba(255,255,255,0.55)" }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            id="android-tax-updates"
            style={{ marginTop: "10px", fontSize: "13px", fontWeight: 700, color: ANDROID_THEME.primaryText }}
          >
            Tax Updates
          </div>

          <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
            {taxUpdates.map((item) => (
              <article
                key={item.label + item.title}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "14px",
                  padding: "12px",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    padding: "4px 8px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.14)",
                    color: ANDROID_THEME.primaryText,
                    fontSize: "8px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  {item.label}
                </span>
                <div style={{ marginTop: "8px", fontSize: "11px", fontWeight: 700, lineHeight: 1.4 }}>
                  {item.title}
                </div>
                <div style={{ marginTop: "6px", fontSize: "9px", color: ANDROID_THEME.secondaryText }}>
                  Source: {item.source}
                </div>
              </article>
            ))}
          </div>

          <footer
            style={{
              marginTop: "20px",
              padding: "16px 14px",
              paddingTop: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              background: "rgba(255,255,255,0.15)",
              borderTop: "1px solid rgba(255,255,255,0.2)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: ANDROID_THEME.primaryText }}>
                  NRITAX.AI
                </div>
                <div style={{ marginTop: "2px", fontSize: "9px", color: ANDROID_THEME.secondaryText }}>
                  Billion Dollar Technologies Pvt Ltd
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => handleNavigate("/profile", true)}
                  style={{ background: "transparent", border: 0, color: ANDROID_THEME.primaryText }}
                >
                  <UserRound size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("/chat", true)}
                  style={{ background: "transparent", border: 0, color: ANDROID_THEME.primaryText }}
                >
                  <Bot size={16} />
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

export default AndroidHomePage;
