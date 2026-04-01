import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Calculator as CalcIcon, Globe, Home as HomeIcon, MessageSquare, TrendingUp } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ExpertCouncil } from "../components/ExpertCouncil";
import { Features } from "../components/Features";
import { PrivacyTrustBanner } from "../components/PrivacyTrustBanner";
import { getStoredAuthToken } from "../../utils/api";
import { renderTextWithShortForms } from "../utils/shortForms";
import { fadeUp, fadeUpSoft, PREMIUM_EASE, staggerContainer } from "../utils/motion";

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
  {
    label: "DTAA UPDATE",
    country: "India-UAE",
    type: "Treaty Compliance",
    date: "2026-02-20",
    source: "CBDT",
    confidence: "Authoritative",
    title: "DTAA filing checklist refresh for FY 2025-26",
  },
  {
    label: "INTERNATIONAL TAX ALERT",
    country: "India-Singapore",
    type: "Residency Guidance",
    date: "2026-02-12",
    source: "Gazette",
    confidence: "Validated",
    title: "Updated non-resident tax residency documentation guidance",
  },
  {
    label: "TAX TREATY UPDATE",
    country: "India-US",
    type: "Remittance Rules",
    date: "2026-01-30",
    source: "NRITAX Research",
    confidence: "Advisory",
    title: "Revised remittance compliance notes for Form 15CA/15CB",
  },
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

type StatValueConfig = {
  prefix?: string;
  suffix?: string;
  value: number;
  decimals?: number;
};

const statValueMap: Record<string, StatValueConfig> = {
  "Tax Savings": { value: 2.5, decimals: 1, suffix: "Cr+" },
  "AI Availability": { value: 24, suffix: "/7" },
  "Response Time": { value: 2, prefix: "<", suffix: " min" },
};

function AnimatedStatValue({ label, fallback }: { label: string; fallback: string }) {
  const config = statValueMap[label];
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.65 });
  const [displayValue, setDisplayValue] = useState(() => {
    if (!config) return fallback;
    const initialNumber = shouldReduceMotion ? config.value : 0;
    return `${config.prefix || ""}${initialNumber.toFixed(config.decimals ?? 0)}${config.suffix || ""}`;
  });

  useEffect(() => {
    if (!config) {
      setDisplayValue(fallback);
      return;
    }

    if (!isInView || shouldReduceMotion) {
      setDisplayValue(`${config.prefix || ""}${config.value.toFixed(config.decimals ?? 0)}${config.suffix || ""}`);
      return;
    }

    let animationFrameId = 0;
    let startTime = 0;
    const duration = 900;

    const updateValue = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = config.value * easedProgress;

      setDisplayValue(
        `${config.prefix || ""}${nextValue.toFixed(config.decimals ?? 0)}${config.suffix || ""}`
      );

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(updateValue);
      }
    };

    animationFrameId = window.requestAnimationFrame(updateValue);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [config, fallback, isInView, shouldReduceMotion]);

  return (
    <div ref={containerRef} className="mb-2 text-3xl font-bold tracking-tight text-blue-700">
      {displayValue}
    </div>
  );
}

interface HomeProps {
  onRequireLogin: () => void;
}

export function Home({ onRequireLogin }: HomeProps) {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const shouldReduceMotion = useReducedMotion();
  const heroVariants = useMemo(() => staggerContainer(0.08, 0.1), []);

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
      <section className="bg-gradient-to-b from-gray-50 to-white pt-4 pb-16 md:pt-6 md:pb-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={heroVariants}
            className="mb-12 text-center"
          >
            {userName ? (
              <motion.p variants={fadeUp} className="mb-4 text-xs font-semibold uppercase tracking-wide text-blue-600">
                WELCOME! {renderTextWithShortForms(userName)}
              </motion.p>
            ) : null}
            <motion.span
              variants={fadeUp}
              className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600"
            >
              {renderTextWithShortForms(heroContent.badge)}
            </motion.span>
            <motion.h1 variants={fadeUp} className="mb-4 mt-6 text-5xl font-bold tracking-tight text-gray-900 md:text-6xl">
              {heroContent.headline}
            </motion.h1>
            <motion.p variants={fadeUp} className="mb-4 text-lg font-normal text-slate-600">
              {renderTextWithShortForms(heroContent.subheadline)}
            </motion.p>
            <motion.p variants={fadeUp} className="mx-auto mb-8 max-w-2xl text-lg font-normal text-slate-600">
              {renderTextWithShortForms(heroContent.description)}
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <motion.button
                type="button"
                aria-label="Ask AI instantly"
                onClick={() => requireAuthFor("/chat")}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-blue-700"
                whileHover={shouldReduceMotion ? undefined : { y: -2, boxShadow: "0 18px 36px rgba(37, 99, 235, 0.24)" }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                transition={{ duration: 0.25, ease: PREMIUM_EASE }}
              >
                <MessageSquare className="mr-2 size-5" />
                Ask AI Instantly
              </motion.button>
              <motion.button
                type="button"
                aria-label="Consult a CPA"
                onClick={() => requireAuthFor("/consult")}
                className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-8 py-4 text-base font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-50"
                whileHover={shouldReduceMotion ? undefined : { y: -2, boxShadow: "0 16px 32px rgba(15, 23, 42, 0.08)" }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                transition={{ duration: 0.25, ease: PREMIUM_EASE }}
              >
                Consult a CPA
              </motion.button>
              <motion.button
                type="button"
                aria-label="View pricing"
                onClick={() => navigate("/pricing")}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-8 py-4 text-base font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100"
                whileHover={shouldReduceMotion ? undefined : { y: -2, boxShadow: "0 16px 32px rgba(15, 23, 42, 0.08)" }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                transition={{ duration: 0.25, ease: PREMIUM_EASE }}
              >
                View Pricing
              </motion.button>
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.35 }}
            variants={staggerContainer(0.12, 0.08)}
            className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {heroContent.stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeUpSoft}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { y: -4, boxShadow: "0 18px 34px rgba(15, 23, 42, 0.08)" }
                }
                transition={{ duration: 0.3, ease: PREMIUM_EASE }}
                className="rounded-xl border bg-white p-6 text-center shadow-sm"
              >
                <AnimatedStatValue label={stat.label} fallback={stat.value} />
                <div className="text-sm font-normal text-slate-600">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      <section id="features">
        <Features />
      </section>

      <section className="bg-gradient-to-b from-gray-50 to-white pt-10 pb-5 md:pt-14 md:pb-8">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <section id="tax-updates">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.35 }}
              variants={fadeUp}
              className="mb-4 text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Regulatory Intelligence
              </p>
              <h3 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Tax Updates</h3>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer(0.08, 0.08)}
              className="grid gap-4 md:grid-cols-3"
            >
              {taxUpdates.map((item) => (
                <motion.article
                  key={item.date + item.title}
                  variants={fadeUpSoft}
                  whileHover={
                    shouldReduceMotion
                      ? undefined
                      : { y: -5, boxShadow: "0 24px 42px rgba(15, 23, 42, 0.10)" }
                  }
                  transition={{ duration: 0.28, ease: PREMIUM_EASE }}
                  className="rounded-2xl border border-slate-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,250,0.98))] p-5 text-left shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
                >
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-sm border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                      {item.label}
                    </span>
                    <span className="rounded-sm bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                      {item.country}
                    </span>
                    <span className="rounded-sm border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-slate-900">
                    {renderTextWithShortForms(item.title)}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-normal text-slate-500">
                      <Globe className="size-3.5" />
                      {item.date}
                    </span>
                    <span className="rounded-sm bg-slate-100 px-2 py-1 font-semibold uppercase tracking-[0.12em] text-slate-700">
                      Source: {item.source}
                    </span>
                    <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold uppercase tracking-[0.12em] text-emerald-700">
                      {item.confidence}
                    </span>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          </section>

          <div className="mt-10">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              variants={fadeUp}
              className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-blue-600"
            >
              Smart Shortcuts
            </motion.p>
            <motion.h3
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              variants={fadeUp}
              className="mb-8 text-center text-3xl font-bold tracking-tight text-gray-900 md:text-4xl"
            >
              Quick Access by Scenario
            </motion.h3>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer(0.08, 0.08)}
              className="grid grid-cols-2 gap-4 lg:grid-cols-4"
            >
              {scenarioCards.map((scenario) => {
                const Icon = scenario.icon;
                return (
                  <motion.button
                    type="button"
                    key={scenario.title}
                    onClick={() => requireAuthFor("/chat", { starterMessage: scenario.message })}
                    variants={fadeUpSoft}
                    whileHover={
                      shouldReduceMotion
                        ? undefined
                        : { y: -4, scale: 1.01, boxShadow: "0 18px 32px rgba(15, 23, 42, 0.10)" }
                    }
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                    transition={{ duration: 0.25, ease: PREMIUM_EASE }}
                    className={`${scenario.color} rounded-xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg`}
                    aria-label={scenario.title}
                  >
                    <motion.div whileHover={shouldReduceMotion ? undefined : { scale: 1.06 }} transition={{ duration: 0.2 }}>
                      <Icon className="mb-3 size-8" />
                    </motion.div>
                    <h4 className="mb-1 text-lg font-semibold">{scenario.title}</h4>
                    <p className="text-sm font-normal leading-7 opacity-80">{renderTextWithShortForms(scenario.subtitle)}</p>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>

          <div className="mt-8">
            <PrivacyTrustBanner />
          </div>
        </div>
      </section>

      <ExpertCouncil />
    </main>
  );
}
