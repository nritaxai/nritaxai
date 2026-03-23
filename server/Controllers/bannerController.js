const defaultBannerUpdates = [
  {
    label: "IMPORTANT",
    date: "2025-01-04",
    country: "India-UAE",
    title: "Clarification on tax residency certificate requirements for FY 2024-25",
    url: "/tax-updates/india-uae-trc",
    active: true,
    priority: 1,
  },
  {
    label: "IMPORTANT",
    date: "2025-01-05",
    country: "India-Singapore",
    title: "DTAA amendment: Article 12 royalty rates reduced from 15% to 10% effective April 1, 2025",
    url: "/tax-updates/india-singapore-royalty-rates",
    active: true,
    priority: 1,
  },
  {
    label: "UPDATE",
    date: "2025-01-02",
    country: "India-USA",
    title: "New MLI provisions on Permanent Establishment effective January 1, 2025",
    url: "/tax-updates/india-usa-mli-pe",
    active: true,
    priority: 2,
  },
  {
    label: "UPDATE",
    date: "2024-12-28",
    country: "India",
    title: "Form 15CA/15CB revised procedures for remittances exceeding INR 5 lakh from February 2025",
    url: "/tax-updates/form-15ca-15cb-update",
    active: true,
    priority: 3,
  },
];

let bannerUpdates = [...defaultBannerUpdates];

const normalizeDate = (value) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeBannerItem = (item, index) => {
  const label = sanitizeString(item?.label || "UPDATE");
  const date = sanitizeString(item?.date);
  const country = sanitizeString(item?.country);
  const title = sanitizeString(item?.title);
  const url = sanitizeString(item?.url);
  const active = item?.active !== false;
  const priorityRaw = Number(item?.priority);
  const priority = Number.isFinite(priorityRaw) ? priorityRaw : index + 1;

  if (!title) return null;

  return {
    label: label || "UPDATE",
    date,
    country,
    title,
    url: url || "#",
    active,
    priority,
  };
};

const extractBannerPayload = (body) => {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.updates)) return body.updates;
  if (body && typeof body === "object" && sanitizeString(body?.title)) return [body];
  return [];
};

const sortAndFilterBannerUpdates = (updates, countryFilter = "") =>
  updates
    .filter((item) => item.active === true)
    .filter((item) => {
      if (!countryFilter) return true;
      return String(item.country || "").toLowerCase() === countryFilter;
    })
    .sort((a, b) => {
      const priorityDelta = Number(a.priority || 0) - Number(b.priority || 0);
      if (priorityDelta !== 0) return priorityDelta;
      return normalizeDate(b.date) - normalizeDate(a.date);
    });

export const updateBannerUpdates = async (req, res) => {
  try {
    const configuredApiKey = sanitizeString(process.env.BANNER_API_KEY);
    const providedApiKey = sanitizeString(req.get("x-api-key"));

    if (configuredApiKey && providedApiKey !== configuredApiKey) {
      return res.status(401).json({
        success: false,
        message: "Invalid banner API key",
      });
    }

    const extractedPayload = extractBannerPayload(req.body);
    if (!extractedPayload.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload. Expected { updates: [...] }",
      });
    }

    const incomingUpdates = extractedPayload
      .map((item, index) => normalizeBannerItem(item, index))
      .filter(Boolean);

    if (!incomingUpdates.length) {
      return res.status(400).json({
        success: false,
        message: "Payload contained no valid banner updates",
      });
    }

    bannerUpdates = incomingUpdates;

    console.log("[banner-updates] Banner updated", {
      count: bannerUpdates.length,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      count: bannerUpdates.length,
    });
  } catch (error) {
    console.error("[banner-updates:update]", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update banner updates",
    });
  }
};

export const getBannerHealth = async (_req, res) => {
  return res.status(200).json({ ok: true });
};

export const getBannerUpdates = async (req, res) => {
  try {
    const countryFilter = String(req.query?.country || "").trim().toLowerCase();
    const data = sortAndFilterBannerUpdates(bannerUpdates, countryFilter);

    return res.status(200).json(data);
  } catch (error) {
    console.error("[banner-updates:get]", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load banner updates",
    });
  }
};
