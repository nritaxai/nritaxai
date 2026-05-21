import { Capacitor } from "@capacitor/core";
import { ArrowLeft, LogIn, LogOut, Menu, MoreVertical, User as UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { getStoredAuthToken, logoutCurrentSession } from "../../utils/api";
import { getAuthToken } from "../../services/authStorage";

interface AndroidHeaderProps {
  onLogin: () => void;
}

interface StoredUser {
  name?: string;
  profileImage?: string;
}

const NATIVE_CURRENT_ROUTE_KEY = "nritax:native-current-route";
const NATIVE_PREVIOUS_ROUTE_KEY = "nritax:native-previous-route";

const sanitizeProfileImage = (value?: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("data:image/")) return normalized;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;
  return "";
};

const androidMenuItems = [
  { to: "/home", label: "Home" },
  { to: "/chat", label: "AI Tax Chat" },
  { to: "/consult", label: "Consult a CPA" },
  { to: "/join-as-expert", label: "Join as an Expert" },
  { to: "/calculators", label: "Calculators" },
  { to: "/pricing", label: "Pricing" },
  { to: "/profile", label: "Profile" },
] as const;

export function AndroidHeader({ onLogin }: AndroidHeaderProps) {
  const isNative = Capacitor.isNativePlatform(); // Android only
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/" || location.pathname === "/home"; // Android only
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getStoredAuthToken()));
  const [userName, setUserName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const chatMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncAuthState = () => {
      setIsAuthenticated(Boolean(getStoredAuthToken()));

      try {
        const rawUser = localStorage.getItem("user");
        if (!rawUser) {
          setUserName("");
          setProfileImage("");
          return;
        }

        const parsedUser = JSON.parse(rawUser) as StoredUser;
        setUserName(typeof parsedUser?.name === "string" ? parsedUser.name.trim() : "");
        setProfileImage(sanitizeProfileImage(parsedUser?.profileImage));
      } catch {
        setUserName("");
        setProfileImage("");
      }
    };

    syncAuthState();
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("auth-changed", syncAuthState);
    window.addEventListener("user-updated", syncAuthState);

    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("auth-changed", syncAuthState);
      window.removeEventListener("user-updated", syncAuthState);
    };
  }, []);

  useEffect(() => {
    if (!chatMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (chatMenuRef.current?.contains(target)) return;
      setChatMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [chatMenuOpen]);

  if (!isNative) {
    return null; // Android only
  }

  const handleBackNavigation = () => {
    const previousRoute = sessionStorage.getItem(NATIVE_PREVIOUS_ROUTE_KEY);
    const currentRoute = sessionStorage.getItem(NATIVE_CURRENT_ROUTE_KEY);

    if (previousRoute && previousRoute !== currentRoute && previousRoute !== location.pathname) {
      navigate(previousRoute, { replace: true });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/home", { replace: true });
  };

  const handleLogout = async () => {
    await logoutCurrentSession();
    setDrawerOpen(false);
    navigate("/", { replace: true });
  };

  const avatarLetter = userName.trim().charAt(0).toUpperCase() || "";

  if (location.pathname === "/chat") {
    return (
      <header className="android-header fixed inset-x-0 top-0 z-[70] border-b border-white/10 bg-[#0a1628]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <button
            type="button"
            onClick={handleBackNavigation}
            className="inline-flex min-w-0 items-center gap-2 text-white"
            aria-label="Go back"
          >
            <ArrowLeft className="size-5" />
            <span className="truncate text-base font-semibold">AI Tax Chat</span>
          </button>

          <div ref={chatMenuRef} className="relative">
            <button
              type="button"
              aria-label="Open chat options"
              onClick={() => setChatMenuOpen((prev) => !prev)}
              className="inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              <MoreVertical className="size-5" />
            </button>
            {chatMenuOpen ? (
              <div className="absolute right-0 top-11 w-44 rounded-2xl border border-white/10 bg-[#132040] p-2 shadow-lg">
                <button
                  type="button"
                  className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-white transition hover:bg-white/10"
                  onClick={() => {
                    setChatMenuOpen(false);
                    window.dispatchEvent(new Event("nritax:download-chat"));
                  }}
                >
                  Download Chat
                </button>
                <button
                  type="button"
                  className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-white transition hover:bg-white/10"
                  onClick={() => {
                    setChatMenuOpen(false);
                    window.dispatchEvent(new Event("nritax:clear-chat"));
                  }}
                >
                  Clear Chat
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="android-header fixed inset-x-0 top-0 z-[70] border-b border-white/10 bg-[#0a1628]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {!isHome ? (
            <button
              type="button"
              onClick={handleBackNavigation}
              className="inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
              aria-label="Go back"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Open profile"
            onClick={async () => {
              const token = getStoredAuthToken() || (await getAuthToken());
              if (!token) {
                onLogin();
                return;
              }
              navigate("/profile");
            }}
            className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#2563eb] text-sm font-semibold text-white"
          >
            {profileImage ? (
              <img src={profileImage} alt={userName || "Profile"} className="h-full w-full object-cover" />
            ) : avatarLetter ? (
              <span>{avatarLetter}</span>
            ) : (
              <UserIcon className="size-4" />
            )}
          </button>

          <Link
            to="/home"
            className="truncate text-lg font-bold tracking-tight text-white"
            onClick={() => setDrawerOpen(false)}
          >
            NRITAX.AI
          </Link>
        </div>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open navigation menu"
              className="inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              <Menu className="size-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[84vw] max-w-sm border-l border-white/10 bg-[#0f1e35] pt-6 text-white">
            <SheetHeader className="border-b border-white/10 pb-4">
              <SheetTitle className="text-left text-lg font-bold tracking-tight text-white">
                NRITAX.AI
              </SheetTitle>
              {userName ? <p className="text-left text-sm text-white/60">{userName}</p> : null}
            </SheetHeader>

            <nav className="flex flex-1 flex-col gap-2 px-4 py-4">
              {androidMenuItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={`rounded-md px-3 py-3 text-sm font-medium transition-colors ${
                      isActive ? "bg-[#2563eb]/15 text-[#60a5fa]" : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/10 p-4">
              {isAuthenticated ? (
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full justify-start"
                >
                  <LogOut className="size-4" />
                  Logout
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDrawerOpen(false);
                    onLogin();
                  }}
                  className="w-full justify-start"
                >
                  <LogIn className="size-4" />
                  Login / Sign Up
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
