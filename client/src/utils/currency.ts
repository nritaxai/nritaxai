type CurrencyCode = "INR" | "USD" | "SGD" | "IDR" | "GBP" | "AED" | "CAD";

type CurrencyMeta = {
  code: CurrencyCode;
  locale: string;
  symbol: string;
  rateFromInr: number;
};

const DEFAULT_RATES: Record<CurrencyCode, number> = {
  INR: 1,
  USD: Number(import.meta.env.VITE_FX_USD || 0.012),
  SGD: Number(import.meta.env.VITE_FX_SGD || 0.016),
  IDR: Number(import.meta.env.VITE_FX_IDR || 193),
  GBP: Number(import.meta.env.VITE_FX_GBP || 0.0094),
  AED: Number(import.meta.env.VITE_FX_AED || 0.044),
  CAD: Number(import.meta.env.VITE_FX_CAD || 0.016),
};

const CURRENCY_META: Record<CurrencyCode, Omit<CurrencyMeta, "rateFromInr">> = {
  INR: { code: "INR", locale: "en-IN", symbol: "₹" },
  USD: { code: "USD", locale: "en-US", symbol: "$" },
  SGD: { code: "SGD", locale: "en-SG", symbol: "S$" },
  IDR: { code: "IDR", locale: "id-ID", symbol: "Rp" },
  GBP: { code: "GBP", locale: "en-GB", symbol: "£" },
  AED: { code: "AED", locale: "en-AE", symbol: "AED" },
  CAD: { code: "CAD", locale: "en-CA", symbol: "C$" },
};

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ["INR", "USD", "SGD", "IDR", "GBP", "AED", "CAD"];

const COUNTRY_TO_CURRENCY: Array<{ pattern: RegExp; currency: CurrencyCode }> = [
  { pattern: /\b(india|in)\b/i, currency: "INR" },
  { pattern: /\b(united states|usa|us|america)\b/i, currency: "USD" },
  { pattern: /\b(singapore|sg)\b/i, currency: "SGD" },
  { pattern: /\b(indonesia|id)\b/i, currency: "IDR" },
  { pattern: /\b(united kingdom|uk|great britain)\b/i, currency: "GBP" },
  { pattern: /\b(uae|united arab emirates|dubai|abu dhabi)\b/i, currency: "AED" },
  { pattern: /\b(canada|ca)\b/i, currency: "CAD" },
];

export const resolveCurrencyByCountry = (country?: string): CurrencyMeta => {
  const normalizedCountry = String(country || "").trim();
  const picked =
    COUNTRY_TO_CURRENCY.find((row) => row.pattern.test(normalizedCountry))?.currency || "INR";
  const meta = CURRENCY_META[picked];
  return {
    ...meta,
    rateFromInr: Number.isFinite(DEFAULT_RATES[picked]) && DEFAULT_RATES[picked] > 0 ? DEFAULT_RATES[picked] : 1,
  };
};

export const resolveCurrencyByCode = (code?: string): CurrencyMeta => {
  const normalized = String(code || "").toUpperCase() as CurrencyCode;
  const picked: CurrencyCode = SUPPORTED_CURRENCIES.includes(normalized) ? normalized : "INR";
  const meta = CURRENCY_META[picked];
  return {
    ...meta,
    rateFromInr: Number.isFinite(DEFAULT_RATES[picked]) && DEFAULT_RATES[picked] > 0 ? DEFAULT_RATES[picked] : 1,
  };
};

export const convertInrToCurrency = (inrValue: number, currency: CurrencyMeta): number => {
  if (!Number.isFinite(inrValue)) return 0;
  return inrValue * currency.rateFromInr;
};

export const formatCurrency = (
  value: number,
  currency: CurrencyMeta,
  options?: { minFractionDigits?: number; maxFractionDigits?: number }
) =>
  new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: options?.minFractionDigits ?? 2,
    maximumFractionDigits: options?.maxFractionDigits ?? 2,
  }).format(Number.isFinite(value) ? value : 0);

export const formatInr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
