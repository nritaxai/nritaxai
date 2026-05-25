import { motion } from "framer-motion";
import {
  BadgeCheck,
  FileCheck2,
  Globe2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

const trustItems = [
  {
    icon: Globe2,
    title: "Country-aware tax intelligence",
    description: "Guidance aligned to your residence, DTAA context, and filing path.",
  },
  {
    icon: Sparkles,
    title: "AI-powered NRI tax assistant",
    description: "Ask questions, review obligations, and move faster with confident next steps.",
  },
  {
    icon: FileCheck2,
    title: "Expert onboarding workflows",
    description: "Structured intake and follow-up designed for global NRI compliance journeys.",
  },
];

type AuthLayoutProps = {
  children: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="relative w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/60 bg-white/72 shadow-[0_32px_120px_rgba(15,23,42,0.22)] backdrop-blur-xl"
    >
      <div className="grid min-h-[720px] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_42%),linear-gradient(180deg,#0f172a_0%,#12213f_48%,#10254d_100%)] p-10 text-white lg:flex lg:flex-col">
          <div className="absolute inset-0">
            <div className="absolute left-[-12%] top-[-8%] h-48 w-48 rounded-full bg-cyan-300/12 blur-3xl" />
            <div className="absolute bottom-[-8%] right-[-8%] h-56 w-56 rounded-full bg-blue-400/15 blur-3xl" />
            <div className="absolute right-12 top-20 h-28 w-28 rounded-full border border-white/10 bg-white/5" />
          </div>

          <div className="relative z-10 flex h-full flex-col">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90">
              <ShieldCheck className="size-4 text-cyan-300" />
              NRITAX.AI Secure Access
            </div>

            <div className="mt-8 max-w-md space-y-5">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-200/80">
                Global NRI tax workspace
              </p>
              <h2 className="text-4xl font-semibold leading-tight">
                AI-powered tax guidance for NRIs, built to feel clear and trustworthy.
              </h2>
              <p className="text-base leading-7 text-slate-200/88">
                Manage onboarding, country-specific tax logic, DTAA questions, and expert workflows from a single premium workspace.
              </p>
            </div>

            <div className="mt-10 grid gap-4">
              {trustItems.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * index, duration: 0.28 }}
                  className="rounded-[24px] border border-white/12 bg-white/8 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-white/12 bg-white/10 p-3">
                      <item.icon className="size-5 text-cyan-200" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-sm leading-6 text-slate-200/85">{item.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="relative z-10 mt-auto flex items-center gap-3 pt-8 text-sm text-slate-200/88">
              <BadgeCheck className="size-5 text-cyan-300" />
              Trusted experience for sign-in, onboarding, and secure subscription access.
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[100dvh] flex-col bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(255,255,255,0.92)_100%)] p-4 sm:min-h-[720px] sm:p-6 lg:p-8">
          <div className="mb-6 rounded-[28px] border border-slate-200/70 bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(15,23,42,0.02))] p-5 shadow-[0_16px_40px_rgba(148,163,184,0.18)] lg:hidden">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              <ShieldCheck className="size-4 text-[#2563eb]" />
              NRITAX.AI
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
              Premium access to your NRI tax workspace.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Secure sign in, guided onboarding, and country-aware tax intelligence in one place.
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center">
            {children}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
