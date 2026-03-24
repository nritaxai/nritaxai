import { Fragment, useEffect, useState } from "react";
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

  return (
    <div className="w-full border-y border-slate-300/80 bg-[linear-gradient(90deg,rgba(247,250,252,0.98),rgba(239,244,248,0.98),rgba(247,250,252,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="mx-auto max-w-7xl overflow-hidden px-4 py-3">
        <div className="nri-ticker-track flex min-w-max items-center whitespace-nowrap">
          {[0, 1].map((groupIndex) => (
            <div
              key={groupIndex}
              aria-hidden={groupIndex === 1}
              className="flex shrink-0 items-center gap-5 pr-5"
            >
              {banners.map((banner, index) => (
                <Fragment key={`${groupIndex}-${banner.title}-${banner.date}-${index}`}>
                  <a
                    href={banner.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex min-w-max items-center gap-3 rounded-xl border border-slate-300/80 bg-white/90 px-3 py-2.5 text-left text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-colors hover:border-slate-400 hover:bg-slate-50"
                  >
                    <span className="rounded-sm border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                      {banner.label || "DTAA UPDATE"}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                      {renderTextWithShortForms(banner.country || "Cross-Border")}
                    </span>
                    <span className="h-4 w-px bg-slate-300" aria-hidden="true" />
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-600">
                      {renderTextWithShortForms(banner.type || "Tax Update")}
                    </span>
                    {banner.date ? (
                      <>
                        <span className="h-4 w-px bg-slate-300" aria-hidden="true" />
                        <span className="text-xs font-medium text-slate-500">
                          {formatBannerDate(banner.date)}
                        </span>
                      </>
                    ) : null}
                    <span className="h-4 w-px bg-slate-300" aria-hidden="true" />
                    <span className="rounded-sm bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                      Source: {renderTextWithShortForms(banner.source || "NRITAX Research")}
                    </span>
                    <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                      {renderTextWithShortForms(banner.confidence || "Advisory")}
                    </span>
                    <span className="max-w-[30rem] text-sm font-medium leading-5 text-slate-900 underline-offset-4 group-hover:underline">
                      {renderTextWithShortForms(
                        banner.summary || banner.title || "View regulatory update",
                      )}
                    </span>
                  </a>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    regulatory feed
                  </span>
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
