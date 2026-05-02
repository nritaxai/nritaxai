import { Capacitor } from "@capacitor/core";
import { Bot, Home, User } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getStoredAuthToken } from "../utils/api";

type NavItem = {
  label: string;
  to: string;
  icon?: typeof Home;
  matches?: string[];
  protected: boolean;
};

const navItems: NavItem[] = [
  { label: "Home", to: "/home", icon: Home, matches: ["/", "/home", "/hero", "/Hero"], protected: false },
  { label: "AI Chat", to: "/chat", icon: Bot, matches: ["/chat"], protected: true },
  { label: "Yukti", to: "/android-yukti", icon: Bot, matches: ["/android-yukti"], protected: true },
  { label: "Profile", to: "/profile", icon: User, matches: ["/profile"], protected: true },
];

export function AndroidBottomNav() {
  const isNative = Capacitor.isNativePlatform(); // Android only
  const location = useLocation();
  const navigate = useNavigate();

  const activePath = useMemo(() => {
    const item = navItems.find((entry) => entry.matches?.includes(location.pathname));
    return item?.to ?? "";
  }, [location.pathname]);

  if (!isNative) {
    return null; // Android only
  }

  const requireAuth = (requiresAuth: boolean) => {
    if (requiresAuth && !getStoredAuthToken()) {
      window.dispatchEvent(new Event("nritax:require-login")); // Android only
      return false;
    }

    return true;
  };

  const handleNavigate = (to: string, requiresAuth: boolean) => {
    if (!requireAuth(requiresAuth)) {
      return;
    }

    navigate(to);
  };

  return (
    <nav className="android-bottom-nav fixed inset-x-0 bottom-0 z-[70] border-t border-gray-200 bg-white">
      <div className="mx-auto grid h-[60px] max-w-3xl grid-cols-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.to;

          return (
            <button
              key={item.label}
              type="button"
              // Android only
              onClick={() => handleNavigate(item.to, item.protected)}
              className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                isActive ? "text-[#1a3cff]" : "text-[#9ca3af]"
              }`}
            >
              {Icon ? (
                <Icon className={`size-[21px] ${isActive ? "text-[#1a3cff]" : "text-[#9ca3af]"}`} />
              ) : null}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
