import { Eye, ShieldCheck, UserCheck, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function PrivacyTrustBanner() {
  const navigate = useNavigate();

  return (
    <div className="my-8 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <ShieldCheck className="size-8 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">Privacy First</p>
          <h3 className="mb-3 text-3xl font-bold tracking-tight text-slate-900">Your Privacy, Our Priority</h3>
          <p className="mb-4 text-sm font-normal leading-7 text-slate-600">
            <strong className="text-slate-900">Zero Personal Data Collection:</strong> We do not store or collect sensitive
            identifiers such as PAN, NPWP, Tax ID, or account details. Conversations are anonymized and used only for tax guidance.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <h4 className="mb-1 text-lg font-semibold text-slate-900">No Data Retention</h4>
                <p className="text-sm font-normal leading-7 text-slate-600">Conversations are not linked to your identity or stored permanently</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
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
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
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


