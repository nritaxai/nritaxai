import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";

export function HeroPage() {
  const navigate = useNavigate();
  const [isPrivacyAccepted, setIsPrivacyAccepted] = useState(false);
  const [hasReadPrivacyPolicy, setHasReadPrivacyPolicy] = useState(false);

  useEffect(() => {
    const accepted = window.localStorage.getItem("privacyPolicyAccepted") === "true";
    const hasRead = window.localStorage.getItem("privacyPolicyRead") === "true";
    setIsPrivacyAccepted(accepted);
    setHasReadPrivacyPolicy(hasRead);
  }, []);

  const onPrivacyChange = (checked: boolean) => {
    setIsPrivacyAccepted(checked);
    if (checked) {
      window.localStorage.setItem("privacyPolicyAccepted", "true");
      return;
    }
    window.localStorage.removeItem("privacyPolicyAccepted");
  };

  return (
    <div className="relative min-h-[calc(100vh-160px)] overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50 to-white">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-20 text-center sm:py-28">
        <img
          src="/logo.svg"
          alt="NRITAX.AI logo"
          className="mb-8 h-24 w-24 rounded-3xl shadow-xl sm:h-28 sm:w-28"
        />

        <p className="mb-3 rounded-full border border-blue-200 bg-white/75 px-4 py-1 text-xs tracking-wide text-blue-700">
          AI Tax Platform for NRIs
        </p>

        <h1 className="text-4xl tracking-tight text-slate-900 sm:text-6xl">
          NRITAX<span className="text-blue-600">.AI</span>
        </h1>

        <p className="mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
          Smart NRI tax guidance, instant AI help, and practical next steps in one place.
        </p>

        <div className="mt-8 w-full max-w-2xl rounded-xl border border-slate-200 bg-white/80 p-4 text-left shadow-sm">
          <p className="text-sm text-slate-700">
            Read our{" "}
            <Link to="/privacy" className="font-medium text-blue-700 underline underline-offset-2">
              Privacy Policy
            </Link>
            {" "}first. The checkbox is enabled only after you visit and read it.
          </p>
          <div className="mt-3 flex items-start gap-3">
            <Checkbox
              id="hero-privacy-consent"
              checked={isPrivacyAccepted}
              disabled={!hasReadPrivacyPolicy}
              onCheckedChange={(checked) => onPrivacyChange(checked === true)}
            />
            <Label htmlFor="hero-privacy-consent" className="text-sm leading-5 text-slate-700">
              I agree to the Privacy Policy.
            </Label>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" variant="outline" disabled={!isPrivacyAccepted} onClick={() => navigate("/home")}>
            Enter Website
          </Button>
          <Button
            size="lg"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={!isPrivacyAccepted}
            onClick={() => navigate("/chat")}
          >
            Start AI Chat
            <ArrowRight className="ml-2 size-4" />
          </Button>
          <Button size="lg" variant="outline" disabled={!isPrivacyAccepted} onClick={() => navigate("/pricing")}>
            View Pricing
          </Button>
        </div>
      </div>
    </div>
  );
}
