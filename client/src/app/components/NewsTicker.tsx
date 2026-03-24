import { useEffect, useMemo, useState } from "react";
import { renderTextWithShortForms } from "../utils/shortForms";

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

const BANNER_API_URL = "https://www.nritax.ai/api/banner-updates";

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
  active: item.active === true,
  priority: item.priority ?? 9999,
});

const formatBannerDate = (value?: string) => {
  if (!value) return "";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return parsedDate.toLocaleDateString();
};

const extractBannerItems = (payload: unknown): Banner[] => {
  if (Array.isArray(payload)) {
    return payload as Banner[];
  }

  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { updates?: unknown }).updates)
  ) {
    return (payload as { updates: Banner[] }).updates;
  }

  return [];
};

export default function NewsTicker() {
  const [items, setItems] = useState<Banner[]>([]);

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

        const payload = await response.json();
        const extractedItems = extractBannerItems(payload);

        if (!Array.isArray(extractedItems)) {
          console.error("Banner API payload did not contain a valid updates array:", payload);
          setItems([]);
          return;
        }

        const nextItems = extractedItems
          .filter((item) => item && item.active === true)
          .map(normalizeBanner)
          .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));

        setItems(nextItems);
      } catch (error) {
        console.error("Failed to load banner:", error);
        setItems([]);
      }
    }

    void fetchBannerUpdates();
  }, []);

  const loopItems = useMemo(() => [...items, ...items], [items]);

  if (items.length === 0) return null;

  return (
    <div className="w-full overflow-hidden border-y border-slate-200 bg-slate-50">
      <div className="nri-ticker-track flex w-max items-center gap-8 py-3 pr-8 hover:[animation-play-state:paused] md:gap-10 md:py-3.5 md:pr-10">
        {loopItems.map((item, index) => {
          const key = `${item.title}-${item.country}-${item.date}-${index}`;

          return (
            <div
              key={key}
              className="inline-flex shrink-0 items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-2 shadow-sm whitespace-nowrap"
            >
              <span className="shrink-0 rounded-md bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                {renderTextWithShortForms(item.label || "INTERNATIONAL TAX ALERT")}
              </span>

              <span className="text-sm font-semibold text-slate-700">
                {renderTextWithShortForms(item.country || "Cross-Border")}
              </span>

              <span className="mx-1 text-slate-300">|</span>

              <span className="text-sm text-slate-600">
                {renderTextWithShortForms(item.type || "Tax Update")}
              </span>

              <span className="mx-1 text-slate-300">|</span>

              <a
                href={item.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[30rem] text-sm font-medium text-slate-900 hover:underline"
              >
                {renderTextWithShortForms(
                  item.title || item.summary || "View regulatory update",
                )}
              </a>

              {item.date ? (
                <>
                  <span className="mx-1 text-slate-300">|</span>
                  <span className="ml-1 text-xs text-slate-500">
                    {formatBannerDate(item.date)}
                  </span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
