import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Calculator as CalcIcon,
  Globe,
  Home as HomeIcon,
  Landmark,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ExpertCouncil } from "../components/ExpertCouncil";
import { Features } from "../components/Features";
import { PrivacyTrustBanner } from "../components/PrivacyTrustBanner";
import { getStoredAuthToken } from "../../utils/api";
import { renderTextWithShortForms } from "../utils/shortForms";
import { fadeUp, fadeUpSoft, PREMIUM_EASE, staggerContainer } from "../utils/motion";
import AndroidHomePage from "../../components/AndroidHomePage";

const heroContent = {
  badge: "Enterprise NRI tax intelligence",
  headline: "AI-Powered Tax Platform for NRIs",
  subheadline:
    "Get instant DTAA guidance, FEMA support, capital gains analysis, and global tax answers in under 2 minutes.",
  description:
    "Built for globally mobile Indians who need faster cross-border tax clarity, compliance confidence, and a trusted path from AI guidance to CPA review.",
  stats: [
    { value: "2.5Cr+", label: "Tax Calculations" },
    { value: "24/7", label: "AI Assistance" },
    { value: "<2 min", label: "Responses" },
    { value: "Global", label: "NRI Coverage" },
  ],
};

const trustIndicators = [
  { icon: Globe, label: "DTAA Intelligence" },
  { icon: ShieldCheck, label: "FEMA Compliant" },
  { icon: BadgeCheck, label: "AI + CPA Assisted" },
  { icon: Landmark, label: "Multi-Country Tax Support" },
];

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
    color:
      "border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96))] text-slate-900 hover:border-blue-200",
  },
  {
    icon: TrendingUp,
    title: "Stock Investments",
    subtitle: "Equity taxation guidance",
    message: "Explain taxation rules for NRI stock and equity investments in India.",
    color:
      "border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.95))] text-slate-900 hover:border-cyan-200",
  },
  {
    icon: Briefcase,
    title: "Salary and Employment",
    subtitle: "Cross-border income",
    message: "How is cross-border salary income taxed for NRIs working abroad?",
    color:
      "border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,253,250,0.95))] text-slate-900 hover:border-emerald-200",
  },
  {
    icon: CalcIcon,
    title: "Business Income",
    subtitle: "PE and transfer pricing",
    message: "Explain permanent establishment and transfer pricing rules for NRI business income.",
    color:
      "border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] text-slate-900 hover:border-violet-200",
  },
];

type StatValueConfig = {
  prefix?: string;
  suffix?: string;
  value: number;
  decimals?: number;
};

const statValueMap: Record<string, StatValueConfig> = {
  "Tax Calculations": { value: 2.5, decimals: 1, suffix: "Cr+" },
  "AI Assistance": { value: 24, suffix: "/7" },
  Responses: { value: 2, prefix: "<", suffix: " min" },
  "NRI Coverage": { value: 120, suffix: "+ countries" },
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
    <div ref={containerRef} className="mb-2 text-3xl font-extrabold tracking-tight text-slate-950">
      {displayValue}
    </div>
  );
}

interface HomeProps {
  onRequireLogin: () => void;
}

export function Home({ onRequireLogin }: HomeProps) {
  const isNative = Capacitor.isNativePlatform();
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

  if (isNative) {
    return <AndroidHomePage onRequireLogin={onRequireLogin} />;
  }

  const requireAuthFor = (path: string, state?: Record<string, unknown>) => {
    if (!getStoredAuthToken()) {
      onRequireLogin();
      return;
    }
    navigate(path, state ? { state } : undefined);
  };

  return (
    <main className="min-h-screen overflow-hidden">
      <section className="relative isolate pb-14 pt-4 md:pb-18 md:pt-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.2),transparent_34%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_34%,#ffffff_72%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-20 -z-10 mx-auto h-80 max-w-5xl rounded-full bg-[rgba(37,99,235,0.14)] blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={heroVariants}
            className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(9,19,39,0.96),rgba(15,23,42,0.88)_45%,rgba(16,42,88,0.82))] px-6 py-10 text-left shadow-[0_30px_90px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/6 sm:px-8 md:px-10 md:py-12 lg:px-12"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(96,165,250,0.22),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.14),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0))]" />
            <div className="pointer-events-none absolute -left-16 top-10 h-44 w-44 rounded-full border border-white/10 bg-white/5 blur-2xl" />
            <div className="pointer-events-none absolute right-0 top-8 h-56 w-56 rounded-full bg-blue-400/18 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-16 h-36 w-36 rounded-full bg-cyan-300/12 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:items-center">
              <div className="max-w-3xl">
            {userName ? (
                  <motion.p variants={fadeUp} className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                WELCOME! {renderTextWithShortForms(userName)}
              </motion.p>
            ) : null}
            <motion.span
              variants={fadeUp}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100 backdrop-blur-sm"
            >
                  <Sparkles className="size-3.5 text-cyan-300" />
              {renderTextWithShortForms(heroContent.badge)}
            </motion.span>
                <motion.h1
                  variants={fadeUp}
                  className="mt-6 max-w-3xl text-4xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl"
                >
              {heroContent.headline}
            </motion.h1>
                <motion.p variants={fadeUp} className="mt-5 max-w-2xl text-lg leading-8 text-slate-100 sm:text-xl">
              {renderTextWithShortForms(heroContent.subheadline)}
            </motion.p>
                <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              {renderTextWithShortForms(heroContent.description)}
            </motion.p>

                <motion.div
                  variants={fadeUp}
                  className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center"
                >
              <motion.button
                type="button"
                aria-label="Ask AI instantly"
                onClick={() => requireAuthFor("/chat")}
                    className="inline-flex min-h-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#60a5fa,#2563eb_58%,#1d4ed8)] px-7 py-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.38)] transition-all hover:brightness-105"
                whileHover={shouldReduceMotion ? undefined : { y: -2, boxShadow: "0 24px 48px rgba(37, 99, 235, 0.34)" }}
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
                    className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/18 bg-white/10 px-7 py-4 text-base font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-all hover:bg-white/16"
                whileHover={shouldReduceMotion ? undefined : { y: -2, boxShadow: "0 16px 32px rgba(15, 23, 42, 0.08)" }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                transition={{ duration: 0.25, ease: PREMIUM_EASE }}
              >
                    <Briefcase className="mr-2 size-5" />
                Consult a CPA
              </motion.button>
              <motion.button
                type="button"
                aria-label="View pricing"
                onClick={() => navigate("/pricing")}
                    className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/14 bg-slate-950/30 px-7 py-4 text-base font-semibold text-slate-100 shadow-[0_16px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-all hover:bg-slate-950/40"
                whileHover={shouldReduceMotion ? undefined : { y: -2, boxShadow: "0 16px 32px rgba(15, 23, 42, 0.08)" }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                transition={{ duration: 0.25, ease: PREMIUM_EASE }}
              >
                    <ArrowRight className="mr-2 size-5" />
                View Pricing
              </motion.button>
            </motion.div>
                
                <motion.div
                  variants={fadeUp}
                  className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                  {trustIndicators.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-slate-100 backdrop-blur-sm"
                      >
                        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white/10 text-cyan-200">
                          <Icon className="size-4.5" />
                        </span>
                        <span className="font-medium">{item.label}</span>
                      </div>
                    );
                  })}
                </motion.div>
              </div>

              <motion.div
                variants={fadeUp}
                className="relative rounded-[1.75rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] p-4 shadow-[0_24px_50px_rgba(2,6,23,0.24)] backdrop-blur-md"
              >
                <div className="rounded-[1.35rem] border border-white/12 bg-slate-950/45 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Live Tax Copilot</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Trusted answers for cross-border decisions</h2>
                    </div>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/12 px-3 py-1 text-xs font-semibold text-emerald-200">
                      Online
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {[
                      "DTAA relief on salary, property, and equity income",
                      "FEMA-aware remittance and repatriation guidance",
                      "Capital gains logic with country-specific context",
                      "Escalation path to CPA support when human review matters",
                    ].map((point) => (
                      <div
                        key={point}
                        className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/6 px-4 py-3 text-sm leading-6 text-slate-200"
                      >
                        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/14 text-cyan-200">
                          <BadgeCheck className="size-3.5" />
                        </span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-blue-300/16 bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(14,165,233,0.12))] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">NRI property sale workflow</p>
                        <p className="mt-1 text-sm text-slate-300">AI review, DTAA check, FEMA flags, CPA escalation</p>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100">Under 2 mins</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.35 }}
            variants={staggerContainer(0.12, 0.08)}
            className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
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
                className="flex h-full min-h-[150px] flex-col justify-between rounded-[1.6rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,252,0.98))] p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="mb-4 h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,#38bdf8,#2563eb)]" />
                <AnimatedStatValue label={stat.label} fallback={stat.value} />
                <div className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="features">
        <Features />
      </section>

      <section className="bg-gradient-to-b from-[#f8fbff] to-white pb-8 pt-6 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <section id="tax-updates">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.35 }}
              variants={fadeUp}
              className="mb-6 text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                Regulatory Intelligence
              </p>
              <h3 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">Tax Updates</h3>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Monitor fast-moving treaty, residency, and remittance developments without digging through fragmented sources.
              </p>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer(0.08, 0.08)}
              className="grid auto-rows-fr gap-4 md:grid-cols-3"
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
                  className="flex h-full flex-col rounded-[1.6rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(244,247,250,0.98))] p-5 text-left shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
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
                  <p className="min-h-[84px] text-lg font-semibold leading-8 text-slate-900">
                    {renderTextWithShortForms(item.title)}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 text-xs">
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

          <div className="mt-12">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              variants={fadeUp}
              className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.24em] text-blue-700"
            >
              Smart Shortcuts
            </motion.p>
            <motion.h3
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              variants={fadeUp}
              className="mb-3 text-center text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl"
            >
              Quick Access by Scenario
            </motion.h3>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              variants={fadeUp}
              className="mx-auto mb-8 max-w-2xl text-center text-base leading-7 text-slate-600"
            >
              Jump directly into the NRI tax workflow you need most and let the platform pre-frame the right questions.
            </motion.p>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer(0.08, 0.08)}
              className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
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
                    className={`${scenario.color} group flex h-full min-h-[220px] flex-col rounded-[1.6rem] p-6 text-left shadow-[0_18px_36px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_40px_rgba(15,23,42,0.12)]`}
                    aria-label={scenario.title}
                  >
                    <motion.div whileHover={shouldReduceMotion ? undefined : { scale: 1.06 }} transition={{ duration: 0.2 }}>
                      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
                        <Icon className="size-6" />
                      </span>
                    </motion.div>
                    <h4 className="mb-1 text-lg font-semibold">{scenario.title}</h4>
                    <p className="text-sm font-normal leading-7 text-slate-600">{renderTextWithShortForms(scenario.subtitle)}</p>
                    <span className="mt-auto pt-6 text-sm font-semibold text-blue-700 transition-transform group-hover:translate-x-1">
                      Start with AI
                    </span>
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
