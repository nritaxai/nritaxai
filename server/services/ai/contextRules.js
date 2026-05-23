import { getContextValue } from "./contextManager.js";

const hasFamilyCue = (question = "") => /\b(spouse|wife|husband|married|child|children|dependent|dependents)\b/i.test(question);
const hasCalculationCue = (question = "") => /\b(calculate|compute|how much tax|tax on sale|gain on sale)\b/i.test(question);
const isDefinitionQuestion = (question = "") => /\bwhat is\b|\bexplain\b|\bdefine\b/i.test(question);
const isPersonalizedPrompt = (question = "") => /\b(i|me|my|mine|we|our|us)\b/i.test(question);

const STATIC_RULES = {
  GENERAL_INFO: () => [],
  GST: ({ question = "" } = {}) => (isDefinitionQuestion(question) && !isPersonalizedPrompt(question) ? [] : []),
  OTHER: () => [],
  COUNTRY_SPECIFIC: () => ["residenceCountry"],
  YEAR_SPECIFIC: () => ["financialYear", "residenceCountry"],
  TAX_FILING: () => ["residenceCountry", "incomeType"],
  INVESTMENT: () => ["residenceCountry"],
  COMPLIANCE: () => ["residenceCountry"],
};

export const getRequiredContextFields = ({ category = "OTHER", question = "", context = {} } = {}) => {
  if (category === "DTAA") {
    if (isDefinitionQuestion(question) && !isPersonalizedPrompt(question)) return [];
    const required = ["residenceCountry"];
    if (Array.isArray(context?.mentionedCountries) && context.mentionedCountries.length > 1 && !getContextValue(context, "relevantCountry")) {
      required.push("relevantCountry");
    }
    return required;
  }

  if (category === "CAPITAL_GAINS") {
    const required = [];
    if (!getContextValue(context, "assetType")) required.push("assetType");
    if (!getContextValue(context, "residenceCountry")) required.push("residenceCountry");
    if (hasCalculationCue(question)) {
      if (!getContextValue(context, "purchaseYear")) required.push("purchaseYear");
      if (!getContextValue(context, "saleYear")) required.push("saleYear");
    }
    return required;
  }

  if (category === "PERSONALIZED_TAX") {
    const required = ["residenceCountry", "financialYear"];
    if (hasFamilyCue(question) && !getContextValue(context, "maritalStatus")) {
      required.push("maritalStatus");
    }
    return required;
  }

  const resolver = STATIC_RULES[category];
  return typeof resolver === "function" ? resolver({ question, context }) : [];
};
