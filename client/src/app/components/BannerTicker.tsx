import { useEffect, useState } from "react";
import { getBannerUpdates } from "../../utils/api";
import type { BannerUpdate } from "../../utils/api";
import { renderTextWithShortForms } from "../utils/shortForms";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const sortBannerUpdates = (items: BannerUpdate[]) =>
  [...items].sort((a, b) => Number(a?.priority ?? Number.MAX_SAFE_INTEGER) - Number(b?.priority ?? Number.MAX_SAFE_INTEGER));

const formatBannerHref = (url: string) => {
  if (!url || url === "#") return "#";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return url.startsWith("/") ? url : `/${url}`;
};

const formatBannerDate = (value?: string) => {
  if (!value) return "";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsedDate);
};

export function BannerTicker() {
  const [bannerItem, setBannerItem] = useState<BannerUpdate | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBannerUpdates = async () => {
      try {
        const response = await getBannerUpdates();
        if (cancelled) return;

        const nextItem = Array.isArray(response)
          ? sortBannerUpdates(response.filter((item) => item?.active === true))[0] ?? null
          : null;

        setBannerItem(nextItem);
      } catch (error) {
        if (cancelled) return;
        console.error("[banner] failed to load banner updates", error);
        setBannerItem(null);
      }
    };

    void loadBannerUpdates();
    const intervalId = window.setInterval(() => {
      void loadBannerUpdates();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (!bannerItem) return null;

  const href = formatBannerHref(bannerItem.url);
  const bannerDate = formatBannerDate(bannerItem.date);
  const isExternal = href.startsWith("http://") || href.startsWith("https://");
  const title = renderTextWithShortForms(bannerItem.title);

  return (
    <section className="border-b border-slate-800/80 bg-[#0b1f3a] text-white shadow-[0_10px_24px_rgba(3,7,18,0.18)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 md:px-6">
        {bannerItem.label ? (
          <span className="w-fit rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950 sm:text-[11px]">
            {bannerItem.label}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <a
            href={href}
            className="inline text-sm font-medium text-white underline decoration-white/35 underline-offset-4 transition-colors hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:text-base"
            title={bannerItem.title}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noreferrer" : undefined}
          >
            {title}
          </a>
        </div>

        {bannerDate ? (
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300 sm:text-[11px]">
            {bannerDate}
          </div>
        ) : null}
      </div>
    </section>
  );
}
