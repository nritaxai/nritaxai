import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthGateCard } from "../components/AuthGateCard";
import { CPAContact } from "../components/CPAContact";
import { getMySubscription, getStoredAuthToken } from "../../utils/api";
import { FEATURE_KEYS, type SubscriptionMe } from "../../utils/subscription";

interface ConsultProps {
  onRequireLogin: () => void;
}

export function Consult({ onRequireLogin }: ConsultProps) {
  const navigate = useNavigate();
  const isAuthenticated = Boolean(typeof window !== "undefined" && getStoredAuthToken());
  const [subscription, setSubscription] = useState<SubscriptionMe | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setSubscription(null);
      return;
    }
    getMySubscription()
      .then((data: any) => setSubscription(data || null))
      .catch(() => setSubscription(null));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title="Login to consult a CPA"
        description="Please sign in to book a consultation and connect with our certified tax experts."
        onRequireLogin={onRequireLogin}
      />
    );
  }

  const canUseCpa = Boolean(subscription?.features?.[FEATURE_KEYS.UNLIMITED_CPA_CONSULTATIONS]);

  return (
    <div className="py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-[#2563eb] hover:underline mb-3"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl text-[#0F172A] mb-2">Connect with Tax Experts</h1>
          <p className="text-[#0F172A]">
            {canUseCpa
              ? "Get personalized tax advice from certified professionals."
              : "CPA consultations are available only on the Enterprise plan."}
          </p>
        </div>
        <div className="max-w-3xl">
          {canUseCpa ? (
            <CPAContact embedded onClose={() => navigate(-1)} />
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-[#0F172A]">
              <p className="text-lg font-semibold">Enterprise Required</p>
              <p className="mt-2 text-sm">
                Your current plan does not include CPA consultations. Upgrade to Enterprise to unlock unlimited CPA consultations.
              </p>
              <button
                type="button"
                onClick={() => navigate("/pricing")}
                className="mt-4 inline-flex items-center rounded-md bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
              >
                Contact Enterprise / Upgrade
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
