import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, FileText, ShieldCheck, X } from "lucide-react";
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
        className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 px-3 py-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-4"
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
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="relative z-[60] flex h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[30px] border border-white/60 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)] sm:h-auto sm:max-h-[90vh] sm:rounded-[32px]"
        >
          <div className="border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <FileText className="size-4 text-[#2563eb]" />
                  Policy Review
                </div>
                <div>
                  <h2 id="terms-modal-title" className="text-xl font-semibold text-slate-900">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Review the summary below before continuing with account creation.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/15"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                <span>Reading progress</span>
                <span>{Math.round(scrollProgress)}%</span>
              </div>
              <Progress value={hasScrolled ? 100 : scrollProgress} className="h-2 bg-slate-100" />
            </div>
          </div>

          <div
            ref={contentRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y bg-[linear-gradient(180deg,rgba(248,250,252,0.55),rgba(255,255,255,0.92))] px-5 py-5 text-sm leading-relaxed text-slate-700 sm:px-6"
            tabIndex={0}
          >
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="rounded-[24px] border border-sky-100 bg-sky-50/70 p-4 text-sm text-slate-700">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2563eb]" />
                  <p className="leading-6">
                    This acknowledgment applies only to new signups. Existing sign-in and account access continue unchanged.
                  </p>
                </div>
              </div>

              {type === "terms" ? <TermsContent /> : <PrivacyContent />}
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-white/98 px-5 py-4 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {!hasScrolled ? (
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                    Scroll near the end to unlock acknowledgment
                  </p>
                ) : (
                  <a
                    href={reviewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#2563eb] transition-colors hover:text-[#1d4ed8]"
                  >
                    Open full policy page
                    <ArrowUpRight className="size-4" />
                  </a>
                )}
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!hasScrolled}
                  onChange={(event) => setChecked(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#2563eb] disabled:opacity-40"
                />

                <span className={`text-sm leading-6 ${hasScrolled ? "text-slate-700" : "text-slate-400"}`}>
                  I have read and agree to the {title}
                </span>
              </label>

              <button
                type="button"
                onClick={handleContinue}
                disabled={!checked}
                className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] px-4 font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.25)] transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
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
      <section className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Last Updated: May 2026</p>
        <h3 className="text-lg font-semibold text-slate-900">How the platform should be used</h3>
        <p>
          By using NRITAX.AI, you agree to comply with applicable tax, legal, and platform usage requirements in the jurisdictions relevant to your account.
        </p>
        <p>
          NRITAX.AI provides AI-assisted guidance, planning support, and workflow tooling. It does not replace formal legal or tax advice where professional review is required.
        </p>
      </section>

      <section className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Accuracy and account responsibility</h3>
        <p>
          Users are responsible for providing accurate information during onboarding, profile completion, subscription setup, and any expert-assisted workflow.
        </p>
        <p>
          Country selection, plan eligibility, and pricing may influence how tax rules, DTAA context, and support flows are applied across the product.
        </p>
      </section>

      <section className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Subscriptions and service usage</h3>
        <p>
          Subscription plans, pricing tiers, and compliance workflows may vary by country, product scope, and platform policies in effect at the time of access.
        </p>
        <p>
          Continued use of NRITAX.AI after reviewing these terms constitutes acceptance of the applicable policies supporting your account experience.
        </p>
      </section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Last Updated: May 2026</p>
        <h3 className="text-lg font-semibold text-slate-900">Information we collect</h3>
        <p>
          NRITAX.AI respects your privacy and securely handles account information, tax-related metadata, onboarding details, and related usage signals needed to operate the service.
        </p>
        <p>
          Information collected may include identity details, country context, subscription state, compliance workflow inputs, and support interactions.
        </p>
      </section>

      <section className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">How data is used</h3>
        <p>
          Data may be processed to improve tax guidance, AI responses, onboarding experience, subscription handling, and country-specific product flows across the platform.
        </p>
        <p>
          Your information is protected using secure authentication, access controls, and infrastructure practices designed for confidentiality and resilience.
        </p>
      </section>

      <section className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Privacy commitments</h3>
        <p>
          NRITAX.AI does not sell sensitive user data to advertisers. Access to data is limited to the purposes required for product operation, support, and legal compliance.
        </p>
        <p>
          By using NRITAX.AI, you consent to the privacy practices described in this policy summary and the linked full policy page.
        </p>
      </section>
    </div>
  );
}
