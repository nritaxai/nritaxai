import { useState } from "react";
import { Link } from "react-router-dom";

import { acceptTerms } from "../../utils/api";
import { CURRENT_POLICY_VERSION } from "../../config/legal";
import { COMPANY_LEGAL_NAME } from "../../config/branding";
import { Button } from "./ui/button";

interface LegalAcceptanceGateProps {
  onAccepted: (user: any) => void;
}

const getApiErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

export function LegalAcceptanceGate({ onAccepted }: LegalAcceptanceGateProps) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setError(null);
    if (!accepted) {
      setError("Please accept the Terms & Conditions and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    try {
      const response = await acceptTerms({
        termsAccepted: true,
        policyVersion: CURRENT_POLICY_VERSION,
      });
      const user = response?.user || response?.data;
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("auth-changed"));
      onAccepted(user);
    } catch (apiError: any) {
      setError(getApiErrorMessage(apiError, "Unable to save acceptance. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#0F172A]/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-[#0F172A]">Terms update required</h2>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          Please accept {COMPANY_LEGAL_NAME}&apos;s Terms & Conditions and Privacy Policy before using Yukti or AI chat.
        </p>
        <div className="mt-5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <label className="flex items-start gap-3 text-sm text-[#334155]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1"
            />
            <span>
              I agree to the{" "}
              <Link to="/terms-and-conditions" target="_blank" className="text-[#2563eb] underline">
                Terms & Conditions
              </Link>{" "}
              and{" "}
              <Link to="/privacy-policy" target="_blank" className="text-[#2563eb] underline">
                Privacy Policy
              </Link>
            </span>
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <Button type="button" className="mt-5 w-full" disabled={loading || !accepted} onClick={() => void handleContinue()}>
          {loading ? "Saving..." : "Accept and continue"}
        </Button>
      </div>
    </div>
  );
}
