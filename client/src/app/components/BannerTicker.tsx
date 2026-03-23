import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getBannerUpdates } from "../../utils/api";
import type { BannerUpdate } from "../../utils/api";
import { renderTextWithShortForms } from "../utils/shortForms";

const DISMISS_KEY = "regulatory-ticker-dismissed";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const FALLBACK_BANNER_UPDATES: BannerUpdate[] = [
  {
    label: "INFO",
    date: "",
    country: "",
    title: "No updates available",
    url: "#",
    active: true,
    priority: 999,
  },
];

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
  const [loading, setLoading] = useState(true);
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
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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

  const visibleItems = useMemo(() => {
    if (loading) return [];
    return bannerUpdates.length ? bannerUpdates : FALLBACK_BANNER_UPDATES;
  }, [bannerUpdates, loading]);

  const loopingTickerItems =
    visibleItems.length > 1 ? [...visibleItems, ...visibleItems] : visibleItems;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  if (dismissed) return null;

  return (
    <div className="relative border-b border-slate-700 bg-[#0b1f3a] py-2">
      <div className="overflow-hidden pr-10">
        {loading ? (
          <div className="px-4 py-1 text-sm font-medium text-slate-200">Loading updates...</div>
        ) : (
          <div className="group overflow-hidden">
            <div className="nri-ticker-track flex w-max items-center gap-6 whitespace-nowrap py-0.5 sm:gap-8">
              {loopingTickerItems.map((item, index) => {
                const href = formatBannerHref(item.url);
                const isFallback = href === "#";
                const content = (
                  <>
                    {item.label ? (
                      <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-950 sm:text-xs">
                        {item.label}
                      </span>
                    ) : null}
                    {item.date ? <span className="text-xs text-slate-300 sm:text-sm">{item.date}</span> : null}
                    {item.date ? <span aria-hidden="true" className="text-slate-500">|</span> : null}
                    {item.country ? (
                      <span className="text-xs font-medium text-sky-300 sm:text-sm">{item.country}</span>
                    ) : null}
                    {item.country ? <span aria-hidden="true" className="text-slate-500">|</span> : null}
                    <span className="text-xs text-white sm:text-sm">
                      {renderTextWithShortForms(item.title)}
                    </span>
                  </>
                );

                if (isFallback) {
                  return (
                    <div
                      key={`${item.title}-${index}`}
                      className="inline-flex items-center gap-2 rounded-sm px-1 text-white"
                    >
                      {content}
                    </div>
                  );
                }

                const isExternal = href.startsWith("http://") || href.startsWith("https://");

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
        )}
      </div>

      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-white"
        aria-label="Dismiss ticker"
        onClick={handleDismiss}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
