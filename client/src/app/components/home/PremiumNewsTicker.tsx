import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { renderTextWithShortForms } from "../../utils/shortForms";
import { BANNER_API_BASE_URL } from "../../../config/appConfig";
import { PREMIUM_EASE } from "../../utils/motion";

type Banner = {
  label?: string;
  title?: string;
  summary?: string;
  country?: string;
  type?: string;
  date?: string;
  url?: string;
  source?: string;
  confidence?: string;
  active?: boolean;
  priority?: number;
};

type BannerPayload = {
  updates: Banner[];
};

const BANNER_CACHE_KEY = "homepage-banner-cache";
const BANNER_API_URL = `${BANNER_API_BASE_URL}/api/banner-updates`;

const fallbackBanner: BannerPayload = {
  updates: [
    {
      label: "DTAA ALERT",
      title: "India-UAE capital gains clarification updated for cross-border filing reviews",
      country: "India-UAE",
      type: "Treaty Guidance",
      date: new Date().toISOString().split("T")[0],
      source: "NRITAX Research",
      confidence: "Verified",
      url: "/home#tax-updates",
      active: true,
      priority: 1,
    },
    {
      label: "FEMA UPDATE",
      title: "RBI overseas remittance documentation guidance refined for NRI fund transfers",
      country: "India",
      type: "Remittance Rules",
      date: new Date().toISOString().split("T")[0],
      source: "RBI Watch",
      confidence: "Monitored",
      url: "/home#tax-updates",
      active: true,
      priority: 2,
    },
    {
      label: "CBDT NOTICE",
      title: "Documentation expectations refreshed for treaty relief, TRC, and Form 10F workflows",
      country: "India",
      type: "Compliance",
      date: new Date().toISOString().split("T")[0],
      source: "CBDT",
      confidence: "Authoritative",
      url: "/home#tax-updates",
      active: true,
      priority: 3,
    },
    {
      label: "GLOBAL TAX",
      title: "Cross-border withholding reviews tightened for salary, interest, and property proceeds",
      country: "Multi-country",
      type: "Intelligence",
      date: new Date().toISOString().split("T")[0],
      source: "Advisory Desk",
      confidence: "Reviewed",
      url: "/home#tax-updates",
      active: true,
      priority: 4,
    },
  ],
};

const normalizeBanner = (item: Banner): Banner => ({
  ...item,
  label: item.label?.trim() || "GLOBAL TAX",
  title: item.title?.trim() || item.summary?.trim() || "View regulatory update",
  summary: item.summary?.trim() || item.title?.trim() || "View regulatory update",
  country: item.country?.trim() || "Cross-Border",
  type: item.type?.trim() || "Tax Update",
  date: item.date,
  url: item.url?.trim() || "#",
  source: item.source?.trim() || "NRITAX Research",
  confidence: item.confidence?.trim() || "Advisory",
  active: item.active !== false,
  priority: item.priority ?? 9999,
});

const isValidBannerPayload = (data: unknown): data is BannerPayload => {
  if (!data || typeof data !== "object") return false;
  return Array.isArray((data as BannerPayload).updates) && (data as BannerPayload).updates.length > 0;
};

const normalizeBannerPayload = (data: BannerPayload): BannerPayload => ({
  ...data,
  updates: data.updates
    .filter(Boolean)
    .map(normalizeBanner)
    .filter((item) => item.active !== false)
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999)),
});

const getCachedBanner = (): BannerPayload | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(BANNER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BannerPayload;
    return isValidBannerPayload(parsed) ? normalizeBannerPayload(parsed) : null;
  } catch {
    return null;
  }
};

const setCachedBanner = (data: BannerPayload) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(data));
  } catch {}
};

const formatBannerDate = (value?: string) => {
  if (!value) return "";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return parsedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const getCategoryTone = (label?: string) => {
  const normalized = (label || "").toUpperCase();

  if (normalized.includes("DTAA")) {
    return "border-cyan-200/70 bg-cyan-100 text-cyan-950 shadow-[0_0_20px_rgba(34,211,238,0.12)]";
  }

  if (normalized.includes("FEMA") || normalized.includes("RBI")) {
    return "border-emerald-200/70 bg-emerald-100 text-emerald-950 shadow-[0_0_20px_rgba(16,185,129,0.12)]";
  }

  if (normalized.includes("CBDT")) {
    return "border-amber-200/80 bg-amber-100 text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.12)]";
  }

  if (normalized.includes("NRI")) {
    return "border-amber-200/80 bg-amber-100 text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.12)]";
  }

  return "border-sky-200/80 bg-sky-100 text-sky-950 shadow-[0_0_18px_rgba(56,189,248,0.10)]";
};

function TickerItem({ item, clone = false }: { item: Banner; clone?: boolean }) {
  const headline = renderTextWithShortForms(item.title || item.summary || "View regulatory update");
  const itemLabel = renderTextWithShortForms(item.label || "GLOBAL TAX");
  const itemCountry = renderTextWithShortForms(item.country || "Cross-Border");
  const itemType = renderTextWithShortForms(item.type || "Tax Update");
  const tone = getCategoryTone(item.label);
  const href = item.url || "#";

  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="group/item inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-slate-200/14 bg-white/[0.10] px-3 pr-3.5 text-sm text-white shadow-[0_16px_34px_rgba(2,6,23,0.22),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-cyan-200/42 hover:bg-white/[0.16] hover:shadow-[0_18px_40px_rgba(15,23,42,0.32),0_0_0_1px_rgba(148,163,184,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
      tabIndex={clone ? -1 : undefined}
      aria-hidden={clone || undefined}
    >
      <span
        className={`inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone} transition-transform duration-300 group-hover/item:scale-[1.02]`}
      >
        {itemLabel}
      </span>
      <span className="max-w-[190px] truncate text-[13px] font-semibold text-slate-50 md:max-w-[360px]">
        {headline}
      </span>
      <span className="hidden h-1 w-1 shrink-0 rounded-full bg-white/22 sm:inline-flex" aria-hidden="true" />
      <span className="hidden shrink-0 rounded-full border border-white/14 bg-white/[0.14] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white sm:inline-flex">
        {itemCountry}
      </span>
      <span className="hidden text-[11px] font-medium text-cyan-50 lg:inline-flex">
        {itemType}
      </span>
      {item.date ? (
        <span className="hidden text-[11px] font-medium text-slate-200 xl:inline-flex">
          {formatBannerDate(item.date)}
        </span>
      ) : null}
    </a>
  );
}

export default function PremiumNewsTicker() {
  const shouldReduceMotion = useReducedMotion();
  const [items, setItems] = useState<Banner[]>(() => {
    const cachedBanner = getCachedBanner();
    if (cachedBanner) return cachedBanner.updates;
    return normalizeBannerPayload(fallbackBanner).updates;
  });

  useEffect(() => {
    async function fetchBannerUpdates() {
      try {
        const response = await fetch(BANNER_API_URL, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Banner API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const payload = Array.isArray(data) ? { updates: data as Banner[] } : (data as BannerPayload);

        if (!isValidBannerPayload(payload)) {
          const cachedBanner = getCachedBanner();
          setItems(cachedBanner?.updates || normalizeBannerPayload(fallbackBanner).updates);
          return;
        }

        const normalizedPayload = normalizeBannerPayload(payload);
        if (!normalizedPayload.updates.length) {
          const cachedBanner = getCachedBanner();
          setItems(cachedBanner?.updates || normalizeBannerPayload(fallbackBanner).updates);
          return;
        }

        setCachedBanner(normalizedPayload);
        setItems(normalizedPayload.updates);
      } catch (error) {
        console.error("Failed to load banner:", error);
        const cachedBanner = getCachedBanner();
        setItems(cachedBanner?.updates || normalizeBannerPayload(fallbackBanner).updates);
      }
    }

    void fetchBannerUpdates();
  }, []);

  const animationDuration = useMemo(() => `${Math.max(24, items.length * 8)}s`, [items.length]);

  if (items.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.45, ease: PREMIUM_EASE }}
      aria-label="Live tax intelligence updates"
      className="relative z-40 w-full border-b border-slate-200/12 bg-[linear-gradient(90deg,#111827_0%,#172033_52%,#1e293b_100%)] shadow-[0_18px_48px_rgba(2,6,23,0.22)] backdrop-blur-xl"
    >
      <style>{`
        @keyframes premium-news-ticker-scroll {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-200/25 to-transparent" aria-hidden="true" />
      <div className="mx-auto flex min-h-[56px] max-w-6xl items-center gap-3 px-4 md:px-6">
        <div className="hidden shrink-0 items-center gap-2 rounded-full border border-cyan-200/12 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:inline-flex">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/55 motion-reduce:hidden" />
            <span className="relative inline-flex size-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.85)]" />
          </span>
          Live Tax Updates
        </div>

        <div className="relative flex min-w-0 flex-1 items-center overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#0F172A] via-[#0F172A]/80 to-transparent" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#1E293B] via-[#1E293B]/80 to-transparent" aria-hidden="true" />

          {shouldReduceMotion ? (
            <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-3 overflow-x-auto py-1.5">
              {items.map((item) => (
                <TickerItem key={`${item.title}-${item.country}-${item.date}`} item={item} />
              ))}
            </div>
          ) : (
            <div
              className="flex w-max min-w-max items-center gap-3 py-1.5 hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
              style={{
                animationName: "premium-news-ticker-scroll",
                animationDuration,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                willChange: "transform",
              }}
            >
              {[0, 1].map((cloneIndex) => (
                <div
                  key={cloneIndex}
                  className="flex shrink-0 items-center gap-3 pr-3"
                  aria-hidden={cloneIndex === 1 || undefined}
                >
                  {items.map((item) => (
                    <TickerItem
                      key={`${cloneIndex}-${item.title}-${item.country}-${item.date}`}
                      item={item}
                      clone={cloneIndex === 1}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
