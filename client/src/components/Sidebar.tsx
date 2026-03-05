import {
  Calculator,
  ClipboardList,
  Coins,
  FileCheck2,
  FolderClock,
  Gauge,
  Home,
  Landmark,
  LayoutTemplate,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

interface SidebarProps {
  onNavigate?: () => void;
}

const workspaceLinks = [
  { label: "Home", to: "/home", icon: Home },
  { label: "Pricing", to: "/pricing", icon: Coins },
  { label: "AI Chat", to: "/chat", icon: MessageCircle },
  { label: "Compliance", to: "/compliance", icon: ShieldCheck },
  { label: "Calculators", to: "/calculators", icon: Calculator },
  { label: "Dashboard", to: "/dashboard", icon: Gauge },
];

const templateLinks = [
  { label: "Residency status helper", to: "/calculators", icon: LayoutTemplate },
  { label: "DTAA checker", to: "/chat", icon: Landmark },
  { label: "ITR checklist", to: "/compliance", icon: ClipboardList },
  { label: "Capital gains tool", to: "/calculators", icon: Coins },
  { label: "Form 15CA/CB guide", to: "/compliance", icon: FileCheck2 },
];

const recentItems = ["USA DTAA session", "FY 2025 planning notes", "Pricing comparison draft"];

export function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();

  return (
    <aside className="flex h-full w-full flex-col border-r border-[#E2E8F0] bg-[#1d4ed8] px-3 py-4">
      <div className="mb-4 rounded-xl border border-[#E2E8F0] bg-[#F7FAFC]/70 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-[#0F172A]">Workspace</p>
        <p className="text-sm font-medium text-[#0F172A]">NRITAX Workbench</p>
      </div>

      <section className="mb-5">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[#0F172A]">Navigation</p>
        <div className="space-y-1">
          {workspaceLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                    isActive || location.pathname.toLowerCase() === link.to.toLowerCase()
                      ? "bg-[#3b82f6] text-[#0F172A]"
                      : "text-[#0F172A] hover:bg-[#3b82f6] hover:text-[#0F172A]"
                  }`
                }
              >
                <Icon className="size-4" />
                {link.label}
              </NavLink>
            );
          })}
        </div>
      </section>

      <section className="mb-5">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[#0F172A]">Templates</p>
        <div className="space-y-1">
          {templateLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={`${link.label}-${link.to}`}
                to={link.to}
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#0F172A] transition hover:bg-[#3b82f6] hover:text-[#0F172A]"
              >
                <Icon className="size-4" />
                {link.label}
              </NavLink>
            );
          })}
        </div>
      </section>

      <section className="mt-auto">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[#0F172A]">Saved / Recent</p>
        <div className="space-y-1">
          {recentItems.map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F7FAFC]/65 px-2.5 py-2 text-sm text-[#0F172A]"
            >
              <FolderClock className="size-4 text-[#2563eb]" />
              <span className="truncate">{item}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}








