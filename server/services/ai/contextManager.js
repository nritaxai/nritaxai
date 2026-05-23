const FIELD_ORDER = [
  "residenceCountry",
  "relevantCountry",
  "financialYear",
  "incomeType",
  "maritalStatus",
  "dependents",
  "assetType",
  "purchaseYear",
  "saleYear",
  "transactionType",
];

const COUNTRY_ALIASES = [
  { label: "India", aliases: ["india", "indian"] },
  { label: "United States", aliases: ["united states", "usa", "us", "america"] },
  { label: "United Kingdom", aliases: ["united kingdom", "uk", "britain", "england"] },
  { label: "United Arab Emirates", aliases: ["united arab emirates", "uae", "dubai", "abu dhabi"] },
  { label: "Singapore", aliases: ["singapore"] },
  { label: "Indonesia", aliases: ["indonesia"] },
  { label: "Canada", aliases: ["canada"] },
  { label: "Australia", aliases: ["australia"] },
  { label: "Germany", aliases: ["germany"] },
  { label: "Malaysia", aliases: ["malaysia"] },
];

const INCOME_PATTERNS = [
  { label: "salary", pattern: /\b(salary|employment income|payroll|wages)\b/i },
  { label: "rental income", pattern: /\b(rent|rental income|lease income)\b/i },
  { label: "capital gains", pattern: /\b(capital gain|capital gains)\b/i },
  { label: "interest income", pattern: /\b(interest|fd interest|deposit interest|nre interest|nro interest)\b/i },
  { label: "dividend income", pattern: /\b(dividend|dividends)\b/i },
  { label: "business income", pattern: /\b(business income|business profit|freelance income|professional income)\b/i },
];

const ASSET_PATTERNS = [
  { label: "property", pattern: /\b(property|house|flat|apartment|real estate)\b/i },
  { label: "shares", pattern: /\b(share|shares|stock|stocks|equity)\b/i },
  { label: "mutual funds", pattern: /\b(mutual fund|mf units?)\b/i },
];

const TRANSACTION_PATTERNS = [
  { label: "sale", pattern: /\b(sell|sale|sold|dispose)\b/i },
  { label: "purchase", pattern: /\b(buy|purchase|bought|acquire)\b/i },
];

const normalizeText = (value = "") => String(value || "").trim().replace(/\s+/g, " ");
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();

const normalizeCountry = (value = "") => {
  const normalized = normalizeLower(value);
  if (!normalized) return "";
  for (const country of COUNTRY_ALIASES) {
    if (country.aliases.includes(normalized)) return country.label;
  }
  return normalizeText(value);
};

export const findCountryMentions = (text = "") => {
  const normalized = normalizeLower(text);
  const matches = [];
  for (const country of COUNTRY_ALIASES) {
    if (
      country.aliases.some((alias) => {
        const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|\\W)${escapedAlias}(?=\\W|$)`, "i").test(normalized);
      })
    ) {
      matches.push(country.label);
    }
  }
  return Array.from(new Set(matches));
};

const extractFinancialYear = (text = "") => {
  const normalized = normalizeText(text);
  const match = normalized.match(/\b(?:fy|ay)?\s*(20\d{2})\s*[-/]\s*(\d{2,4})\b/i);
  if (match) {
    const startYear = match[1];
    const endYear = match[2].length === 2 ? `${startYear.slice(0, 2)}${match[2]}` : match[2];
    return `FY ${startYear}-${endYear.slice(-2)}`;
  }
  return "";
};

const extractBareYears = (text = "") => {
  const matches = Array.from(String(text || "").matchAll(/\b(20\d{2})\b/g)).map((match) => match[1]);
  return Array.from(new Set(matches));
};

const extractIncomeType = (text = "") => {
  for (const entry of INCOME_PATTERNS) {
    if (entry.pattern.test(text)) return entry.label;
  }
  return "";
};

const extractAssetType = (text = "") => {
  for (const entry of ASSET_PATTERNS) {
    if (entry.pattern.test(text)) return entry.label;
  }
  return "";
};

const extractTransactionType = (text = "") => {
  for (const entry of TRANSACTION_PATTERNS) {
    if (entry.pattern.test(text)) return entry.label;
  }
  return "";
};

const extractMaritalStatus = (text = "") => {
  const lower = normalizeLower(text);
  if (/\bmarried\b/.test(lower)) return "married";
  if (/\b(single|unmarried)\b/.test(lower)) return "single";
  if (/\bdivorc(?:ed|e)\b/.test(lower)) return "divorced";
  if (/\bwidow(?:ed)?\b/.test(lower)) return "widowed";
  return "";
};

const extractDependents = (text = "") => {
  const match = String(text || "").match(/\b(\d+)\s+(?:dependents?|children|kids)\b/i);
  return match ? match[1] : "";
};

const resolveResidenceCountry = (text = "", countries = []) => {
  const lower = normalizeLower(text);
  const moveMatch = lower.match(/\bmoved from\s+([a-z ]+?)\s+to\s+([a-z ]+)\b/i);
  if (moveMatch) {
    return "";
  }
  for (const country of COUNTRY_ALIASES) {
    if (!countries.includes(country.label)) continue;
    const aliasPattern = country.aliases
      .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const patterns = [
      new RegExp(`\\b(?:live|living|reside|residing|based|staying) in (?:${aliasPattern})\\b`, "i"),
      new RegExp(`\\b(?:currently|now) (?:live|living|reside|residing|based|staying) in (?:${aliasPattern})\\b`, "i"),
      new RegExp(`\\b(?:currently|now) in (?:${aliasPattern})\\b`, "i"),
      new RegExp(`\\bresident in (?:${aliasPattern})\\b`, "i"),
    ];

    if (patterns.some((pattern) => pattern.test(lower))) {
      return country.label;
    }
  }
  if (countries.length === 1) return countries[0];
  return "";
};

const resolveRelevantCountry = (countries = [], residenceCountry = "") => {
  const relevant = countries.filter((country) => country !== residenceCountry);
  return relevant.length === 1 ? relevant[0] : "";
};

export const normalizeContext = (context = {}) => {
  const normalized = {
    residenceCountry: normalizeCountry(context?.residenceCountry || context?.currentCountry || context?.country),
    relevantCountry: normalizeCountry(context?.relevantCountry || context?.targetCountry || context?.countryRelevantToQuery),
    financialYear: normalizeText(context?.financialYear || context?.taxYear),
    incomeType: normalizeText(context?.incomeType),
    maritalStatus: normalizeText(context?.maritalStatus),
    dependents: normalizeText(context?.dependents),
    assetType: normalizeText(context?.assetType),
    purchaseYear: normalizeText(context?.purchaseYear),
    saleYear: normalizeText(context?.saleYear),
    transactionType: normalizeText(context?.transactionType),
    mentionedCountries: Array.isArray(context?.mentionedCountries) ? context.mentionedCountries.filter(Boolean) : [],
  };

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => (Array.isArray(value) ? value.length > 0 : Boolean(normalizeText(value))))
  );
};

export const mergeContext = (...parts) => {
  const merged = {};
  for (const part of parts) {
    const normalized = normalizeContext(part);
    for (const [key, value] of Object.entries(normalized)) {
      merged[key] = value;
    }
  }
  return merged;
};

export const extractContextFromQuestion = (question = "") => {
  const countries = findCountryMentions(question);
  const residenceCountry = resolveResidenceCountry(question, countries);
  const bareYears = extractBareYears(question);
  const transactionType = extractTransactionType(question);

  return normalizeContext({
    residenceCountry,
    relevantCountry: resolveRelevantCountry(countries, residenceCountry),
    financialYear: extractFinancialYear(question),
    incomeType: extractIncomeType(question),
    maritalStatus: extractMaritalStatus(question),
    dependents: extractDependents(question),
    assetType: extractAssetType(question),
    purchaseYear: bareYears[0] || "",
    saleYear: bareYears[1] || "",
    transactionType,
    mentionedCountries: countries,
  });
};

export const extractAnswerContextForField = ({ field = "", answer = "" } = {}) => {
  const countries = findCountryMentions(answer);
  const firstCountry = countries[0] || "";
  const bareYears = extractBareYears(answer);
  const extracted = {
    residenceCountry: field === "residenceCountry" ? firstCountry || normalizeCountry(answer) : "",
    relevantCountry: field === "relevantCountry" ? firstCountry || normalizeCountry(answer) : "",
    financialYear: field === "financialYear" ? extractFinancialYear(answer) || (bareYears[0] ? `FY ${bareYears[0]}-${String(Number(bareYears[0]) + 1).slice(-2)}` : "") : "",
    incomeType: field === "incomeType" ? extractIncomeType(answer) || normalizeText(answer) : "",
    maritalStatus: field === "maritalStatus" ? extractMaritalStatus(answer) || normalizeText(answer) : "",
    dependents: field === "dependents" ? extractDependents(answer) || normalizeText(answer) : "",
    assetType: field === "assetType" ? extractAssetType(answer) || normalizeText(answer) : "",
    purchaseYear: field === "purchaseYear" ? bareYears[0] || normalizeText(answer) : "",
    saleYear: field === "saleYear" ? bareYears[0] || normalizeText(answer) : "",
    transactionType: field === "transactionType" ? extractTransactionType(answer) || normalizeText(answer) : "",
  };
  return normalizeContext(extracted);
};

export const buildContextSummary = (context = {}) => {
  const labels = {
    residenceCountry: "Residence country",
    relevantCountry: "Relevant country",
    financialYear: "Financial year",
    incomeType: "Income type",
    maritalStatus: "Marital status",
    dependents: "Dependents",
    assetType: "Asset type",
    purchaseYear: "Purchase year",
    saleYear: "Sale year",
    transactionType: "Transaction type",
  };

  return FIELD_ORDER.filter((field) => normalizeText(context?.[field]))
    .map((field) => `- ${labels[field]}: ${normalizeText(context[field])}`)
    .join("\n");
};

export const getContextValue = (context = {}, field = "") => normalizeText(context?.[field]);
