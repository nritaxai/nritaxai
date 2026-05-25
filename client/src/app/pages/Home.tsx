import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Calculator as CalcIcon,
  CheckCircle2,
  Clock3,
  Globe,
  Home as HomeIcon,
  Landmark,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
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
  badge: "Trusted Global NRI Tax Intelligence",
  headline: "Modern tax guidance for NRIs, built with AI and expert oversight.",
  subheadline:
    "Navigate DTAA, remittance rules, property sales, and compliance from one premium tax-tech workspace.",
  description:
    "NRITAX.AI combines fast AI guidance, country-aware tax intelligence, and expert-assisted workflows so global NRIs can act with more clarity and less friction.",
  stats: [
    { value: "28+", label: "Countries Covered" },
    { value: "95+", label: "DTAA Scenarios" },
    { value: "<2 min", label: "Average AI Response" },
  ],
};

const platformStats = [
  {
    title: "Countries Covered",
    value: "28+",
    description: "Residence-aware guidance across major NRI corridors.",
    icon: Globe,
  },
  {
    title: "DTAA Treaties",
    value: "95+",
    description: "Treaty-aligned decision support for common filing scenarios.",
    icon: Landmark,
  },
  {
    title: "AI Response Time",
    value: "<2 min",
    description: "Fast answers designed for real-world tax and remittance questions.",
    icon: Clock3,
  },
  {
    title: "Tax Queries Solved",
    value: "12k+",
    description: "Questions answered across filings, capital gains, TDS, and compliance.",
    icon: Sparkles,
  },
];

const trustPillars = [
  "Expert-backed tax workflows",
  "Country-specific intelligence",
  "Secure and privacy-first",
  "Subscription-ready global platform",
];

const testimonials = [
  {
    name: "Aarav Menon",
    role: "Finance Lead",
    country: "Singapore",
    quote:
      "The platform gave me clearer DTAA guidance in minutes than I had pieced together over multiple calls and articles.",
  },
  {
    name: "Priya Nair",
    role: "Product Consultant",
    country: "UAE",
    quote:
      "NRITAX.AI feels structured and credible. The combination of AI responses and expert workflow support is exactly what I needed.",
  },
  {
    name: "Rahul Shah",
    role: "Investor",
    country: "United States",
    quote:
      "Property sale tax questions, remittance planning, and documentation all felt much more manageable with the guided experience.",
  },
];

const trustHighlights = [
  {
    icon: ShieldCheck,
    title: "Secure by design",
    description: "Structured account access, private workflows, and a product experience built for trust.",
  },
  {
    icon: Landmark,
    title: "Compliance-oriented",
    description: "Country, treaty, and filing context are reflected throughout the guidance experience.",
  },
  {
    icon: CheckCircle2,
    title: "Expert-backed",
    description: "AI guidance is paired with expert onboarding and premium consultation pathways when needed.",
  },
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
  },
  {
    icon: TrendingUp,
    title: "Stock Investments",
    subtitle: "Equity taxation guidance",
    message: "Explain taxation rules for NRI stock and equity investments in India.",
  },
  {
    icon: Briefcase,
    title: "Salary and Employment",
    subtitle: "Cross-border income",
    message: "How is cross-border salary income taxed for NRIs working abroad?",
  },
  {
    icon: CalcIcon,
    title: "Business Income",
    subtitle: "PE and transfer pricing",
    message: "Explain permanent establishment and transfer pricing rules for NRI business income.",
  },
];

type StatValueConfig = {
  prefix?: string;
  suffix?: string;
  value: number;
  decimals?: number;
};

const statValueMap: Record<string, StatValueConfig> = {
  "Countries Covered": { value: 28, suffix: "+" },
  "DTAA Scenarios": { value: 95, suffix: "+" },
  "Average AI Response": { value: 2, prefix: "<", suffix: " min" },
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
    <div ref={containerRef} className="text-3xl font-semibold tracking-tight text-[#0F172A]">
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
  const heroVariants = useMemo(() => staggerContainer(0.08, 0.08), []);

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
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_62%,#f8fafc_100%)]">
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="absolute right-[8%] top-24 h-48 w-48 rounded-full bg-cyan-100/50 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-18 pt-10 sm:px-6 md:pb-24 md:pt-14">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={heroVariants}
              className="max-w-2xl"
            >
              {userName ? (
                <motion.p variants={fadeUp} className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">
                  WELCOME! {renderTextWithShortForms(userName)}
                </motion.p>
              ) : null}

              <motion.span
                variants={fadeUp}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-blue-100 bg-white/90 px-8 py-3 text-[13px] font-semibold tracking-[0.28em] text-slate-800 shadow-sm backdrop-blur-sm md:text-sm"
              >
                {renderTextWithShortForms(heroContent.badge).toUpperCase()}
              </motion.span>

              <motion.h1
                variants={fadeUp}
                className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
              >
                {renderTextWithShortForms(heroContent.headline)}
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-5 max-w-2xl text-lg leading-8 text-slate-700"
              >
                {renderTextWithShortForms(heroContent.subheadline)}
              </motion.p>

              <motion.p
                variants={fadeUp}
                className="mt-4 max-w-2xl text-base leading-8 text-slate-700"
              >
                {renderTextWithShortForms(heroContent.description)}
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
              >
                <motion.button
                  type="button"
                  onClick={() => requireAuthFor("/chat")}
                  className="inline-flex min-w-[13rem] items-center justify-center rounded-xl bg-[#2563EB] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(37,99,235,0.20)] transition-colors hover:bg-[#1D4ED8]"
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  transition={{ duration: 0.22, ease: PREMIUM_EASE }}
                >
                  Start with AI
                  <ArrowRight className="ml-2 size-4" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => requireAuthFor("/consult")}
                  className="inline-flex min-w-[13rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  transition={{ duration: 0.22, ease: PREMIUM_EASE }}
                >
                  Speak to an Expert
                </motion.button>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                {trustPillars.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm"
                  >
                    <CheckCircle2 className="size-4 text-[#10B981]" />
                    {item}
                  </span>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.08)}
              className="relative"
            >
              <motion.div
                variants={fadeUpSoft}
                className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_28px_70px_rgba(15,23,42,0.10)]"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">
                      AI Tax Workspace
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-[#0F172A]">
                      Global NRI Tax Dashboard
                    </h3>
                  </div>
                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Secure
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        Residence
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">Singapore</p>
                      <p className="mt-1 text-sm text-slate-700">DTAA review active</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        Subscription
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">Professional</p>
                      <p className="mt-1 text-sm text-slate-700">AI + expert support</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-blue-50 p-2 text-[#2563EB]">
                        <MessageSquare className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          AI Tax Assistant
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          "Explain property sale capital gains treatment for an NRI resident in Singapore."
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {platformStats.slice(0, 3).map((item) => (
                      <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <item.icon className="size-5 text-[#2563EB]" />
                        <p className="mt-3 text-lg font-semibold text-slate-900">{item.value}</p>
                        <p className="mt-1 text-sm text-slate-700">{item.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={staggerContainer(0.1, 0.08)}
            className="mt-10 grid gap-4 sm:grid-cols-3"
          >
            {heroContent.stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeUpSoft}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                transition={{ duration: 0.22, ease: PREMIUM_EASE }}
                className="rounded-2xl border border-slate-200 bg-white/92 p-6 shadow-sm"
              >
                <AnimatedStatValue label={stat.label} fallback={stat.value} />
                <p className="mt-2 text-sm font-medium text-slate-700">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="mx-auto mb-10 max-w-2xl text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">
              Platform Scale
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] md:text-4xl">
              Built for global NRI tax complexity
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-700">
              Structured for modern tax-tech workflows with the speed of AI and the discipline of compliance-first product design.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer(0.08, 0.08)}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            {platformStats.map((item) => (
              <motion.article
                key={item.title}
                variants={fadeUpSoft}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                transition={{ duration: 0.22, ease: PREMIUM_EASE }}
                className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 shadow-sm"
              >
                <div className="inline-flex rounded-2xl bg-white p-3 text-[#2563EB] shadow-sm">
                  <item.icon className="size-5" />
                </div>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-[#0F172A]">{item.value}</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-700">{item.description}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="features" className="bg-[#F8FAFC] py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="mx-auto mb-10 max-w-2xl text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">
              Core Features
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] md:text-4xl">
              A premium workflow for AI-guided NRI tax decisions
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-700">
              Designed to help users move from uncertainty to action with clearer guidance, better structure, and expert pathways when needed.
            </p>
          </motion.div>
          <Features />
        </div>
      </section>

      <section id="tax-updates" className="border-y border-slate-200 bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="mx-auto mb-10 max-w-2xl text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">
              Regulatory Intelligence
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] md:text-4xl">
              Stay current on treaty, residency, and remittance updates
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-700">
              High-signal updates designed to make fast-moving NRI tax topics easier to understand and act on.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer(0.08, 0.08)}
            className="grid gap-5 lg:grid-cols-3"
          >
            {taxUpdates.map((item) => (
              <motion.article
                key={item.date + item.title}
                variants={fadeUpSoft}
                whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                transition={{ duration: 0.24, ease: PREMIUM_EASE }}
                className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                    {item.label}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {item.country}
                  </span>
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                    {item.type}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold leading-8 text-slate-900">
                  {renderTextWithShortForms(item.title)}
                </h3>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="size-3.5" />
                    {item.date}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-600">
                    Source: {item.source}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                    {item.confidence}
                  </span>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="bg-[#F8FAFC] py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="mx-auto mb-10 max-w-2xl text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">
              Smart Shortcuts
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] md:text-4xl">
              Start from the scenario that matches your need
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer(0.08, 0.08)}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {scenarioCards.map((scenario) => {
              const Icon = scenario.icon;
              return (
                <motion.button
                  type="button"
                  key={scenario.title}
                  onClick={() => requireAuthFor("/chat", { starterMessage: scenario.message })}
                  variants={fadeUpSoft}
                  whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
                  transition={{ duration: 0.22, ease: PREMIUM_EASE }}
                  className="flex h-full flex-col items-start rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                  aria-label={scenario.title}
                >
                  <div className="rounded-2xl bg-blue-50 p-3 text-[#2563EB]">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">{scenario.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {renderTextWithShortForms(scenario.subtitle)}
                  </p>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="mx-auto mb-10 max-w-2xl text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">
              Client Confidence
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] md:text-4xl">
              Designed to feel credible, structured, and practical
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer(0.08, 0.08)}
            className="grid gap-5 lg:grid-cols-3"
          >
            {testimonials.map((item) => (
              <motion.article
                key={item.name + item.country}
                variants={fadeUpSoft}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                transition={{ duration: 0.22, ease: PREMIUM_EASE }}
                className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 shadow-sm"
              >
                <div className="flex items-center gap-1 text-[#F59E0B]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="size-4 fill-current" />
                  ))}
                </div>
                <p className="mt-5 text-base leading-8 text-slate-700">"{item.quote}"</p>
                <div className="mt-6">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <span>{item.role}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>{item.country}</span>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="bg-[#F8FAFC] py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="mx-auto mb-10 max-w-2xl text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">
              Trust & Security
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] md:text-4xl">
              Built for privacy, clarity, and professional guidance
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer(0.08, 0.08)}
            className="grid gap-5 lg:grid-cols-3"
          >
            {trustHighlights.map((item) => (
              <motion.article
                key={item.title}
                variants={fadeUpSoft}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                transition={{ duration: 0.22, ease: PREMIUM_EASE }}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="inline-flex rounded-2xl bg-blue-50 p-3 text-[#2563EB]">
                  <item.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-700">{item.description}</p>
              </motion.article>
            ))}
          </motion.div>

          <div className="mt-8">
            <PrivacyTrustBanner />
          </div>
        </div>
      </section>

      <ExpertCouncil />

      <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] py-18">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.35 }}
            variants={fadeUp}
            className="rounded-[28px] border border-slate-200 bg-[#0F172A] px-6 py-10 text-center shadow-[0_28px_60px_rgba(15,23,42,0.18)] sm:px-10"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Ready to Begin
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Start with AI guidance, then bring in experts when needed
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-200">
              Create your account, explore tax guidance tailored to your country context, and move ahead with more confidence.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onRequireLogin}
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-slate-100"
              >
                Create Your Account
              </button>
              <button
                type="button"
                onClick={() => navigate("/pricing")}
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/16"
              >
                Explore Pricing
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
