import { useEffect, useState } from "react";
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

export default function NewsTicker() {
  const [banners, setBanners] = useState<Banner[]>([]);

  const normalizeBanner = (item: Banner): Banner => ({
    ...item,
    label: item.label?.trim() || "DTAA UPDATE",
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

  useEffect(() => {
    async function fetchBanner() {
      try {
        const response = await fetch("https://www.nritax.ai/api/banner-updates", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Banner API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          console.error("Banner API did not return an array:", data);
          setBanners([]);
          return;
        }

        const activeBanners = data
          .filter((item: Banner) => item && item.active === true)
          .map((item: Banner) => normalizeBanner(item))
          .sort((a: Banner, b: Banner) => (a.priority ?? 9999) - (b.priority ?? 9999));

        setBanners(activeBanners);
      } catch (error) {
        console.error("Failed to load banner:", error);
        setBanners([]);
      }
    }

    fetchBanner();
  }, []);

  if (banners.length === 0) return null;

  const renderTickerItem = (banner: Banner, index: number, groupIndex: number) => (
    <div
      key={`${groupIndex}-${banner.title}-${banner.date}-${index}`}
      className="inline-flex shrink-0 items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-2 shadow-sm whitespace-nowrap"
    >
      <span className="shrink-0 rounded-md bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
        {banner.label || "INTERNATIONAL TAX ALERT"}
      </span>

      <span className="text-sm font-semibold text-slate-700">
        {renderTextWithShortForms(banner.country || "Cross-Border")}
      </span>

      <span className="text-slate-300">|</span>

      <span className="text-sm text-slate-600">
        {renderTextWithShortForms(banner.type || "Tax Update")}
      </span>

      <span className="text-slate-300">|</span>

      <a
        href={banner.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="max-w-[34rem] text-sm font-medium text-slate-900 hover:underline"
      >
        {renderTextWithShortForms(
          banner.summary || banner.title || "View regulatory update",
        )}
      </a>

      {banner.date ? (
        <>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500">
            {formatBannerDate(banner.date)}
          </span>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="overflow-hidden border-y border-slate-200 bg-slate-50">
      <div className="nri-ticker-track flex w-max items-center gap-8 py-3 hover:[animation-play-state:paused]">
        {banners.map((banner, index) => renderTickerItem(banner, index, 0))}
        <div className="w-8 shrink-0" />
        {banners.map((banner, index) => renderTickerItem(banner, index, 1))}
      </div>
    </div>
  );
}
