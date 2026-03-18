import { Button } from "./ui/button";
import {
  BadgeCheck,
  Globe,
  Lock,
  Menu,
  User as UserIcon,
  Shield,
  Users,
  X,
  LogIn,
  LogOut,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { renderTextWithShortForms } from "../utils/shortForms";
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

export function Header({ onLogin }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tickerVisible, setTickerVisible] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const navItems = [
    { to: "/home#features", label: "Features" },
    { to: "/home#tax-updates", label: "Tax Updates" },
    { to: "/chat", label: "AI Chat" },
    { to: "/pricing", label: "Pricing" },
    { to: "/compliance", label: "Compliance" },
    { to: "/calculators", label: "Tax Calculator" },
  ] as const;

  const trustItems = [
    { icon: Shield, label: "256-bit SSL Encrypted", title: "Bank-grade encryption for all data" },
    { icon: BadgeCheck, label: "ICAI Registered CPA", title: "Services by Certified Public Accountants" },
    { icon: Globe, label: "DTAA Compliant", title: "Double Taxation Avoidance compliance" },
    { icon: Lock, label: "SOC 2 Standards", title: "Enterprise security compliance" },
    { icon: Users, label: "500+ NRIs Served", title: "Trusted by global NRI professionals" },
  ] as const;

  const tickerItems = [
    { date: "2025-01-05", region: "India-Singapore", text: "DTAA amendment: Article 12 royalty rates reduced from 15% to 10% effective April 1, 2025", important: true },
    { date: "2025-01-04", region: "India-UAE", text: "Clarification on tax residency certificate requirements for FY 2024-25", important: true },
    { date: "2025-01-02", region: "India-USA", text: "New MLI provisions on Permanent Establishment effective January 1, 2025", important: true },
    { date: "2024-12-28", region: "", text: "Form 15CA/15CB revised procedures for remittances exceeding INR 5 lakh from February 2025", important: false },
  ] as const;

  const isNavItemActive = (to: string) => {
    const [path, hash] = to.split("#");
    if (hash) {
      return location.pathname === path && location.hash === `#${hash}`;
    }
    return location.pathname === path;
  };

  useEffect(() => {
    const dismissed = localStorage.getItem("regulatory-ticker-dismissed");
    if (dismissed === "true") {
      setTickerVisible(false);
    }
  }, []);

  useEffect(() => {
    const loadUser = () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser({
          ...parsedUser,
          profileImage: sanitizeProfileImage(parsedUser?.profileImage),
        });
      } else {
        setUser(null);
      }
    };

    loadUser();

    window.addEventListener("storage", loadUser);
    window.addEventListener("auth-changed", loadUser);
    window.addEventListener("user-updated", loadUser);
    window.addEventListener("focus", loadUser);
    document.addEventListener("visibilitychange", loadUser);

    return () => {
      window.removeEventListener("storage", loadUser);
      window.removeEventListener("auth-changed", loadUser);
      window.removeEventListener("user-updated", loadUser);
      window.removeEventListener("focus", loadUser);
      document.removeEventListener("visibilitychange", loadUser);
    };
  }, []);

  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.profileImage]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("auth-changed"));
    setMobileMenuOpen(false);
    navigate("/", { replace: true });
  };

  const handleDismissTicker = () => {
    setTickerVisible(false);
    localStorage.setItem("regulatory-ticker-dismissed", "true");
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

  return (
    <header className="relative z-50">
      <div className="border-b border-gray-200 bg-white/95 backdrop-blur-md md:hidden">
        <div className="flex h-20 items-center justify-between px-4">
          <Link to="/home" className="inline-flex items-center" aria-label="NRITAX home">
            <img
              src="/logo-transparent.png"
              alt="NRITAX logo"
              className="h-16 w-auto object-contain"
            />
          </Link>

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

      <div className="border-b border-slate-800 bg-slate-900">
        <div className="h-10 overflow-x-auto">
          <div className="mx-auto flex h-full min-w-max max-w-6xl items-center justify-start gap-6 px-4 sm:justify-center">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="group inline-flex cursor-default items-center gap-2.5 whitespace-nowrap text-sm text-slate-200 transition-colors duration-200 hover:text-white"
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

      {tickerVisible && (
        <div className="relative border-b border-slate-700 bg-slate-800 py-2">
          <div className="overflow-hidden">
            <div className="nri-ticker-track flex gap-8 whitespace-nowrap">
              {[...tickerItems, ...tickerItems].map((item, index) => (
                <div key={`${item.date}-${index}`} className="inline-flex items-center gap-2 text-sm text-slate-300">
                  {item.important && (
                    <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">IMPORTANT</span>
                  )}
                  <Globe className="size-4 shrink-0" />
                  <span className="text-xs text-slate-400">{item.date}</span>
                  <span aria-hidden="true" className="text-slate-500">|</span>
                  {item.region && <span className="text-xs font-medium text-blue-400">{item.region}</span>}
                  <span aria-hidden="true" className="text-slate-500">|</span>
                  <span className="text-slate-100">{renderTextWithShortForms(item.text)}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-white"
            aria-label="Dismiss ticker"
            onClick={handleDismissTicker}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="sticky top-0 border-b border-gray-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex h-20 items-center justify-between">
            <Link to="/home" className="inline-flex items-center" aria-label="NRITAX home">
              <img
                src="/logo-transparent.png"
                alt="NRITAX logo"
                className="h-20 w-auto scale-110 object-contain sm:h-24"
              />
            </Link>

            <nav className="hidden items-center gap-3 md:flex">
              {navItems.map((item) => {
                const isActive = isNavItemActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`rounded px-4 py-2 text-base font-medium transition-colors ${
                      isActive ? "text-blue-700" : "text-slate-900 hover:text-blue-700"
                    }`}
                  >
                    {renderTextWithShortForms(item.label)}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden items-center gap-4 md:flex">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="flex items-center gap-3 text-base font-medium text-slate-700 transition-colors hover:text-blue-700"
                    aria-label="Open profile"
                    title="Open profile"
                  >
                    {renderUserAvatar("h-11 w-11", "size-5")}
                    <span>Hello, {user.name}</span>
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
      </div>

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
                      className={`block rounded-md px-3 py-2.5 text-base font-medium transition-colors ${
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
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium text-slate-800 transition-colors hover:bg-gray-100 hover:text-blue-700"
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



