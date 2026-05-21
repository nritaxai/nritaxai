import { Capacitor } from "@capacitor/core";
import { Bot, Home, User } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";


type NavItem = {
  label: string;
  path: string;
  icon?: typeof Home;
  protected: boolean;
};

const navItems: NavItem[] = [
  { label: "Home", path: "/", icon: Home, protected: false },
  { label: "AI Chat", path: "/chat", icon: Bot, protected: false },
  { label: "Yukti", path: "/android-yukti", icon: Bot, protected: false },
  { label: "Profile", path: "/profile", icon: User, protected: false },
];

export function AndroidBottomNav() {
  const isNative = Capacitor.isNativePlatform(); // Android only
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = useMemo(
    () => (path: string) => {
      if (path === "/") {
        return location.pathname === "/" || location.pathname === "/home" || location.pathname === "/hero" || location.pathname === "/Hero";
      }

      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    },
    [location.pathname]
  );

  if (!isNative) {
    return null; // Android only
  }

  const handleNavigate = (path: string) => {
    // Android only — debug log
    console.log('[BottomNav] Tapped:', path);
    console.log('[BottomNav] Current:', location.pathname);
    
    // Skip if already on this path
    if (location.pathname === path) {
      console.log('[BottomNav] Already here, skipping');
      return;
    }
    
    // Navigate using React Router
    navigate(path);
    console.log('[BottomNav] Navigated to:', path);
  };

  return (
    <nav
      className="android-bottom-nav fixed inset-x-0 bottom-0 z-[50] border-t border-white/10 bg-[#0a1628]/95 backdrop-blur-xl"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        height: "calc(60px + env(safe-area-inset-bottom))",
        backgroundColor: "#0a1628",
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="mx-auto grid h-[60px] max-w-3xl grid-cols-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.label}
              type="button"
              // Android only
              onClick={() => handleNavigate(item.path)}
              className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                active ? "text-[#2563eb]" : "text-white/40"
              }`}
            >
              {Icon ? (
                <Icon className={`size-[21px] ${active ? "text-[#2563eb]" : "text-white/40"}`} />
              ) : null}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

