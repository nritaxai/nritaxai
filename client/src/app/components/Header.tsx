import { Button } from "./ui/button";
import {
  ChevronLeft,
  LogIn,
  LogOut,
  Menu,
  User as UserIcon,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { renderTextWithShortForms } from "../utils/shortForms";
import { clearStoredAuth, getStoredAuthToken, getUserProfile } from "../../utils/api";
import { PREMIUM_EASE } from "../utils/motion";

interface HeaderProps {
  onLogin: () => void;
}

interface User {
  name: string;
  email: string;
  profileImage?: string;
}

const sanitizeProfileImage = (value?: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("data:image/")) return normalized;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;
  return "";
};

const parseStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      profileImage: sanitizeProfileImage(parsed?.profileImage),
    } as User;
  } catch {
    return null;
  }
};

export function Header({ onLogin }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const navItems = [
    { to: "/home#features", label: "Features" },
    { to: "/home#tax-updates", label: "Tax Updates" },
    { to: "/chat", label: "AI Chat" },
    { to: "/pricing", label: "Pricing" },
    { to: "/calculators", label: "Tax Calculator" },
  ] as const;

  const isHomeRoute = location.pathname === "/home" || location.pathname === "/";

  const isNavItemActive = (to: string) => {
    const [path, hash] = to.split("#");
    if (hash) {
      return location.pathname === path && location.hash === `#${hash}`;
    }
    return location.pathname === path;
  };

  useEffect(() => {
    const loadUser = async () => {
      const storedUser = parseStoredUser();
      if (storedUser?.name && storedUser?.email) {
        setUser(storedUser);
        return;
      }

      const token = getStoredAuthToken();
      if (!token) {
        setUser(null);
        return;
      }

      try {
        const response = await getUserProfile();
        const profile = response?.data;
        if (!profile?.email) {
          setUser(null);
          return;
        }

        const nextUser = {
          ...profile,
          profileImage: sanitizeProfileImage(profile?.profileImage),
        };
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
      } catch (error: any) {
        if (error?.response?.status === 401) {
          clearStoredAuth();
        }
        setUser(null);
      }
    };

    void loadUser();

    const reloadUser = () => {
      void loadUser();
    };

    window.addEventListener("storage", reloadUser);
    window.addEventListener("auth-changed", reloadUser);
    window.addEventListener("user-updated", reloadUser);
    window.addEventListener("focus", reloadUser);
    document.addEventListener("visibilitychange", reloadUser);

    return () => {
      window.removeEventListener("storage", reloadUser);
      window.removeEventListener("auth-changed", reloadUser);
      window.removeEventListener("user-updated", reloadUser);
      window.removeEventListener("focus", reloadUser);
      document.removeEventListener("visibilitychange", reloadUser);
    };
  }, []);

  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.profileImage]);

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("auth-changed"));
    setMobileMenuOpen(false);
    navigate("/", { replace: true });
  };

  const renderUserAvatar = (sizeClass: string, iconSizeClass: string) => (
    <span className={`inline-flex items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 ${sizeClass}`}>
      {user?.profileImage && !avatarFailed ? (
        <img
          key={user.profileImage}
          src={user.profileImage}
          alt={user.name}
          className="h-full w-full object-cover"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <UserIcon className={`${iconSizeClass} text-slate-600`} />
      )}
    </span>
  );

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/home");
  };

  return (
    <header className="sticky top-0 z-50">
      <motion.div
        animate={{
          backgroundColor: hasScrolled || !isHomeRoute ? "rgba(255,255,255,0.92)" : "rgba(248,250,252,0.72)",
          boxShadow: hasScrolled ? "0 12px 32px rgba(15, 23, 42, 0.08)" : "0 0 0 rgba(15, 23, 42, 0)",
        }}
        transition={{ duration: 0.28, ease: PREMIUM_EASE }}
        className="border-b border-slate-200/70 backdrop-blur-xl"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-20 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleGoBack}
                aria-label="Go back"
                className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <ChevronLeft className="size-5" />
              </button>

              <Link to="/home" className="inline-flex items-center gap-3" aria-label="NRITAX home">
                <img
                  src="/logo-transparent.png"
                  alt="NRITAX logo"
                  className="h-14 w-auto object-contain"
                />
              </Link>
            </div>

            <nav className="hidden items-center gap-8 lg:flex">
              {navItems.map((item) => {
                const isActive = isNavItemActive(item.to);
                return (
                  <motion.div
                    key={item.to}
                    whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                    transition={{ duration: 0.18, ease: PREMIUM_EASE }}
                  >
                    <Link
                      to={item.to}
                      className={`relative py-2 text-sm font-medium transition-colors ${
                        isActive ? "text-[#2563EB]" : "text-slate-700 hover:text-[#2563EB]"
                      }`}
                    >
                      {renderTextWithShortForms(item.label)}
                      <motion.span
                        className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full bg-[#2563EB]"
                        initial={false}
                        animate={{ opacity: isActive ? 1 : 0, scaleX: isActive ? 1 : 0.5 }}
                        transition={{ duration: 0.2, ease: PREMIUM_EASE }}
                        style={{ originX: 0.5 }}
                      />
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-[#2563EB]"
                    aria-label="Open profile"
                    title="Open profile"
                  >
                    {renderUserAvatar("h-9 w-9", "size-4")}
                    <span className="max-w-[13rem] truncate">WELCOME! {user.name}</span>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="h-11 rounded-xl border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  >
                    <LogOut className="mr-2 size-4" />
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    type="button"
                    className="h-11 rounded-xl px-4 text-slate-700 hover:bg-white hover:text-slate-900"
                  >
                    English
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onLogin}
                    className="h-11 rounded-xl border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  >
                    Login / Sign Up
                  </Button>
                </>
              )}
            </div>

            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {mobileMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: PREMIUM_EASE }}
            className="border-b border-slate-200 bg-white/96 backdrop-blur-xl lg:hidden"
          >
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const isActive = isNavItemActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`block rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                        isActive ? "bg-blue-50 text-[#2563EB]" : "text-slate-700 hover:bg-slate-50 hover:text-[#2563EB]"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {renderTextWithShortForms(item.label)}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-4 border-t border-slate-200 pt-4">
                {user ? (
                  <div className="space-y-3">
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800"
                    >
                      {renderUserAvatar("h-10 w-10", "size-5")}
                      <span>{user.name}</span>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={handleLogout}
                      className="h-11 w-full rounded-xl border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                    >
                      <LogOut className="mr-2 size-4" />
                      Logout
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button
                      variant="ghost"
                      type="button"
                      className="h-11 w-full justify-start rounded-xl text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      English
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onLogin();
                      }}
                      className="h-11 w-full justify-start rounded-xl border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                    >
                      <LogIn className="mr-2 size-4" />
                      Login / Sign Up
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
