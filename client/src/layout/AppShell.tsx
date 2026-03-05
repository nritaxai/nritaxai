import { Link, Outlet, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "../app/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "../app/components/ui/card";
import { Badge } from "../app/components/ui/badge";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";

const utilityByRoute: Record<string, { title: string; tips: string[] }> = {
  "/chat": {
    title: "Chat Utilities",
    tips: [
      "Use language switcher before asking treaty-specific questions.",
      "Keep one topic per message for more precise responses.",
      "Use Download Chat after finalizing advice.",
    ],
  },
  "/pricing": {
    title: "Plan Guidance",
    tips: [
      "Starter is best for occasional tax checks.",
      "Professional unlocks uninterrupted AI guidance.",
      "Enterprise is ideal for complex filing workflows.",
    ],
  },
  "/dashboard": {
    title: "Ops Summary",
    tips: [
      "Track active subscriptions daily.",
      "Review AI usage trends for conversion moments.",
      "Follow up quickly on consultation requests.",
    ],
  },
};

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const utilityPanel = useMemo(() => {
    const match = Object.keys(utilityByRoute).find((prefix) =>
      location.pathname.toLowerCase().startsWith(prefix)
    );
    return match ? utilityByRoute[match] : null;
  }, [location.pathname]);

  return (
    <div className="flex h-dvh flex-col">
      <TopBar onOpenSidebar={() => setMobileOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[260px] shrink-0 md:block">
          <Sidebar />
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[290px] border-r border-[#E2E8F0] p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="min-w-0 flex-1 overflow-y-auto bg-transparent">
          <div className={utilityPanel ? "xl:grid xl:grid-cols-[1fr_300px]" : ""}>
            <div className="px-4 py-5 md:px-6 md:py-6">
              <Outlet />
            </div>

            {utilityPanel ? (
              <aside className="hidden border-l border-[#E2E8F0] px-4 py-6 xl:block">
                <Card className="rounded-2xl border-[#E2E8F0] bg-[#F7FAFC]/75">
                  <CardHeader>
                    <CardTitle className="text-base text-[#0F172A]">{utilityPanel.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {utilityPanel.tips.map((tip) => (
                      <div key={tip} className="rounded-lg border border-[#E2E8F0] bg-[#F7FAFC]/80 p-3 text-sm text-[#0F172A]">
                        {tip}
                      </div>
                    ))}
                    <Link
                      to="/consult"
                      className="inline-flex items-center rounded-full bg-[#3b82f6] px-3 py-1.5 text-xs font-medium text-[#0F172A]"
                    >
                      Open CPA Consultation
                    </Link>
                    <Badge className="bg-[#1d4ed8] text-[#2563eb]">System Stable</Badge>
                  </CardContent>
                </Card>
              </aside>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}








