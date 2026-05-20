import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { User as UserIcon } from "lucide-react";
import { IS_IOS_NATIVE_APP } from "../../config/appConfig";

const parseStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      name: parsed?.name || "",
      profileImage: parsed?.profileImage || "",
    } as { name: string; profileImage?: string | null };
  } catch {
    return null;
  }
};

interface iOSHeaderProps {
  onLogin?: () => void;
}

export function iOSHeader({ onLogin }: iOSHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{ name: string; profileImage?: string | null } | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setUser(parseStoredUser());

    const syncUser = () => setUser(parseStoredUser());
    window.addEventListener("storage", syncUser);
    window.addEventListener("auth-changed", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("auth-changed", syncUser);
    };
  }, []);

  const title = useMemo(() => {
    if (location.pathname === "/" || location.pathname === "/home") {
      return "NRITAX.AI";
    }

    const segments = location.pathname.split("/").filter(Boolean);
    if (!segments.length) return "NRITAX.AI";
    return segments
      .map((segment) => segment.replace(/[-_]/g, " "))
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }, [location.pathname]);

  if (!IS_IOS_NATIVE_APP) return null;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "NR";

  const closeMenu = () => setIsMenuOpen(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("auth-changed"));
    closeMenu();
    navigate("/home", { replace: true });
    onLogin?.();
  };

  return (
    <>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          backgroundColor: "rgba(26,60,255,0.95)",
          borderBottom: "0.5px solid rgba(255,255,255,0.2)",
          paddingTop: "env(safe-area-inset-top)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            height: "44px",
            minHeight: "44px",
            display: "grid",
            gridTemplateColumns: "44px minmax(0, 1fr) 44px",
            alignItems: "center",
            padding: "0 12px",
            gap: "8px",
          }}
        >
          <Link to="/profile" aria-label="Open profile" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "999px",
                overflow: "hidden",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.18)",
                color: "white",
                fontSize: 13,
                fontWeight: 700,
                border: "1px solid rgba(255,255,255,0.24)",
              }}
            >
              {user?.profileImage && !avatarFailed ? (
                <img
                  src={user.profileImage}
                  alt={user.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={() => setAvatarFailed(true)}
                />
              ) : user?.name ? (
                initials
              ) : (
                <UserIcon style={{ width: 18, height: 18 }} />
              )}
            </span>
          </Link>

          <span
            style={{
              color: "white",
              fontSize: 17,
              fontWeight: 600,
              textAlign: "center",
              letterSpacing: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </span>

          <button
            type="button"
            aria-label="Open more menu"
            onClick={() => setIsMenuOpen(true)}
            style={{
              width: 32,
              height: 32,
              justifySelf: "center",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.24)",
              color: "white",
              backgroundColor: "rgba(255,255,255,0.08)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            •••
          </button>
        </div>
      </header>

      {isMenuOpen ? (
        <div style={overlayStyle} onClick={closeMenu}>
          <div style={sheetStyle} onClick={(event) => event.stopPropagation()}>
            <div style={grabberStyle} />
            <Link to="/profile" onClick={closeMenu} style={menuItemStyle}>
              Settings
            </Link>
            <Link to="/chat" onClick={closeMenu} style={menuItemStyle}>
              Help
            </Link>
            <Link to="/privacy-policy" onClick={closeMenu} style={menuItemStyle}>
              Privacy Policy
            </Link>
            <button type="button" onClick={handleLogout} style={menuItemStyle}>
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100000,
  backgroundColor: "rgba(0,0,0,0.24)",
  display: "flex",
  alignItems: "flex-end",
};

const sheetStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px calc(12px + env(safe-area-inset-bottom))",
  borderRadius: "20px 20px 0 0",
  backgroundColor: "rgba(242,242,247,0.96)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
  display: "grid",
  gap: 8,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', sans-serif",
};

const grabberStyle: CSSProperties = {
  width: 36,
  height: 5,
  borderRadius: 999,
  backgroundColor: "rgba(60,60,67,0.3)",
  justifySelf: "center",
  marginBottom: 6,
};

const menuItemStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  padding: "14px 16px",
  textAlign: "left",
  backgroundColor: "white",
  color: "#111827",
  border: "none",
  fontSize: 16,
  fontWeight: 500,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', sans-serif",
  cursor: "pointer",
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};
