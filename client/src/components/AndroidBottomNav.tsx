import { Capacitor } from "@capacitor/core";
import { Bot, Home, User } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ANDROID_THEME } from "./androidTheme";

type NavItem = {
  label: string;
  path: string;
  icon?: typeof Home;
  protected: boolean;
};

const navItems: NavItem[] = [
  { label: "Home", path: "/home", icon: Home, protected: false },
  { label: "AI Chat", path: "/chat", icon: Bot, protected: false },
  { label: "Yukti", path: "/android-yukti", icon: Bot, protected: false },
  { label: "Profile", path: "/profile", icon: User, protected: false },
];

// Android only
export function AndroidBottomNav() {
  const isNative = Capacitor.isNativePlatform();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = useMemo(
    () => (path: string) => {
      if (path === "/home") {
        return location.pathname === "/" || location.pathname === "/home" || location.pathname === "/hero" || location.pathname === "/Hero";
      }

      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    },
    [location.pathname]
  );

  if (!isNative) {
    return null;
  }

  const handleNavigate = (path: string) => {
    if (location.pathname === path) return;
    navigate(path);
  };

  return (
    <nav
      className="android-bottom-nav fixed inset-x-0 bottom-0 z-[50] backdrop-blur-xl"
      style={{
        background: "rgba(10,25,75,0.95)",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(10px)",
        paddingBottom: "env(safe-area-inset-bottom)",
        fontFamily: ANDROID_THEME.fontFamily,
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          height: "56px",
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const color = active ? "#4285F4" : "rgba(255,255,255,0.45)";

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => handleNavigate(item.path)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                color,
                background: "transparent",
                border: 0,
                fontFamily: ANDROID_THEME.fontFamily,
              }}
            >
              {Icon ? <Icon size={18} color={color} /> : null}
              <span style={{ fontSize: "8px", fontWeight: 600 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
