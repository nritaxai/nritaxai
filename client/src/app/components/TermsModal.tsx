import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, FileText, X } from "lucide-react";
import { Progress } from "./ui/progress";

type TermsModalProps = {
  isOpen: boolean;
  onAccept: () => void;
  onClose: () => void;
  type?: "terms" | "privacy";
};

export function TermsModal({
  isOpen,
  onAccept,
  onClose,
  type = "terms",
}: TermsModalProps) {
  const [checked, setChecked] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setChecked(false);
      setHasScrolled(false);
      setScrollProgress(0);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const checkScrollableHeight = () => {
      const element = contentRef.current;
      if (!element) return;

      if (element.scrollHeight <= element.clientHeight + 20) {
        setHasScrolled(true);
        setScrollProgress(100);
      }
    };

    const frame = window.requestAnimationFrame(checkScrollableHeight);
    window.addEventListener("resize", checkScrollableHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", checkScrollableHeight);
    };
  }, [isOpen, type]);

  const handleScroll = () => {
    const element = contentRef.current;
    if (!element) return;

    const scrollableHeight = Math.max(element.scrollHeight - element.clientHeight, 1);
    const progress = Math.min((element.scrollTop / scrollableHeight) * 100, 100);
    setScrollProgress(progress);

    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 50;
    if (nearBottom) {
      setHasScrolled(true);
    }
  };

  const handleContinue = () => {
    if (!checked) return;

    sessionStorage.setItem("termsAccepted", "true");
    sessionStorage.setItem("termsAcceptedAt", new Date().toISOString());
    onAccept();
  };

  if (!isOpen) return null;

  const title = type === "terms" ? "Terms & Conditions" : "Privacy Policy";
  const reviewHref = type === "terms" ? "/terms-and-conditions" : "/privacy-policy";

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-3 py-0 sm:items-center sm:px-4 sm:py-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="relative z-[60] flex h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.12)] sm:h-auto sm:max-h-[88vh] sm:rounded-[24px]"
        >
          <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                  <FileText className="size-4 text-[#1d4ed8]" />
                  Policy Review
                </div>
                <div>
                  <h2 id="terms-modal-title" className="text-xl font-semibold text-slate-950">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Please review this policy summary before continuing with account creation.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/15"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                <span>Reading progress</span>
                <span>{Math.round(hasScrolled ? 100 : scrollProgress)}%</span>
              </div>
              <Progress value={hasScrolled ? 100 : scrollProgress} className="h-1.5 bg-slate-100" />
            </div>
          </div>

          <div
            ref={contentRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y bg-white px-5 py-5 text-sm leading-7 text-slate-700 sm:px-6"
            tabIndex={0}
          >
            <div className="mx-auto max-w-[680px] space-y-6">
              {type === "terms" ? <TermsContent /> : <PrivacyContent />}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  {hasScrolled ? "Acknowledgment unlocked" : "Scroll near the end to continue"}
                </p>
                <a
                  href={reviewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#1d4ed8] hover:text-[#1e40af]"
                >
                  Open full policy page
                  <ArrowUpRight className="size-4" />
                </a>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!hasScrolled}
                  onChange={(event) => setChecked(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#1d4ed8] disabled:opacity-40"
                />
                <span className={`text-sm leading-6 ${hasScrolled ? "text-slate-700" : "text-slate-400"}`}>
                  I have read and agree to the {title}
                </span>
              </label>

              <button
                type="button"
                onClick={handleContinue}
                disabled={!checked}
                className="h-12 w-full rounded-xl bg-[#0f172a] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] transition-colors hover:bg-[#111827] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function TermsContent() {
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Last Updated: May 2026</p>
        <h3 className="text-lg font-semibold text-slate-950">Use of the platform</h3>
        <p>
          By using NRITAX.AI, you agree to comply with applicable tax, legal, and platform usage requirements in the jurisdictions relevant to your account.
        </p>
        <p>
          NRITAX.AI provides AI-assisted guidance and workflow support. It does not replace formal legal or tax advice where professional review is required.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-950">Account responsibility</h3>
        <p>
          You are responsible for providing accurate information during onboarding, profile completion, subscription setup, and expert-assisted workflows.
        </p>
        <p>
          Country selection, plan eligibility, and pricing may affect how tax rules, DTAA context, and support flows are applied across the product.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-950">Service access and policies</h3>
        <p>
          Subscription plans, pricing tiers, and compliance workflows may vary by country, scope, and policies in effect at the time of access.
        </p>
        <p>
          Continued use of NRITAX.AI after review constitutes acceptance of the applicable policies supporting your account experience.
        </p>
      </section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Last Updated: May 2026</p>
        <h3 className="text-lg font-semibold text-slate-950">Information we collect</h3>
        <p>
          NRITAX.AI securely handles account information, tax-related metadata, onboarding details, and service usage signals needed to operate the platform.
        </p>
        <p>
          This may include identity details, country context, subscription state, workflow inputs, and support interactions.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-950">How information is used</h3>
        <p>
          Data may be processed to improve tax guidance, AI responses, onboarding experience, subscription handling, and country-specific product flows.
        </p>
        <p>
          Your information is protected using secure authentication, access controls, and infrastructure practices designed for confidentiality and resilience.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-950">Privacy commitments</h3>
        <p>
          NRITAX.AI does not sell sensitive user data to advertisers. Access to data is limited to product operation, support, and legal compliance needs.
        </p>
        <p>
          By using NRITAX.AI, you consent to the privacy practices described in this summary and the linked full policy page.
        </p>
      </section>
    </div>
  );
}
