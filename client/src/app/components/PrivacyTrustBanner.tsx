import { Eye, ShieldCheck, UserCheck, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function PrivacyTrustBanner() {
  const navigate = useNavigate();

  return (
    <div className="my-8 rounded-[1.8rem] border border-emerald-500/18 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(255,255,255,0.95),rgba(236,253,245,0.98))] p-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)] md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="shrink-0">
          <div className="inline-flex size-16 items-center justify-center rounded-[1.4rem] bg-emerald-600 text-white shadow-[0_16px_28px_rgba(5,150,105,0.24)]">
            <ShieldCheck className="size-8" />
          </div>
        </div>
        <div className="flex-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Privacy First</p>
          <h3 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-950">Designed for trust before conversion</h3>
          <p className="mb-5 text-sm leading-7 text-slate-600 md:text-base">
            <strong className="text-slate-900">Zero Personal Data Collection:</strong> We do not store or collect sensitive
            identifiers such as PAN, NPWP, Tax ID, or account details. Conversations are anonymized and used only for tax guidance.
          </p>
          <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
            <div className="flex h-full items-start gap-3 rounded-2xl border border-emerald-100 bg-white/85 p-4">
              <Eye className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <h4 className="mb-1 text-lg font-semibold text-slate-900">No Data Retention</h4>
                <p className="text-sm font-normal leading-7 text-slate-600">Conversations are not linked to your identity or stored permanently</p>
              </div>
            </div>
            <div className="flex h-full items-start gap-3 rounded-2xl border border-emerald-100 bg-white/85 p-4">
              <UserCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <h4 className="mb-1 text-lg font-semibold text-slate-900">Partner-Only Sharing</h4>
                <p className="text-sm font-normal leading-7 text-slate-600">Data is shared only with verified tax professionals on your explicit request</p>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate("/privacy-policy")}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(5,150,105,0.22)] transition-colors hover:bg-emerald-700"
            >
              Review Privacy Policy
              <ArrowRight className="ml-2 size-4" />
            </button>
            <p className="text-sm font-normal text-slate-600">
              Read how NRITAX handles privacy, access, and data-sharing with tax professionals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


