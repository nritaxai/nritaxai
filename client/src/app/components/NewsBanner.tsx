import { useEffect, useState } from "react";

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
  const [banner, setBanner] = useState<Banner | null>(null);

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
          setBanner(null);
          return;
        }

        const activeBanners = data
          .filter((item: Banner) => item && item.active === true)
          .sort((a: Banner, b: Banner) => (a.priority ?? 9999) - (b.priority ?? 9999));

        setBanner(activeBanners[0] || null);
      } catch (error) {
        console.error("Failed to load banner:", error);
        setBanner(null);
      }
    }

    fetchBanner();
  }, []);

  if (!banner) return null;

  return (
    <div className="w-full border-b border-yellow-200 bg-yellow-50 px-4 py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 text-sm">
        <span className="rounded bg-black px-2 py-1 text-xs font-semibold text-white">
          {banner.label || "LATEST NEWS"}
        </span>

        <a
          href={banner.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 font-medium text-gray-800 hover:underline"
        >
          {banner.title || "View update"}
        </a>

        {banner.date ? (
          <span className="text-xs text-gray-500">
            {new Date(banner.date).toLocaleDateString()}
          </span>
        ) : null}
      </div>
    </div>
  );
}
