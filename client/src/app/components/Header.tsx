import { Button } from "./ui/button";
import {
  ChevronLeft,
  Globe,
  Lock,
  Menu,
  User as UserIcon,
  Shield,
  Users,
  LogIn,
  LogOut,
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

  const trustItems = [
    { icon: Shield, label: "256-bit SSL Encrypted", title: "Bank-grade encryption for all data" },
    { icon: Globe, label: "DTAA Compliant", title: "Double Taxation Avoidance compliance" },
    { icon: Lock, label: "SOC 2 Standards", title: "Enterprise security compliance" },
    { icon: Users, label: "500+ NRIs Served", title: "Trusted by global NRI professionals" },
  ] as const;

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
      setHasScrolled(window.scrollY > 12);
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
    <span className={`inline-flex items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-sm ${sizeClass}`}>
      {user?.profileImage && !avatarFailed ? (
        <img
          key={user.profileImage}
          src={user.profileImage}
          alt={user.name}
          className="h-full w-full object-cover"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <UserIcon className={`${iconSizeClass} text-slate-500`} />
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
    <header className="relative z-50">
      <div className="border-b border-gray-200 bg-white/95 backdrop-blur-md md:hidden">
        <div className="flex h-20 items-center justify-between px-4">
          <Link to="/home" className="inline-flex items-center" aria-label="NRITAX home">
            <img
              src="/logo-transparent.png"
              alt="NRITAX logo"
              className="h-18 w-auto scale-110 object-contain sm:h-20"
            />
          </Link>

          <div className="-ml-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleGoBack}
              aria-label="Go back"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              className="rounded-md p-2 text-slate-800 transition-colors hover:text-blue-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="size-6" />
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-800 bg-slate-900">
        <div className="h-10 overflow-x-auto">
          <div className="mx-auto flex h-full min-w-max max-w-6xl items-center justify-start gap-6 px-4 sm:justify-center">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="group inline-flex cursor-default items-center gap-2.5 whitespace-nowrap text-sm font-medium text-slate-200 transition-colors duration-200 hover:text-white"
                  title={item.title}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{renderTextWithShortForms(item.label)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <motion.div
        animate={{
          backgroundColor: hasScrolled ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.90)",
          boxShadow: hasScrolled ? "0 10px 30px rgba(15, 23, 42, 0.08)" : "0 0 0 rgba(15, 23, 42, 0)",
        }}
        transition={{ duration: 0.3, ease: PREMIUM_EASE }}
        className="sticky top-0 border-b border-gray-200 backdrop-blur-md"
      >
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex h-20 items-center justify-between">
            <div className="ml-1 flex items-center gap-5">
              <button
                type="button"
                onClick={handleGoBack}
                aria-label="Go back"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <ChevronLeft className="size-5" />
              </button>
              <Link to="/home" className="ml-2 inline-flex items-center" aria-label="NRITAX home">
                <img
                  src="/logo-transparent.png"
                  alt="NRITAX logo"
                  className="h-22 w-auto scale-[1.18] object-contain sm:h-28"
                />
              </Link>
            </div>

            <nav className="hidden items-center gap-3 md:flex">
              {navItems.map((item) => {
                const isActive = isNavItemActive(item.to);
                return (
                  <motion.div
                    key={item.to}
                    whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                    transition={{ duration: 0.2, ease: PREMIUM_EASE }}
                  >
                    <Link
                      to={item.to}
                      className={`relative rounded px-4 py-2 text-sm font-medium transition-colors ${
                        isActive ? "text-blue-700" : "text-slate-900 hover:text-blue-700"
                      }`}
                    >
                      {renderTextWithShortForms(item.label)}
                      <motion.span
                        className="absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-blue-600"
                        initial={false}
                        animate={{ scaleX: isActive ? 1 : 0.45, opacity: isActive ? 1 : 0 }}
                        whileHover={shouldReduceMotion ? undefined : { scaleX: 1, opacity: 1 }}
                        transition={{ duration: 0.22, ease: PREMIUM_EASE }}
                        style={{ originX: 0.5 }}
                      />
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="hidden items-center gap-4 md:flex">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="flex items-center gap-3 text-sm font-medium text-slate-700 transition-colors hover:text-blue-700"
                    aria-label="Open profile"
                    title="Open profile"
                  >
                    {renderUserAvatar("h-11 w-11", "size-5")}
                    <span>WELCOME! {user.name}</span>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="h-10 border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
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
                    className="h-10 px-4 text-slate-800 hover:bg-slate-100 hover:text-slate-900"
                  >
                    English
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={onLogin}
                    className="h-10 px-4 text-slate-800 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Login / Sign Up
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="border-b border-gray-200 bg-white py-4 md:hidden"
          >
            <div className="mx-auto max-w-6xl px-4">
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = isNavItemActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive ? "bg-blue-50 text-blue-700" : "text-slate-800 hover:bg-gray-100 hover:text-blue-700"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {renderTextWithShortForms(item.label)}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                {user ? (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-gray-100 hover:text-blue-700"
                    >
                      {renderUserAvatar("h-10 w-10", "size-5")}
                      <span>{user.name}</span>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={handleLogout}
                      className="w-full border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
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
                      className="w-full justify-start text-slate-800 hover:bg-gray-100 hover:text-slate-900"
                    >
                      English
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onLogin();
                      }}
                      className="w-full justify-start text-slate-800 hover:bg-gray-100 hover:text-slate-900"
                    >
                      <LogIn className="mr-2 size-4" />
                      Login / Sign Up
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}



