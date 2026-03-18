import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Briefcase, Calculator as CalcIcon, Globe, Home as HomeIcon, MessageSquare, TrendingUp } from "lucide-react";
import { ExpertCouncil } from "../components/ExpertCouncil";
import { Features } from "../components/Features";
import { PrivacyTrustBanner } from "../components/PrivacyTrustBanner";
import { getStoredAuthToken } from "../../utils/api";
import { renderTextWithShortForms } from "../utils/shortForms";

const heroContent = {
  badge: "Trusted NRI Tax Platform",
  headline: "NRITAX.AI",
  subheadline: "AI-Powered Tax Solutions for Non-Resident Indians",
  description:
    "Navigate global tax complexities and DTAA regulations with instant AI answers in 4 languages, backed by expert guidance.",
  stats: [
    { value: "2.5Cr+", label: "Tax Savings" },
    { value: "24/7", label: "AI Availability" },
    { value: "<2 min", label: "Response Time" },
  ],
};

const taxUpdates = [
  { date: "2026-02-20", title: "DTAA filing checklist refresh for FY 2025-26" },
  { date: "2026-02-12", title: "Updated non-resident tax residency documentation guidance" },
  { date: "2026-01-30", title: "Revised remittance compliance notes for Form 15CA/15CB" },
];

const scenarioCards = [
  {
    icon: HomeIcon,
    title: "Property Sale",
    subtitle: "Capital gains and DTAA relief",
    message: "I am an NRI selling property in India. Explain capital gains tax and DTAA relief clearly.",
    color: "bg-blue-50 text-blue-700 hover:bg-blue-100",
  },
  {
    icon: TrendingUp,
    title: "Stock Investments",
    subtitle: "Equity taxation guidance",
    message: "Explain taxation rules for NRI stock and equity investments in India.",
    color: "bg-blue-50 text-blue-700 hover:bg-blue-100",
  },
  {
    icon: Briefcase,
    title: "Salary and Employment",
    subtitle: "Cross-border income",
    message: "How is cross-border salary income taxed for NRIs working abroad?",
    color: "bg-blue-50 text-blue-700 hover:bg-blue-100",
  },
  {
    icon: CalcIcon,
    title: "Business Income",
    subtitle: "PE and transfer pricing",
    message: "Explain permanent establishment and transfer pricing rules for NRI business income.",
    color: "bg-blue-50 text-blue-700 hover:bg-blue-100",
  },
];

interface HomeProps {
  onRequireLogin: () => void;
}

export function Home({ onRequireLogin }: HomeProps) {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const loadUserName = () => {
      try {
        const rawUser = localStorage.getItem("user");
        if (!rawUser) {
          setUserName("");
          return;
        }
        const parsedUser = JSON.parse(rawUser);
        setUserName(typeof parsedUser?.name === "string" ? parsedUser.name.trim() : "");
      } catch {
        setUserName("");
      }
    };

    loadUserName();
    window.addEventListener("storage", loadUserName);
    window.addEventListener("auth-changed", loadUserName);
    return () => {
      window.removeEventListener("storage", loadUserName);
      window.removeEventListener("auth-changed", loadUserName);
    };
  }, []);

  const requireAuthFor = (path: string, state?: Record<string, unknown>) => {
    if (!getStoredAuthToken()) {
      onRequireLogin();
      return;
    }
    navigate(path, state ? { state } : undefined);
  };

  return (
    <main className="min-h-screen">
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-12 text-center">
            {userName ? (
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-blue-700">
                Welcome back, {renderTextWithShortForms(userName)}
              </p>
            ) : null}
            <span className="reveal-drop rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">{renderTextWithShortForms(heroContent.badge)}</span>
            <h1 className="reveal-drop reveal-delay-1 mb-4 mt-6 text-4xl font-bold text-gray-900 md:text-5xl">{heroContent.headline}</h1>
            <p className="reveal-drop reveal-delay-2 mb-6 text-2xl font-semibold text-blue-700">{renderTextWithShortForms(heroContent.subheadline)}</p>
            <p className="reveal-drop reveal-delay-3 mx-auto mb-8 max-w-2xl text-lg text-gray-600">{renderTextWithShortForms(heroContent.description)}</p>
            <div className="reveal-drop reveal-delay-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                aria-label="Ask AI instantly"
                onClick={() => requireAuthFor("/chat")}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-blue-700"
              >
                <MessageSquare className="mr-2 size-5" />
                Ask AI Instantly
              </button>
              <button
                type="button"
                aria-label="Consult a CPA"
                onClick={() => requireAuthFor("/consult")}
                className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-8 py-4 text-lg font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-50"
              >
                Consult a CPA
              </button>
              <button
                type="button"
                aria-label="View pricing"
                onClick={() => navigate("/pricing")}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-8 py-4 text-lg font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100"
              >
                View Pricing
              </button>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {heroContent.stats.map((stat, index) => (
              <div
                key={stat.label}
                className="reveal-tile rounded-xl border bg-white p-6 text-center shadow-sm"
                style={{ ["--reveal-delay" as any]: `${160 + index * 90}ms` }}
              >
                <div className="mb-2 text-3xl font-bold text-blue-700">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>

          <section id="tax-updates" className="mt-14">
            <h3 className="mb-5 text-center text-2xl font-bold text-gray-900">Tax Updates</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {taxUpdates.map((item, index) => (
                <article
                  key={item.date + item.title}
                  className="reveal-tile rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  style={{ ["--reveal-delay" as any]: `${140 + index * 100}ms` }}
                >
                  <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-blue-700">
                    <Globe className="size-3.5" />
                    {item.date}
                  </div>
                  <p className="text-sm text-gray-700">{renderTextWithShortForms(item.title)}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="mt-16">
            <h3 className="mb-8 text-center text-2xl font-bold text-gray-900">Quick Access by Scenario</h3>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {scenarioCards.map((scenario, index) => {
                const Icon = scenario.icon;
                return (
                  <button
                    type="button"
                    key={scenario.title}
                    onClick={() => requireAuthFor("/chat", { starterMessage: scenario.message })}
                    className={`reveal-tile ${scenario.color} rounded-xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg`}
                    style={{ ["--reveal-delay" as any]: `${180 + index * 90}ms` }}
                    aria-label={scenario.title}
                  >
                    <Icon className="mb-3 size-8" />
                    <h4 className="mb-1 text-lg font-semibold">{scenario.title}</h4>
                    <p className="text-sm opacity-80">{renderTextWithShortForms(scenario.subtitle)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-16">
            <PrivacyTrustBanner />
          </div>
        </div>
      </section>

      <section id="features">
        <Features />
      </section>
      <ExpertCouncil />
    </main>
  );
}
