import { useEffect, useRef, useState } from "react";

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
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const originalOverflowRef = useRef("");

  useEffect(() => {
    if (!isOpen) return;

    setChecked(false);
    setHasScrolled(false);
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    originalOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflowRef.current;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusableElements.length) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (!activeElement || activeElement === first)) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && (!activeElement || activeElement === last)) {
        event.preventDefault();
        first.focus();
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

    const timeoutId = window.setTimeout(() => {
      const focusableElement = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      focusableElement?.focus();
    }, 20);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, type]);

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
  const descriptionId = "terms-modal-description";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      aria-describedby={descriptionId}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="animate-fadeIn relative z-[60] flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="terms-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-1 text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            x
          </button>
        </div>

        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-6 py-4 text-sm leading-relaxed text-slate-700"
          tabIndex={0}
        >
          <p id={descriptionId} className="sr-only">
            Review the full {title} before accepting and continuing.
          </p>
          {type === "terms" ? <TermsContent /> : <PrivacyContent />}
        </div>

        <div className="space-y-4 border-t border-slate-200 px-6 py-4">
          {!hasScrolled ? <p className="text-center text-xs text-slate-400">Please scroll and read before accepting</p> : null}

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={checked}
              disabled={!hasScrolled}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[#2563eb] disabled:opacity-40"
            />

            <span className={`text-sm ${hasScrolled ? "text-slate-700" : "text-slate-400"}`}>
              I have read and agree to the {title}
            </span>
          </label>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!checked}
            className="w-full rounded-xl bg-[#2563eb] py-3 font-semibold text-white transition-all hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-4">
      <p className="font-medium">Last Updated: May 2026</p>
      <p>By using NRITAX.AI, you agree to comply with all applicable tax, legal, and platform usage requirements.</p>
      <p>NRITAX.AI provides AI-assisted guidance and does not replace professional legal or tax advice.</p>
      <p>Users are responsible for providing accurate information during onboarding and subscription processes.</p>
      <p>The platform may use country-specific tax rules and DTAA logic depending on the country selected during signup.</p>
      <p>Subscription plans, pricing, and compliance workflows may vary based on country.</p>
      <p>Continued usage of the platform constitutes acceptance of all applicable policies.</p>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-4">
      <p className="font-medium">Last Updated: May 2026</p>
      <p>NRITAX.AI respects your privacy and securely handles your account and tax-related information.</p>
      <p>Information collected may include identity details, tax-related metadata, and onboarding information.</p>
      <p>Data may be processed to improve tax guidance, AI responses, onboarding experience, and subscription handling.</p>
      <p>Your information is protected using secure authentication and encrypted infrastructure.</p>
      <p>We do not sell sensitive user data to advertisers.</p>
      <p>By using NRITAX.AI, you consent to the platform privacy practices described in this policy.</p>
    </div>
  );
}
