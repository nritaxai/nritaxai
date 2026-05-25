import { motion } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";
import type { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
  title: string;
  description: string;
  onClose: () => void;
  disableClose?: boolean;
};

export function AuthCard({
  children,
  title,
  description,
  onClose,
  disableClose = false,
}: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="w-full max-w-[440px] rounded-[28px] border border-white/15 bg-[linear-gradient(180deg,rgba(20,67,132,0.92),rgba(11,47,98,0.96))] p-5 text-white shadow-[0_24px_60px_rgba(4,17,40,0.34)] backdrop-blur-2xl sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-white">
            {title}
          </h2>
          <p className="max-w-md text-sm leading-6 text-[rgba(233,239,247,0.82)]">
            {description}
          </p>
        </div>

        {!disableClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="inline-flex size-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.96)] text-[#172033] transition-all hover:bg-white hover:text-[#111827] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
          >
            <X className="size-5" />
          </button>
        ) : null}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.10)] px-3.5 py-3 text-sm text-[rgba(233,239,247,0.84)]">
        <ShieldCheck className="size-4 shrink-0 text-[#f4e7d7]" />
        Your existing sign-in, subscriptions, and payment access stay fully intact.
      </div>

      <div className="mt-6">{children}</div>
    </motion.div>
  );
}
