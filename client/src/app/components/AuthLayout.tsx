import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex w-full max-w-[460px] flex-col items-center"
    >
      <div className="mb-6 w-full text-center sm:mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
          <ShieldCheck className="size-4 text-[#1d4ed8]" />
          NRITAX.AI
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
          Global tax intelligence platform for NRIs.
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-[15px]">
          Secure sign in and compliant account setup for global tax guidance, subscriptions, and expert workflows.
        </p>
      </div>

      <div className="w-full">{children}</div>
    </motion.div>
  );
}
