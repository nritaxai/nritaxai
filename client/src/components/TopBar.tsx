import { Bell, CircleHelp, Menu, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "../app/components/ui/button";

interface TopBarProps {
  onOpenSidebar: () => void;
}

const quickLinks = [
  { label: "Home", to: "/home" },
  { label: "Pricing", to: "/pricing" },
  { label: "Chat", to: "/chat" },
  { label: "Compliance", to: "/compliance" },
  { label: "Calculators", to: "/calculators" },
  { label: "Dashboard", to: "/dashboard" },
];

export function TopBar({ onOpenSidebar }: TopBarProps) {
  return (
    <header className="sticky top-0 z-50 h-20 border-b border-[#E2E8F0] bg-[#1d4ed8]/90 backdrop-blur supports-[backdrop-filter]:bg-[#1d4ed8]/80">
      <div className="flex h-full items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="md:hidden text-[#0F172A]"
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
          >
            <Menu className="size-5" />
          </Button>
          <NavLink to="/home" className="inline-flex items-center gap-2">
            <span className="text-base font-semibold tracking-wider text-[#0F172A]">NRITAX.AI</span>
          </NavLink>
        </div>

        <nav className="hidden items-center gap-2 lg:flex">
          {quickLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-base transition-colors ${
                  isActive
                    ? "bg-[#3b82f6] text-[#0F172A]"
                    : "text-[#0F172A] hover:bg-[#3b82f6] hover:text-[#0F172A]"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" className="h-10 border-[#E2E8F0] text-sm text-[#0F172A]">
            <CircleHelp className="mr-2 size-4" />
            Support
          </Button>
          <Button type="button" variant="ghost" size="icon" className="text-[#0F172A]">
            <Bell className="size-4" />
          </Button>
          <Button type="button" variant="outline" className="h-10 border-[#E2E8F0] text-sm text-[#0F172A]">
            <UserRound className="mr-2 size-4" />
            Profile
          </Button>
        </div>
      </div>
    </header>
  );
}







