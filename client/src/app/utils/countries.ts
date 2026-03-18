const COUNTRY_CODES = [
  "AE",
  "AU",
  "BH",
  "CA",
  "CH",
  "DE",
  "FR",
  "GB",
  "HK",
  "ID",
  "IE",
  "IN",
  "JP",
  "KW",
  "MY",
  "NL",
  "NZ",
  "OM",
  "QA",
  "SA",
  "SE",
  "SG",
  "TH",
  "US",
  "ZA",
] as const;

const FALLBACK_COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates",
  AU: "Australia",
  BH: "Bahrain",
  CA: "Canada",
  CH: "Switzerland",
  DE: "Germany",
  FR: "France",
  GB: "United Kingdom",
  HK: "Hong Kong",
  ID: "Indonesia",
  IE: "Ireland",
  IN: "India",
  JP: "Japan",
  KW: "Kuwait",
  MY: "Malaysia",
  NL: "Netherlands",
  NZ: "New Zealand",
  OM: "Oman",
  QA: "Qatar",
  SA: "Saudi Arabia",
  SE: "Sweden",
  SG: "Singapore",
  TH: "Thailand",
  US: "United States",
  ZA: "South Africa",
};

const LOCALE_REGION_PATTERN = /[-_]([A-Z]{2})\b/;

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  "Asia/Dubai": "United Arab Emirates",
  "Australia/Sydney": "Australia",
  "Asia/Bahrain": "Bahrain",
  "America/Toronto": "Canada",
  "Europe/Zurich": "Switzerland",
  "Europe/Berlin": "Germany",
  "Europe/Paris": "France",
  "Europe/London": "United Kingdom",
  "Asia/Hong_Kong": "Hong Kong",
  "Asia/Jakarta": "Indonesia",
  "Europe/Dublin": "Ireland",
  "Asia/Kolkata": "India",
  "Asia/Tokyo": "Japan",
  "Asia/Kuwait": "Kuwait",
  "Asia/Kuala_Lumpur": "Malaysia",
  "Europe/Amsterdam": "Netherlands",
  "Pacific/Auckland": "New Zealand",
  "Asia/Muscat": "Oman",
  "Asia/Qatar": "Qatar",
  "Asia/Riyadh": "Saudi Arabia",
  "Europe/Stockholm": "Sweden",
  "Asia/Singapore": "Singapore",
  "Asia/Bangkok": "Thailand",
  "America/New_York": "United States",
  "America/Chicago": "United States",
  "America/Denver": "United States",
  "America/Los_Angeles": "United States",
  "Africa/Johannesburg": "South Africa",
};

const displayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export const COUNTRY_OPTIONS = COUNTRY_CODES.map((code) => ({
  code,
  name: displayNames?.of(code) || FALLBACK_COUNTRY_NAMES[code],
})).sort((a, b) => a.name.localeCompare(b.name));

export const detectUserCountry = () => {
  if (typeof window === "undefined") return "";

  const localeCandidates = [
    navigator.language,
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
  ];

  for (const locale of localeCandidates) {
    const match = String(locale || "").match(LOCALE_REGION_PATTERN);
    if (!match) continue;
    const countryName = displayNames?.of(match[1]) || FALLBACK_COUNTRY_NAMES[match[1]];
    if (countryName) return countryName;
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return TIMEZONE_TO_COUNTRY[timeZone] || "";
};
