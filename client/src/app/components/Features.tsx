import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
  MessageSquare,
  Users,
  FileText,
  TrendingUp,
  Globe2,
  Clock
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { renderTextWithShortForms } from "../utils/shortForms";
import { fadeUp, fadeUpSoft, PREMIUM_EASE, staggerContainer } from "../utils/motion";

export function Features() {
  const shouldReduceMotion = useReducedMotion();
  const features = [
    {
      icon: MessageSquare,
      title: "Instant Global Tax Guidance",
      description: "Ask complex NRI tax questions and get fast answers grounded in DTAA rules, residency logic, remittance context, and practical next steps.",
      color: "from-[#2563eb] to-[#0f172a]"
    },
    {
      icon: Users,
      title: "AI + CPA Delivery Model",
      description: "Start with AI for speed, then escalate to certified tax professionals when filing, structuring, or high-value decisions need human review.",
      color: "from-[#0f766e] to-[#0f172a]"
    },
    {
      icon: Globe2,
      title: "Multi-Country NRI Coverage",
      description: "Support for India-linked tax questions across salary, investments, property, repatriation, and foreign income scenarios worldwide.",
      color: "from-[#0ea5e9] to-[#1d4ed8]"
    },
    {
      icon: FileText,
      title: "DTAA Intelligence",
      description: "Interpret treaty relief, tax credit treatment, and source-vs-residence rules without relying on scattered articles or generic calculators.",
      color: "from-[#1d4ed8] to-[#111827]"
    },
    {
      icon: TrendingUp,
      title: "Capital Gains Analysis",
      description: "Model property, equity, and asset-sale scenarios with clearer visibility into holding periods, exemptions, indexation, and treaty impact.",
      color: "from-[#2563eb] to-[#1e293b]"
    },
    {
      icon: Clock,
      title: "24/7 Compliance Readiness",
      description: "Stay ready for urgent documentation, filing, and remittance questions with fast response times and enterprise-grade experience design.",
      color: "from-[#0369a1] to-[#0f172a]"
    }
  ];

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-[2rem] bg-gradient-to-b from-[#2563eb]/12 to-transparent" />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
        className="mb-12 text-center"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Platform Capabilities</p>
        <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">Built for high-trust NRI tax decisions</h2>
        <p className="mx-auto max-w-3xl text-base leading-7 text-slate-600">
          The homepage now leads with what matters most: speed, cross-border depth, trustworthy compliance framing, and a clear path to expert review.
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer(0.08, 0.08)}
        className="grid auto-rows-fr gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={index}
              variants={fadeUpSoft}
              className="h-full"
            >
              <motion.div
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { y: -6, boxShadow: "0 24px 42px rgba(15, 23, 42, 0.10)" }
                }
                transition={{ duration: 0.28, ease: PREMIUM_EASE }}
                className="h-full"
              >
              <Card className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(246,248,252,0.98))] shadow-[0_20px_36px_rgba(15,23,42,0.08)] transition-all duration-300">
                <CardHeader className="pb-4">
                  <motion.div
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
                    transition={{ duration: 0.2, ease: PREMIUM_EASE }}
                    className={`mb-4 inline-flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.color} text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)]`}
                  >
                    <Icon className="size-6" />
                  </motion.div>
                  <CardTitle className="text-xl font-bold text-[#0F172A]">{renderTextWithShortForms(feature.title)}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="text-sm leading-7 text-slate-600">
                    {renderTextWithShortForms(feature.description)}
                  </CardDescription>
                </CardContent>
              </Card>
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}









