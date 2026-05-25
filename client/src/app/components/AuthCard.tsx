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
      className="w-full max-w-[440px] rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="max-w-md text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>

        {!disableClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/15"
          >
            <X className="size-5" />
          </button>
        ) : null}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
        <ShieldCheck className="size-4 shrink-0 text-[#1d4ed8]" />
        Your existing sign-in, subscriptions, and payment access stay fully intact.
      </div>

      <div className="mt-6">{children}</div>
    </motion.div>
  );
}
