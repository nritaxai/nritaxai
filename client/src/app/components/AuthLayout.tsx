import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
  showIntro?: boolean;
};

export function AuthLayout({ children, showIntro = true }: AuthLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative flex w-full max-w-[460px] flex-col items-center"
    >
      {showIntro ? (
        <div className="mb-6 w-full text-center sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-sm backdrop-blur-xl">
          <ShieldCheck className="size-4 text-white" />
          NRITAX.AI
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-[2rem]">
            Global tax intelligence platform for NRIs.
          </h1>
          <p className="mt-2 text-sm leading-7 text-slate-200 sm:text-[15px]">
            Secure sign in and compliant account setup for global tax guidance, subscriptions, and expert workflows.
          </p>
        </div>
      ) : null}

      <div className="w-full">{children}</div>
    </motion.div>
  );
}
