import { BuilderPromptPanel } from "../components/builder/BuilderPromptPanel";
import { BuilderRightPanel } from "../components/builder/BuilderRightPanel";
import { BuilderSidebar } from "../components/builder/BuilderSidebar";

export function Builder() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-[#0F172A]">NRITAX Builder</h1>
        <p className="text-sm text-[#0F172A]">
          Bolt-style UI workspace for planning and previewing product updates.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_1.1fr]">
        <div className="min-h-[620px]">
          <BuilderSidebar />
        </div>
        <div className="min-h-[620px]">
          <BuilderPromptPanel />
        </div>
        <div className="min-h-[620px]">
          <BuilderRightPanel />
        </div>
      </div>
    </main>
  );
}








