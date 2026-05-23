import { classifyClarificationQuery } from "./classifier.js";
import {
  buildContextSummary,
  extractAnswerContextForField,
  extractContextFromQuestion,
  getContextValue,
  mergeContext,
  normalizeContext,
} from "./contextManager.js";
import { getRequiredContextFields } from "./contextRules.js";

const FIELD_CONFIG = {
  residenceCountry: {
    label: "Residence country",
    question: "Which country are you currently residing in for tax purposes?",
    inputType: "text",
    placeholder: "For example: Singapore",
  },
  relevantCountry: {
    label: "Relevant country",
    question: "Which other country is relevant to this tax question?",
    inputType: "text",
    placeholder: "For example: India",
  },
  financialYear: {
    label: "Financial year",
    question: "Which financial year do you need guidance for?",
    inputType: "text",
    placeholder: "For example: FY 2025-26",
  },
  incomeType: {
    label: "Income type",
    question: "What type of income do you have in India?",
    inputType: "select",
    options: [
      { value: "salary", label: "Salary" },
      { value: "rental income", label: "Rental income" },
      { value: "capital gains", label: "Capital gains" },
      { value: "interest income", label: "Interest income" },
      { value: "dividend income", label: "Dividend income" },
      { value: "business income", label: "Business income" },
      { value: "other", label: "Other" },
    ],
  },
  maritalStatus: {
    label: "Marital status",
    question: "What is your marital status for this tax scenario?",
    inputType: "select",
    options: [
      { value: "single", label: "Single" },
      { value: "married", label: "Married" },
      { value: "divorced", label: "Divorced" },
      { value: "widowed", label: "Widowed" },
      { value: "prefer not to say", label: "Prefer not to say" },
    ],
  },
  dependents: {
    label: "Dependents",
    question: "How many dependents are relevant for this question?",
    inputType: "text",
    placeholder: "For example: 2",
  },
  assetType: {
    label: "Asset type",
    question: "What type of asset is this about?",
    inputType: "select",
    options: [
      { value: "property", label: "Property" },
      { value: "shares", label: "Shares / stocks" },
      { value: "mutual funds", label: "Mutual funds" },
      { value: "other", label: "Other" },
    ],
  },
  purchaseYear: {
    label: "Purchase year",
    question: "Which year did you purchase the asset?",
    inputType: "text",
    placeholder: "For example: 2019",
  },
  saleYear: {
    label: "Sale year",
    question: "Which year did you sell the asset?",
    inputType: "text",
    placeholder: "For example: 2025",
  },
  transactionType: {
    label: "Transaction type",
    question: "What type of transaction is this about?",
    inputType: "text",
    placeholder: "For example: Sale, transfer, remittance",
  },
};

const normalizeText = (value = "") => String(value || "").trim();
const looksLikeNewQuestion = (message = "") =>
  /[?]/.test(message) || /\b(tax|itr|dtaa|gst|income|capital gain|fema|tds|compliance|return filing)\b/i.test(message);

const getNextQuestionConfig = (field = "", state = {}) => {
  const config = FIELD_CONFIG[field];
  if (!config) return null;

  if (field === "residenceCountry" && Array.isArray(state?.context?.mentionedCountries) && state.context.mentionedCountries.length > 1) {
    return {
      ...config,
      question: "Which country were you residing in during that year?",
    };
  }

  if (field === "relevantCountry" && /\bdtaa|treaty|double tax/i.test(String(state?.originalQuestion || ""))) {
    return {
      ...config,
      question: "Which other country is relevant to this DTAA question?",
    };
  }

  return config;
};

export const buildClarificationQuestions = (fields = [], state = {}) =>
  fields
    .map((field) => {
      const config = getNextQuestionConfig(field, state);
      return config ? { field, ...config } : null;
    })
    .filter(Boolean);

export const buildClarificationPrompt = ({ state = {} } = {}) => {
  const nextField = Array.isArray(state?.pendingFields) ? state.pendingFields[0] : "";
  const config = getNextQuestionConfig(nextField, state);
  return config?.question || "";
};

export const buildClarificationResponsePayload = (state = {}) => {
  const nextField = Array.isArray(state?.pendingFields) ? state.pendingFields[0] : "";
  const questions = buildClarificationQuestions(nextField ? [nextField] : [], state);
  return {
    originalQuestion: state.originalQuestion || "",
    category: state.category || "OTHER",
    requiredFields: Array.isArray(state.requiredFields) ? state.requiredFields : [],
    missingFields: Array.isArray(state.pendingFields) ? state.pendingFields : [],
    askedQuestion: state.lastAskedQuestion || "",
    context: state.context || {},
    contextSummary: buildContextSummary(state.context || {}),
    questions,
  };
};

export const buildClarificationUserMessage = (context = {}) => {
  const summary = buildContextSummary(context);
  return summary ? `Clarification details:\n${summary}` : "";
};

export const createInitialClarificationState = ({ question = "", context = {}, category = "OTHER", routing = null } = {}) => ({
  active: false,
  originalQuestion: normalizeText(question),
  category,
  routing,
  context: normalizeContext(context),
  requiredFields: [],
  pendingFields: [],
  lastAskedField: "",
  lastAskedQuestion: "",
  updatedAt: new Date().toISOString(),
});

export const resolveClarificationTurn = ({
  question = "",
  knowledgeSource = "dtaa",
  payloadContext = {},
  sessionState = null,
} = {}) => {
  const trimmedQuestion = normalizeText(question);
  const derivedQuestionContext = extractContextFromQuestion(trimmedQuestion);
  const incomingContext = mergeContext(payloadContext, derivedQuestionContext);
  const previousState = sessionState && typeof sessionState === "object" ? sessionState : null;
  const pendingField = Array.isArray(previousState?.pendingFields) ? previousState.pendingFields[0] : "";
  const parsedAnswerContext = pendingField
    ? extractAnswerContextForField({ field: pendingField, answer: trimmedQuestion })
    : {};
  const answeredPendingField = pendingField && Object.keys(parsedAnswerContext).length > 0;
  const resumeExistingFlow = Boolean(previousState?.active) && (answeredPendingField || Object.keys(normalizeContext(payloadContext)).length > 0);
  const shouldResetToNewQuestion = Boolean(previousState?.active) && !resumeExistingFlow && looksLikeNewQuestion(trimmedQuestion);

  const originalQuestion = resumeExistingFlow && !shouldResetToNewQuestion
    ? normalizeText(previousState?.originalQuestion || trimmedQuestion)
    : trimmedQuestion;
  const baseContext = shouldResetToNewQuestion ? {} : previousState?.context || {};
  const mergedContext = mergeContext(baseContext, incomingContext, parsedAnswerContext);
  const routing = classifyClarificationQuery({ question: originalQuestion, knowledgeSource });
  const requiredFields = getRequiredContextFields({
    category: routing.category,
    question: originalQuestion,
    context: mergedContext,
  });
  const pendingFields = requiredFields.filter((field) => !getContextValue(mergedContext, field));
  const shouldClarify = pendingFields.length > 0 && !routing.answerDirectly;
  const nextQuestion = shouldClarify
    ? getNextQuestionConfig(pendingFields[0], { originalQuestion, context: mergedContext })?.question || ""
    : "";

  return {
    shouldClarify,
    nextQuestion,
    requiredFields,
    pendingFields,
    context: mergedContext,
    routing,
    answeredPendingField,
    isNewTopic: shouldResetToNewQuestion || !previousState?.active,
    resolvedQuestion: originalQuestion,
    state: {
      active: shouldClarify,
      originalQuestion,
      category: routing.category,
      routing,
      context: mergedContext,
      requiredFields,
      pendingFields,
      lastAskedField: shouldClarify ? pendingFields[0] : "",
      lastAskedQuestion: nextQuestion,
      updatedAt: new Date().toISOString(),
    },
  };
};
