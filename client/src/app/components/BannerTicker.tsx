import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getBannerUpdates } from "../../utils/api";
import type { BannerUpdate } from "../../utils/api";
import { renderTextWithShortForms } from "../utils/shortForms";

const DISMISS_KEY = "regulatory-ticker-dismissed";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const sortBannerUpdates = (items: BannerUpdate[]) =>
  [...items].sort((a, b) => {
    const priorityDelta = Number(a?.priority || 0) - Number(b?.priority || 0);
    if (priorityDelta !== 0) return priorityDelta;
    return Date.parse(String(b?.date || "")) - Date.parse(String(a?.date || ""));
  });

const formatBannerHref = (url: string) => {
  if (!url || url === "#") return "#";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return url.startsWith("/") ? url : `/${url}`;
};

export function BannerTicker() {
  const [dismissed, setDismissed] = useState(false);
  const [bannerUpdates, setBannerUpdates] = useState<BannerUpdate[]>([]);

  useEffect(() => {
    const hasDismissed = localStorage.getItem(DISMISS_KEY) === "true";
    setDismissed(hasDismissed);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBannerUpdates = async () => {
      try {
        const response = await getBannerUpdates();
        if (cancelled) return;

        const nextItems = Array.isArray(response)
          ? sortBannerUpdates(response.filter((item) => item?.active === true))
          : [];

        setBannerUpdates(nextItems);
      } catch {
        if (cancelled) return;
        setBannerUpdates([]);
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

  const visibleItems = useMemo(() => bannerUpdates, [bannerUpdates]);

  const loopingTickerItems =
    visibleItems.length > 1 ? [...visibleItems, ...visibleItems] : visibleItems;

  const animationDurationSeconds = Math.max(28, visibleItems.length * 9);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  if (dismissed || visibleItems.length === 0) return null;

  return (
    <div className="relative border-b border-slate-800/80 bg-[#0b1f3a] text-white shadow-[0_10px_24px_rgba(3,7,18,0.18)]">
      <div className="relative overflow-hidden pr-10">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#0b1f3a] to-transparent sm:w-16" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#0b1f3a] via-[#0b1f3a]/95 to-transparent sm:w-24" />

        <div className="group overflow-hidden">
          <div
            className="nri-ticker-track flex w-max items-center gap-6 whitespace-nowrap py-2.5 pr-4 group-hover:[animation-play-state:paused] motion-reduce:animate-none sm:gap-8 sm:py-3"
            style={{ animationDuration: `${animationDurationSeconds}s` }}
          >
            {loopingTickerItems.map((item, index) => {
              const href = formatBannerHref(item.url);
              const isExternal = href.startsWith("http://") || href.startsWith("https://");
              const content = (
                <>
                  {item.label ? (
                    <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950 sm:text-[11px]">
                      {item.label}
                    </span>
                  ) : null}
                  {item.date ? <span className="text-[11px] text-slate-300 sm:text-xs">{item.date}</span> : null}
                  {item.date ? <span aria-hidden="true" className="text-slate-500">|</span> : null}
                  {item.country ? (
                    <span className="text-[11px] font-semibold text-sky-300 sm:text-xs">{item.country}</span>
                  ) : null}
                  {item.country ? <span aria-hidden="true" className="text-slate-500">|</span> : null}
                  <span className="text-xs font-medium text-white sm:text-sm">
                    {renderTextWithShortForms(item.title)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="ml-3 inline-block h-1.5 w-1.5 rounded-full bg-slate-500/70"
                  />
                </>
              );

              if (isExternal) {
                return (
                  <a
                    key={`${item.date}-${item.country}-${index}`}
                    href={href}
                    className="inline-flex items-center gap-2 rounded-sm px-1 text-white transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    title={item.title}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {content}
                  </a>
                );
              }

              return (
                <Link
                  key={`${item.date}-${item.country}-${index}`}
                  to={href}
                  className="inline-flex items-center gap-2 rounded-sm px-1 text-white transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  title={item.title}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-md border border-slate-700/70 bg-[#0b1f3a]/90 p-1 text-slate-400 transition-colors hover:text-white"
        aria-label="Dismiss ticker"
        onClick={handleDismiss}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
