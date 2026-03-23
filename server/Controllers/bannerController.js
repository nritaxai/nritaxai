const bannerUpdates = [
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

const normalizeDate = (value) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getBannerUpdates = async (req, res) => {
  try {
    const countryFilter = String(req.query?.country || "").trim().toLowerCase();

    const data = bannerUpdates
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

    return res.status(200).json(data);
  } catch (error) {
    console.error("[banner-updates]", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load banner updates",
    });
  }
};
