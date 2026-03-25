import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthGateCard } from "../components/AuthGateCard";
import { CPAContact } from "../components/CPAContact";
import { getStoredAuthToken } from "../../utils/api";

interface ConsultProps {
  onRequireLogin: () => void;
}

export function Consult({ onRequireLogin }: ConsultProps) {
  const navigate = useNavigate();
  const isAuthenticated = Boolean(typeof window !== "undefined" && getStoredAuthToken());

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title="Login to consult a CPA"
        description="Please sign in to book a consultation and connect with our certified tax experts."
        onRequireLogin={onRequireLogin}
      />
    );
  }

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
          <p className="text-[#0F172A]">Get personalized tax advice from certified professionals.</p>
        </div>
        <div className="max-w-3xl">
          <CPAContact embedded onClose={() => navigate(-1)} />
        </div>
      </div>
    </div>
  );
}
