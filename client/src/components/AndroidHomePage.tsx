import { Capacitor } from "@capacitor/core";
import {
  ArrowRight,
  Bot,
  Calculator,
  ChevronRight,
  Globe2,
  MessageSquare,
  Shield,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getStoredAuthToken } from "../utils/api";

interface AndroidHomePageProps {
  onRequireLogin: () => void;
}

type QuickAction = {
  title: string;
  subtitle: string;
  icon: typeof Bot;
  to: string;
  protected: boolean;
  accent: string;
  iconBg: string;
};

type Category = {
  label: string;
  caption: string;
  icon: typeof Globe2;
};

type StatItem = {
  title: string;
  value: string;
  detail: string;
  icon: typeof Trophy;
};

const quickActions: QuickAction[] = [
  {
    title: "AI Chat",
    subtitle: "Tax help instantly",
    icon: Bot,
    to: "/chat",
    protected: true,
    accent: "from-[#1a3cff] to-[#4f6bff]",
    iconBg: "bg-[#e8edff]",
  },
  {
    title: "Consult CPA",
    subtitle: "Talk to an expert",
    icon: UserCheck,
    to: "/consult",
    protected: true,
    accent: "from-[#f97316] to-[#fb923c]",
    iconBg: "bg-[#fff1e8]",
  },
  {
    title: "Calculators",
    subtitle: "Estimate taxes",
    icon: Calculator,
    to: "/calculators",
    protected: true,
    accent: "from-[#111827] to-[#374151]",
    iconBg: "bg-[#f1f5f9]",
  },
  {
    title: "Join Expert",
    subtitle: "Partner with NRITAX",
    icon: Shield,
    to: "/join-as-expert",
    protected: false,
    accent: "from-[#7c3aed] to-[#a855f7]",
    iconBg: "bg-[#f3e8ff]",
  },
];

const categories: Category[] = [
  { label: "DTAA", caption: "Treaty guidance", icon: Globe2 },
  { label: "ITR Filing", caption: "Return support", icon: ShieldCheck },
  { label: "Tax Saving", caption: "Smart planning", icon: Sparkles },
  { label: "NRI Residency", caption: "Status checks", icon: Globe2 },
];

const statItems: StatItem[] = [
  { title: "Tax Savings", value: "2.5Cr+", detail: "Estimated savings unlocked for NRI users", icon: Trophy },
  { title: "AI Availability", value: "24/7", detail: "Always-on guidance across time zones", icon: Bot },
  { title: "Languages", value: "4", detail: "English, Hindi, Tamil, Bahasa Indonesia", icon: Globe2 },
  { title: "Response Time", value: "<2 min", detail: "Fast answers when questions are urgent", icon: Timer },
];

const recentUpdates = [
  {
    title: "DTAA Treaty Updates 2024",
    description: "Latest NRI tax rule changes and compliance reminders in one place.",
  },
  {
    title: "Quarterly Filing Checklist",
    description: "Track your documents before return filing and remittance deadlines.",
  },
];

const getFirstName = (value: string) => value.trim().split(/\s+/)[0] || "";

const getGreetingLabel = (hour: number) => {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

export default function AndroidHomePage({ onRequireLogin }: AndroidHomePageProps) {
  const isNative = Capacitor.isNativePlatform(); // Android only
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const syncUser = () => {
      try {
        const rawUser = localStorage.getItem("user");
        if (!rawUser) {
          setUserName("");
          return;
        }

        const parsedUser = JSON.parse(rawUser);
        setUserName(typeof parsedUser?.name === "string" ? parsedUser.name.trim() : "");
      } catch {
        setUserName("");
      }
    };

    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("auth-changed", syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("auth-changed", syncUser);
    };
  }, []);

  const greeting = useMemo(() => {
    if (!userName) return "Welcome to NRITAX.AI";
    return `${getGreetingLabel(new Date().getHours())}, ${getFirstName(userName)}!`;
  }, [userName]);

  if (!isNative) {
    return null; // Android only
  }

  const handleNavigate = (to: string, requiresAuth = false) => {
    if (requiresAuth && !getStoredAuthToken()) {
      onRequireLogin();
      return;
    }

    navigate(to);
  };

  return (
    <main className="min-h-[100dvh] bg-transparent text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-8 pt-4">
        <section className="rounded-[24px] border border-white/10 bg-[#132040]/88 px-5 py-5 shadow-[0_8px_24px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[22px] font-bold leading-tight text-white">{greeting}</p>
              <p className="mt-2 text-sm text-white/65">Your AI Tax Assistant for faster NRI decisions.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold text-[#60a5fa]">
              NRITAX.AI
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Explore categories</h2>
            <button
              type="button"
              onClick={() => handleNavigate("/chat", true)}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#60a5fa]"
            >
              Open chat
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <div className="flex min-w-max gap-3">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.label}
                    type="button"
                    onClick={() => handleNavigate("/chat", true)}
                    className="flex min-w-[148px] items-center gap-3 rounded-[18px] border border-white/10 bg-[#132040]/88 px-4 py-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-transform duration-150 active:scale-[0.98]"
                  >
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-white/8 text-[#60a5fa]">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{category.label}</p>
                      <p className="text-xs text-white/60">{category.caption}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => handleNavigate(action.to, action.protected)}
                  className="group flex min-h-[112px] flex-col justify-between rounded-2xl border border-white/10 bg-[#132040]/88 p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-transform duration-150 active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between">
                    <div className={`flex size-12 items-center justify-center rounded-2xl ${action.iconBg}`}>
                      <Icon className="size-7 text-white" />
                    </div>
                    <div className={`h-2.5 w-10 rounded-full bg-gradient-to-r ${action.accent}`} />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-white">{action.title}</p>
                    <p className="mt-1 text-xs text-white/60">{action.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Why NRI Tax AI?</h2>
          <div className="space-y-3">
            {statItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-center gap-4 rounded-xl border border-white/10 border-l-4 border-l-[#2563eb] bg-[#132040]/88 px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/8 text-[#60a5fa]">
                    <Icon className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[18px] font-bold text-white">{item.value}</p>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-white/60">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Recent updates</h2>
            <button
              type="button"
              onClick={() => handleNavigate("/pricing")}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#60a5fa]"
            >
              View more
              <ArrowRight className="size-4" />
            </button>
          </div>
          <div className="space-y-3">
            {recentUpdates.map((update) => (
              <button
                key={update.title}
                type="button"
                onClick={() => handleNavigate("/chat", true)}
                className="w-full rounded-2xl border border-white/10 bg-[#132040]/88 p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-transform duration-150 active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-white/8 text-[#60a5fa]">
                    <MessageSquare className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{update.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/60">{update.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
