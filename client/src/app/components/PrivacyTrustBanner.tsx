import { Eye, ShieldCheck, UserCheck } from "lucide-react";

export function PrivacyTrustBanner() {
  return (
    <div className="my-8 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <ShieldCheck className="size-8 text-emerald-600" />
        </div>
        <div className="flex-1">
          <h3 className="mb-3 text-xl font-bold text-slate-900">Your Privacy, Our Priority</h3>
          <p className="mb-4 text-slate-600">
            <strong className="text-slate-900">Zero Personal Data Collection:</strong> We do not store or collect sensitive
            identifiers such as PAN, NPWP, Tax ID, or account details. Conversations are anonymized and used only for tax guidance.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">No Data Retention</h4>
                <p className="text-xs text-slate-600">Conversations are not linked to your identity or stored permanently</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-900">Partner-Only Sharing</h4>
                <p className="text-xs text-slate-600">Data is shared only with verified tax professionals on your explicit request</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


