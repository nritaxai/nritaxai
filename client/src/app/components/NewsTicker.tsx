import { Fragment, useEffect, useMemo, useState } from "react";
import { renderTextWithShortForms } from "../utils/shortForms";
import { BANNER_API_BASE_URL } from "../../config/appConfig";

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
      label: "INTERNATIONAL TAX ALERT",
      title: "Expert-reviewed NRI tax updates available",
      summary: "Stay updated with cross-border tax and DTAA developments.",
      country: "India",
      type: "Tax Update",
      date: new Date().toISOString().split("T")[0],
      source: "NRITAX Research",
      confidence: "Advisory",
      url: "/home#tax-updates",
      active: true,
      priority: 1,
    },
  ],
};

const normalizeBanner = (item: Banner): Banner => ({
  ...item,
  label: item.label?.trim() || "INTERNATIONAL TAX ALERT",
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

  return parsedDate.toLocaleDateString();
};

export default function NewsTicker() {
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
          if (cachedBanner) {
            setItems(cachedBanner.updates);
            return;
          }

          setItems(normalizeBannerPayload(fallbackBanner).updates);
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

  const loopItems = useMemo(() => [...items, ...items], [items]);

  if (items.length === 0) return null;

  return (
    <div className="w-full overflow-hidden border-y border-slate-200 bg-slate-50">
      <div className="nri-ticker-track flex w-max min-w-max items-center gap-8 py-3 pr-8 hover:[animation-play-state:paused] md:gap-10 md:py-3.5 md:pr-10">
        {loopItems.map((item, index) => {
          const key = `${item.title}-${item.country}-${item.date}-${index}`;
          const isLoopDivider = index === items.length;

          return (
            <Fragment key={key}>
              {isLoopDivider ? <div className="h-px w-24 shrink-0 md:w-32" aria-hidden="true" /> : null}
              <div className="inline-flex shrink-0 items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm whitespace-nowrap">
                <span className="shrink-0 rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  {renderTextWithShortForms(item.label || "INTERNATIONAL TAX ALERT")}
                </span>

                <span className="shrink-0 text-sm font-medium text-slate-700">
                  {renderTextWithShortForms(item.country || "Cross-Border")}
                </span>

                <span className="mx-1 shrink-0 text-slate-300">|</span>

                <span className="shrink-0 text-sm font-normal text-slate-600">
                  {renderTextWithShortForms(item.type || "Tax Update")}
                </span>

                <span className="mx-1 shrink-0 text-slate-300">|</span>

                <a
                  href={item.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-slate-900 hover:underline md:max-w-[420px]"
                >
                  {renderTextWithShortForms(
                    item.title || item.summary || "View regulatory update",
                  )}
                </a>

                {item.date ? (
                  <>
                    <span className="mx-1 shrink-0 text-slate-300">|</span>
                    <span className="shrink-0 text-xs font-normal text-slate-500">
                      {formatBannerDate(item.date)}
                    </span>
                  </>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
