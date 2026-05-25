import { motion } from "framer-motion";
import { Building2, ShieldCheck, X } from "lucide-react";
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="w-full max-w-[560px] rounded-[30px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6 lg:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            <Building2 className="size-4 text-[#2563eb]" />
            Secure authentication
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">
              {title}
            </h1>
            <p className="max-w-md text-sm leading-6 text-slate-600 sm:text-[15px]">
              {description}
            </p>
          </div>
        </div>

        {!disableClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/15"
          >
            <X className="size-5" />
          </button>
        ) : null}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-slate-700">
        <ShieldCheck className="size-4 shrink-0 text-[#2563eb]" />
        Your existing sign-in, subscriptions, and payment access stay fully intact.
      </div>

      <div className="mt-6">{children}</div>
    </motion.div>
  );
}
