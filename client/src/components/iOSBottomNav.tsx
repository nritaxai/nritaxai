import { useLocation, useNavigate } from "react-router-dom";
import { Home, Bot, User } from "lucide-react";
import { IS_IOS_NATIVE_APP } from "../config/appConfig";

// iOS only
const tabs = [
  { label: "Home", icon: Home, path: "/home" },
  { label: "AI Chat", icon: Bot, path: "/chat" },
  { label: "Yukti", icon: Bot, path: "/yukti" },
  { label: "Profile", icon: User, path: "/profile" },
] as const;

export function iOSBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  if (!IS_IOS_NATIVE_APP) return null;

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "calc(49px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        backgroundColor: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "0.5px solid rgba(0,0,0,0.15)",
        zIndex: 9999,
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path || (tab.path === "/home" && location.pathname === "/");

        return (
          <button
            key={tab.path}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              navigate(tab.path);
            }}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              background: "transparent",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              color: isActive ? "#1a3cff" : "#8e8e93",
              fontSize: 10,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', sans-serif",
              fontWeight: isActive ? 600 : 500,
              padding: "6px 0",
              pointerEvents: "auto",
              touchAction: "manipulation",
              cursor: "pointer",
            }}
          >
            <Icon
              style={{
                width: 24,
                height: 24,
                fill: isActive ? "#1a3cff" : "none",
                stroke: isActive ? "#1a3cff" : "#8e8e93",
              }}
            />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
