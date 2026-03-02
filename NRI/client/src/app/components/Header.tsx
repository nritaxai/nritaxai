import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Globe, Menu, LogIn, LogOut, Calculator } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

interface HeaderProps {
  onAskAI: () => void;
  onLogin: () => void;
}

interface User {
  name: string;
  email: string;
}

export function Header({ onAskAI, onLogin }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [language, setLanguage] = useState("en");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const navItems = [
    { to: "/home#features", label: "Features" },
    { to: "/home#updates", label: "Tax Updates" },
    { to: "/home#ai-chat", label: "AI Chat" },
    { to: "/pricing", label: "Pricing" },
    { to: "/home#compliance", label: "Compliance" },
    { to: "/calculators", label: "Tax Calculator", icon: Calculator },
  ] as const;

  const isNavItemActive = (to: string) => {
    const [path, hash] = to.split("#");
    if (hash) {
      return location.pathname === path && location.hash === `#${hash}`;
    }
    return location.pathname === path;
  };

  useEffect(() => {
    const loadUser = () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        setUser(null);
      }
    };

    loadUser();

    window.addEventListener("storage", loadUser);
    window.addEventListener("auth-changed", loadUser);

    return () => {
      window.removeEventListener("storage", loadUser);
      window.removeEventListener("auth-changed", loadUser);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("auth-changed"));
    setMobileMenuOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Globe className="size-8 text-blue-600" />
            <span className="text-xl">
              NRITAX<span className="text-blue-600">.AI</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="relative px-2 py-1 text-gray-700 hover:text-blue-600 transition-colors"
                >
                  {isActive && (
                    <motion.span
                      layoutId="active-nav-pill"
                      className="absolute inset-0 -z-10 rounded-md bg-blue-100/70"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <span className="flex items-center gap-1.5">
                    {Icon ? <Icon className="size-4" /> : null}
                    {item.label}
                  </span>
                </Link>
              );
            })}

            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिन्दी</SelectItem>
                <SelectItem value="ta">தமிழ்</SelectItem>
                <SelectItem value="gu">ગુજરાતી</SelectItem>
              </SelectContent>
            </Select>

            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/profile" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                  Hello, {user.name}
                </Link>
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="size-4 mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={onLogin}>
                <LogIn className="size-4 mr-2" />
                Login / Sign Up
              </Button>
            )}
          </nav>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <Menu className="size-6" />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden py-4 space-y-3"
            >
              {navItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                  >
                    <Link
                      to={item.to}
                      className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {Icon ? <Icon className="size-4" /> : null}
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}

              <div className="pt-2">
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">हिन्दी</SelectItem>
                    <SelectItem value="ta">தமிழ்</SelectItem>
                    <SelectItem value="gu">ગુજરાતી</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {user ? (
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full"
                >
                  <LogOut className="size-4 mr-2" />
                  Logout
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogin();
                  }}
                  className="w-full"
                >
                  <LogIn className="size-4 mr-2" />
                  Login / Sign Up
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
