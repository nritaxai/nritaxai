const FIELD_CONFIG = {
  residencyCountry: {
    label: "Residency country",
    question: "Which country are you currently residing in for tax purposes?",
    inputType: "text",
    placeholder: "For example: UAE, USA, Singapore",
  },
  targetCountry: {
    label: "Target country",
    question: "Which country’s tax or DTAA information do you need?",
    inputType: "text",
    placeholder: "For example: India, USA, UK",
  },
  financialYear: {
    label: "Financial year",
    question: "Which financial year is this for?",
    inputType: "text",
    placeholder: "For example: FY 2025-26",
  },
  incomeType: {
    label: "Income type",
    question: "What type of income or transaction is this about?",
    inputType: "select",
    options: [
      { value: "salary", label: "Salary" },
      { value: "rental income", label: "Rental income" },
      { value: "capital gains", label: "Capital gains" },
      { value: "property sale", label: "Property sale" },
      { value: "interest income", label: "Interest income" },
      { value: "dividend income", label: "Dividend income" },
      { value: "business income", label: "Business income" },
      { value: "royalty / fts", label: "Royalty / FTS" },
      { value: "other", label: "Other" },
    ],
  },
  maritalStatus: {
    label: "Marital status",
    question: "What is your marital status?",
    inputType: "select",
    options: [
      { value: "single", label: "Single" },
      { value: "married", label: "Married" },
      { value: "divorced", label: "Divorced" },
      { value: "widowed", label: "Widowed" },
      { value: "prefer not to say", label: "Prefer not to say" },
    ],
  },
  dependentsOrUserCategory: {
    label: "Dependents or user category",
    question: "How many dependents do you have, or what user category best describes you?",
    inputType: "text",
    placeholder: "For example: 2 dependents, NRI salaried employee, OCI, senior citizen",
  },
};

const COUNTRY_ALIASES = [
  { label: "India", aliases: ["india", "indian"] },
  { label: "United States", aliases: ["united states", "usa", "us", "america"] },
  { label: "United Kingdom", aliases: ["united kingdom", "uk", "britain", "england"] },
  { label: "United Arab Emirates", aliases: ["united arab emirates", "uae", "dubai", "abu dhabi"] },
  { label: "Singapore", aliases: ["singapore"] },
  { label: "Canada", aliases: ["canada"] },
  { label: "Australia", aliases: ["australia"] },
  { label: "Germany", aliases: ["germany"] },
  { label: "Netherlands", aliases: ["netherlands", "holland"] },
  { label: "Malaysia", aliases: ["malaysia"] },
  { label: "Indonesia", aliases: ["indonesia"] },
  { label: "Saudi Arabia", aliases: ["saudi arabia", "saudi"] },
  { label: "Qatar", aliases: ["qatar"] },
  { label: "Oman", aliases: ["oman"] },
  { label: "Kuwait", aliases: ["kuwait"] },
  { label: "Ireland", aliases: ["ireland"] },
  { label: "New Zealand", aliases: ["new zealand"] },
  { label: "France", aliases: ["france"] },
];

const INCOME_TYPE_PATTERNS = [
  { label: "salary", pattern: /\b(salary|employment income|payroll|wages)\b/i },
  { label: "rental income", pattern: /\b(rent|rental income|lease income)\b/i },
  { label: "capital gains", pattern: /\b(capital gain|capital gains)\b/i },
  { label: "property sale", pattern: /\b(property sale|sell(?:ing)? property|sale of property|house sale)\b/i },
  { label: "interest income", pattern: /\b(interest|fd interest|deposit interest|nre interest|nro interest)\b/i },
  { label: "dividend income", pattern: /\b(dividend|dividends)\b/i },
  { label: "business income", pattern: /\b(business income|business profit|freelance income|professional income)\b/i },
  { label: "royalty / fts", pattern: /\b(royalty|fees for technical services|fts|technical service)\b/i },
];

const EXTENDED_PROFILE_PATTERN =
  /\b(80c|80d|rebate|slab|old regime|new regime|deduction|deductions|exemption|itr|return filing|return|dependent|dependents|spouse|child|children|married|single|senior citizen|super senior)\b/i;
const TREATY_PROFILE_PATTERN =
  /\b(dtaa|tax treaty|double taxation|foreign tax credit|withholding tax|form 10f|trc|tax residency certificate|article\s+\d+)\b/i;
const SMALL_TALK_PATTERN =
  /^\s*(thanks?|thank you|ok|okay|got it|noted|cool|great|fine|understood|yes|no)\s*[!. ]*$/i;

const normalizePlainText = (value = "") => String(value || "").trim().replace(/\s+/g, " ");

const normalizeFinancialYear = (value = "") => {
  const raw = normalizePlainText(value);
  if (!raw) return "";
  const match = raw.match(/\b(?:fy|ay)?\s*(20\d{2})\s*[-/]\s*(\d{2,4})\b/i);
  if (!match) return raw;
  const startYear = match[1];
  const endYearRaw = match[2];
  const endYear = endYearRaw.length === 2 ? `${startYear.slice(0, 2)}${endYearRaw}` : endYearRaw;
  return `FY ${startYear}-${endYear.slice(-2)}`;
};

const normalizeMaritalStatus = (value = "") => {
  const normalized = normalizePlainText(value).toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("married")) return "married";
  if (normalized.includes("single") || normalized.includes("unmarried")) return "single";
  if (normalized.includes("divorc")) return "divorced";
  if (normalized.includes("widow")) return "widowed";
  if (normalized.includes("prefer")) return "prefer not to say";
  return normalizePlainText(value);
};

const findCountryMentions = (text = "") => {
  const normalized = ` ${String(text || "").toLowerCase()} `;
  const found = [];
  for (const country of COUNTRY_ALIASES) {
    if (country.aliases.some((alias) => normalized.includes(` ${alias} `))) {
      found.push(country.label);
    }
  }
  return Array.from(new Set(found));
};

const extractResidencyCountry = (text = "") => {
  const lower = String(text || "").toLowerCase();
  for (const country of COUNTRY_ALIASES) {
    for (const alias of country.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `\\b(?:residing|resident|living|live|based|staying|working)\\s+(?:in|from)\\s+${escaped}\\b|\\b(?:in|from)\\s+${escaped}\\s+(?:as an?|as a)?\\s*(?:nri|resident)?\\b`,
        "i"
      );
      if (pattern.test(lower)) {
        return country.label;
      }
    }
  }
  return "";
};

const extractTargetCountry = (text = "", residencyCountry = "") => {
  const countries = findCountryMentions(text).filter((country) => country !== residencyCountry);
  if (countries.length === 1) return countries[0];

  const pairMatch = String(text || "").match(/\b([a-z .]+)\s*[-/]\s*([a-z .]+)\s*dtaa\b/i);
  if (pairMatch) {
    const pairCountries = findCountryMentions(`${pairMatch[1]} ${pairMatch[2]}`).filter((country) => country !== residencyCountry);
    if (pairCountries.length === 1) return pairCountries[0];
  }

  return "";
};

const extractFinancialYear = (text = "") => {
  const fyMatch = String(text || "").match(/\b(?:fy|ay)\s*20\d{2}\s*[-/]\s*\d{2,4}\b/i);
  if (fyMatch) return normalizeFinancialYear(fyMatch[0]);
  const yearMatch = String(text || "").match(/\b20\d{2}\s*[-/]\s*\d{2,4}\b/);
  return yearMatch ? normalizeFinancialYear(yearMatch[0]) : "";
};

const extractIncomeType = (text = "") => {
  for (const entry of INCOME_TYPE_PATTERNS) {
    if (entry.pattern.test(text)) return entry.label;
  }
  return "";
};

const extractMaritalStatus = (text = "") => {
  const lower = String(text || "").toLowerCase();
  if (/\bmarried\b/.test(lower)) return "married";
  if (/\b(single|unmarried)\b/.test(lower)) return "single";
  if (/\bdivorc(?:ed|e)\b/.test(lower)) return "divorced";
  if (/\bwidow(?:ed)?\b/.test(lower)) return "widowed";
  return "";
};

const extractDependentsOrUserCategory = (text = "") => {
  const lower = String(text || "").toLowerCase();
  const dependentsMatch = lower.match(/\b(\d+)\s+(?:dependents?|children|kids)\b/);
  if (dependentsMatch) {
    return `${dependentsMatch[1]} dependents`;
  }
  const categoryMatch = lower.match(/\b(nri|oci|pio|senior citizen|super senior citizen|salaried employee|freelancer|self employed|retired|seafarer)\b/);
  if (categoryMatch) {
    return normalizePlainText(categoryMatch[1]);
  }
  return "";
};

export const extractClarificationContextFromText = (text = "") => {
  const residencyCountry = extractResidencyCountry(text);
  return normalizeClarificationContext({
    residencyCountry,
    targetCountry: extractTargetCountry(text, residencyCountry),
    financialYear: extractFinancialYear(text),
    incomeType: extractIncomeType(text),
    maritalStatus: extractMaritalStatus(text),
    dependentsOrUserCategory: extractDependentsOrUserCategory(text),
  });
};

export const normalizeClarificationContext = (raw = {}) => {
  const next = {
    residencyCountry: normalizePlainText(raw?.residencyCountry),
    targetCountry: normalizePlainText(raw?.targetCountry),
    financialYear: normalizeFinancialYear(raw?.financialYear),
    incomeType: normalizePlainText(raw?.incomeType),
    maritalStatus: normalizeMaritalStatus(raw?.maritalStatus),
    dependentsOrUserCategory: normalizePlainText(raw?.dependentsOrUserCategory),
  };

  return Object.fromEntries(Object.entries(next).filter(([, value]) => value));
};

export const mergeClarificationContext = (...parts) =>
  parts.reduce((acc, part) => ({ ...acc, ...normalizeClarificationContext(part) }), {});

export const getRequiredClarificationFields = ({ message = "", knowledgeSource = "dtaa" } = {}) => {
  const text = String(message || "");
  const baseFields = ["residencyCountry", "targetCountry", "financialYear", "incomeType"];
  const extendedFields = [...baseFields, "maritalStatus", "dependentsOrUserCategory"];

  if (knowledgeSource === "dtaa" || TREATY_PROFILE_PATTERN.test(text)) {
    return baseFields;
  }

  if (EXTENDED_PROFILE_PATTERN.test(text)) {
    return extendedFields;
  }

  return baseFields;
};

export const getMissingClarificationFields = (requiredFields = [], context = {}) =>
  requiredFields.filter((field) => !normalizePlainText(context?.[field]));

export const buildClarificationQuestions = (missingFields = []) =>
  missingFields
    .map((field) => {
      const config = FIELD_CONFIG[field];
      if (!config) return null;
      return {
        field,
        label: config.label,
        question: config.question,
        inputType: config.inputType,
        placeholder: config.placeholder || "",
        options: Array.isArray(config.options) ? config.options : [],
      };
    })
    .filter(Boolean);

export const buildClarificationPrompt = ({ originalQuestion = "", missingFields = [] } = {}) => {
  const questions = buildClarificationQuestions(missingFields);
  if (!questions.length) return "";

  const intro = originalQuestion
    ? "I can help with that. Before I answer, I need a few details so I do not give you the wrong tax guidance."
    : "Before I answer, I need a few details so I can give accurate tax guidance.";

  const bulletLines = questions.map((item) => `- ${item.question}`);
  return `${intro}\n\nPlease share:\n${bulletLines.join("\n")}`;
};

export const buildClarificationContextSummary = (context = {}) => {
  const orderedFields = [
    "residencyCountry",
    "targetCountry",
    "financialYear",
    "incomeType",
    "maritalStatus",
    "dependentsOrUserCategory",
  ];

  const lines = orderedFields
    .filter((field) => normalizePlainText(context?.[field]))
    .map((field) => `- ${FIELD_CONFIG[field].label}: ${normalizePlainText(context[field])}`);

  return lines.join("\n");
};

export const shouldAskClarification = ({ message = "", knowledgeSource = "dtaa", context = {} } = {}) => {
  if (SMALL_TALK_PATTERN.test(String(message || "").trim())) {
    return {
      requiredFields: [],
      missingFields: [],
      needsClarification: false,
    };
  }
  const requiredFields = getRequiredClarificationFields({ message, knowledgeSource });
  const missingFields = getMissingClarificationFields(requiredFields, context);
  return {
    requiredFields,
    missingFields,
    needsClarification: missingFields.length > 0,
  };
};
