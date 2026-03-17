import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";

type HeroLocationState = {
  privacyReviewed?: boolean;
};

export function HeroPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as HeroLocationState;
  const [hasViewedPolicy, setHasViewedPolicy] = useState(false);
  const [hasAcceptedPolicy, setHasAcceptedPolicy] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const reviewedFromPrivacy = state.privacyReviewed === true;
    setHasViewedPolicy(reviewedFromPrivacy);
    if (!reviewedFromPrivacy) {
      setHasAcceptedPolicy(false);
    }
  }, [state.privacyReviewed]);

  const canEnterWebsite = useMemo(
    () => hasViewedPolicy && hasAcceptedPolicy,
    [hasAcceptedPolicy, hasViewedPolicy]
  );

  const handleOpenPrivacyPolicy = () => {
    setHasAcceptedPolicy(false);
    navigate("/privacy-policy", {
      state: {
        fromHero: true,
        returnTo: "/",
      },
    });
  };

  const handleAcknowledgementChange = (checked: boolean | "indeterminate") => {
    setHasAcceptedPolicy(checked === true);
  };

  const handleNavigate = (path: string) => {
    if (!canEnterWebsite) return;
    navigate(path);
  };

  return (
    <div className="relative min-h-[calc(100vh-160px)] overflow-hidden bg-gradient-to-b from-transparent via-[#2563eb]/5 to-transparent">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#2563eb]/18 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#2563eb]/20 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-20 text-center sm:py-28">
        <img
          src="/logo-transparent.png"
          alt="NRITAX logo"
          className="reveal-drop mb-7 h-32 w-auto object-contain sm:h-40"
        />

        <p className="reveal-drop mb-3 rounded-full border border-[#E2E8F0] bg-[#F7FAFC]/75 px-4 py-1 text-xs tracking-wide text-[#2563eb]">
          AI Tax Platform for NRIs
        </p>

        <h1 className="reveal-drop reveal-delay-1 text-4xl tracking-tight text-[#0F172A] sm:text-6xl">
          NRITAX<span className="text-[#2563eb]">.AI</span>
        </h1>

        <p className="reveal-drop reveal-delay-2 mt-5 max-w-2xl text-base text-[#0F172A] sm:text-lg">
          Smart NRI tax guidance, instant AI help, and practical next steps in one place.
        </p>

        <div className="reveal-drop reveal-delay-3 mt-10 w-full max-w-2xl rounded-2xl border border-[#DBEAFE] bg-white/90 p-5 text-left shadow-sm backdrop-blur">
          <p className="text-sm font-semibold text-[#0F172A]">Review privacy policy before entering</p>
          <p className="mt-2 text-sm leading-6 text-[#475569]">
            Please open the privacy policy, read it, and confirm your acknowledgment.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" size="lg" onClick={handleOpenPrivacyPolicy} className="sm:w-auto">
              Privacy Policy
            </Button>
            <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <Checkbox
                id="hero-privacy-acknowledgement"
                checked={hasAcceptedPolicy}
                disabled={!hasViewedPolicy}
                onCheckedChange={handleAcknowledgementChange}
                aria-describedby="hero-privacy-help"
              />
              <label htmlFor="hero-privacy-acknowledgement" className="cursor-pointer text-sm leading-6 text-[#0F172A]">
                I have read the Privacy Policy and agree to proceed to the NRITAX website.
              </label>
            </div>
          </div>

          <p id="hero-privacy-help" className="mt-3 text-xs text-[#64748B]">
            {!hasViewedPolicy
              ? "Open the Privacy Policy and return here to enable the acknowledgment checkbox."
              : hasAcceptedPolicy
                ? "Privacy acknowledgement completed. You can now use the hero page buttons."
                : "Tick the acknowledgment checkbox to enable the hero page buttons."}
          </p>
        </div>

        <div className="reveal-drop reveal-delay-3 mt-10 flex flex-col gap-3 sm:flex-row">
          <Button type="button" size="lg" variant="outline" disabled={!canEnterWebsite} onClick={() => handleNavigate("/home")}>
            Enter Website
          </Button>
          <Button
            type="button"
            size="lg"
            className="bg-[#2563eb] text-[#0F172A] hover:opacity-95"
            disabled={!canEnterWebsite}
            onClick={() => handleNavigate("/chat")}
          >
            Start AI Chat
            <ArrowRight className="ml-2 size-4" />
          </Button>
          <Button type="button" size="lg" variant="outline" disabled={!canEnterWebsite} onClick={() => handleNavigate("/pricing")}>
            View Pricing
          </Button>
        </div>
      </div>
    </div>
  );
}
