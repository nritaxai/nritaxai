import { useEffect, useMemo, useState } from "react";
import { renderTextWithShortForms } from "../utils/shortForms";

type Banner = {
  label: string;
  title: string;
  country: string;
  date: string;
  url: string;
  active: boolean;
  priority: number;
};

export default function NewsBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);

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
          .sort((a: Banner, b: Banner) => (a.priority ?? 9999) - (b.priority ?? 9999));

        setBanners(activeBanners);
      } catch (error) {
        console.error("Failed to load banner:", error);
        setBanners([]);
      }
    }

    fetchBanner();
  }, []);

  const tickerItems = useMemo(
    () => (banners.length > 0 ? [...banners, ...banners] : []),
    [banners]
  );

  if (banners.length === 0) return null;

  return (
    <div className="w-full border-b border-yellow-200 bg-yellow-50">
      <div className="mx-auto max-w-7xl overflow-hidden px-4 py-2">
        <div className="nri-ticker-track flex w-max items-center gap-8 whitespace-nowrap pr-8">
          {tickerItems.map((banner, index) => (
            <a
              key={`${banner.title}-${banner.date}-${index}`}
              href={banner.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-max items-center gap-3 text-sm text-gray-800 transition-opacity hover:opacity-80"
            >
              <span className="rounded bg-black px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                {banner.label || "LATEST NEWS"}
              </span>
              <span className="font-medium">
                {renderTextWithShortForms(banner.title || "View update")}
              </span>
              {banner.date ? (
                <span className="text-xs text-gray-500">{formatBannerDate(banner.date)}</span>
              ) : null}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
