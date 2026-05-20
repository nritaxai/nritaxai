import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

export function IosYuktiPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#f2f2f7] px-4 py-6 md:px-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">YUKTI</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">Ask YUKTI for tax help</h1>
          </div>
        </div>
        <p className="mb-6 text-sm leading-6 text-slate-600">
          Get fast, conversational assistance for non-resident tax questions, compliance, and filing.
          YUKTI helps you understand DTAA, cross-border remittances, and tax residency rules.
        </p>
        <div className="grid gap-4">
          <Button type="button" onClick={() => navigate("/chat")}>Open AI Chat</Button>
          <Button type="button" variant="outline" onClick={() => navigate("/profile")}>View Profile</Button>
        </div>
      </div>
    </main>
  );
}
