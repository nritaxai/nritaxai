import { featureFlags } from "../Config/featureFlags.js";
import { classifyTaxQuery } from "./queryRouterService.js";
import { getCachedValue, setCachedValue } from "./cacheService.js";
import {
  buildClarificationPrompt,
  resolveClarificationTurn,
} from "./ai/clarificationEngine.js";
import {
  clearClarificationSession,
  loadClarificationSession,
  saveClarificationSession,
} from "./ai/sessionMemory.js";

const SESSION_TTL_SECONDS = Math.max(Number(process.env.YUKTI_CONTEXT_TTL_SECONDS || 1800), 300);

const sanitizeText = (value = "") => String(value || "").trim();
const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeContextValue = (value = "") => sanitizeText(value).slice(0, 120);

const getSessionKey = ({ userId = "", sessionId = "" } = {}) =>
  `yukti:${sanitizeText(userId || sessionId || "anonymous")}`;

const buildInitialContext = (payload = {}) => ({
  currentCountry: normalizeContextValue(payload.currentCountry || payload.country),
  relevantCountry: normalizeContextValue(payload.relevantCountry || payload.countryRelevantToQuery),
  residencyStatus: normalizeContextValue(payload.residencyStatus || payload.residentialStatus),
  financialYear: normalizeContextValue(payload.financialYear || payload.taxYear),
  incomeType: normalizeContextValue(payload.incomeType),
  maritalStatus: normalizeContextValue(payload.maritalStatus),
  dependents: normalizeNumber(payload.dependents ?? payload.numberOfChildren ?? payload.children),
});

const mergeContext = (stored = {}, incoming = {}) => ({
  currentCountry: incoming.currentCountry || stored.currentCountry || "",
  relevantCountry: incoming.relevantCountry || stored.relevantCountry || "",
  residencyStatus: incoming.residencyStatus || stored.residencyStatus || "",
  financialYear: incoming.financialYear || stored.financialYear || "",
  incomeType: incoming.incomeType || stored.incomeType || "",
  maritalStatus: incoming.maritalStatus || stored.maritalStatus || "",
  dependents: incoming.dependents ?? stored.dependents ?? null,
});

const detectIncomeTypeFromQuestion = (question = "") => {
  const normalized = sanitizeText(question).toLowerCase();
  if (/(salary|payroll|employment)/.test(normalized)) return "salary";
  if (/(rent|rental|property income)/.test(normalized)) return "rental_income";
  if (/(capital gain|share sale|stock sale|property sale)/.test(normalized)) return "capital_gains";
  if (/(interest|nre|nro|fcnr)/.test(normalized)) return "interest_income";
  if (/(dividend)/.test(normalized)) return "dividend_income";
  return "";
};

const needsFamilyContext = (question = "") => /(spouse|wife|husband|married|children|child|dependent|dependents|80d|80dda|80ddb)/i.test(question);
const needsTreatyCountries = (question = "") => /\bdtaa\b|\btreaty\b|\bdouble tax/i.test(question);

const buildFollowUpQuestions = ({ missingFields = [], context = {}, question = "" } = {}) => {
  const prompts = [];

  missingFields.forEach((field) => {
    if (field === "currentCountry") {
      prompts.push("Which country are you currently living in?");
    } else if (field === "relevantCountry") {
      prompts.push(
        needsTreatyCountries(question)
          ? "Which other country is relevant to this DTAA or cross-border question?"
          : "Which country is relevant to this income or transaction?"
      );
    } else if (field === "residencyStatus") {
      prompts.push("What is your residency status for the relevant financial year?");
    } else if (field === "financialYear") {
      prompts.push("Which financial year or assessment year should I use?");
    } else if (field === "incomeType") {
      prompts.push("What type of income or transaction is this about?");
    } else if (field === "maritalStatus") {
      prompts.push("What is your marital status for this tax scenario?");
    } else if (field === "dependents") {
      prompts.push("How many children or dependents are relevant for this question?");
    }
  });

  if (!prompts.length) {
    return "";
  }

  return `Before I answer, I need a little more context: ${prompts.join(" ")}`;
};

export const loadYuktiSessionContext = async ({ userId = "", sessionId = "" } = {}) => {
  if (featureFlags.yuktiSmartClarificationEnabled) {
    const state = await loadClarificationSession({ userId, sessionId, scope: "yukti" });
    return state?.context || {};
  }
  const key = getSessionKey({ userId, sessionId });
  return (await getCachedValue({ layer: "yukti_session_context", key })) || {};
};

export const saveYuktiSessionContext = async ({ userId = "", sessionId = "", context = {}, lastQuestion = "" } = {}) => {
  if (featureFlags.yuktiSmartClarificationEnabled) {
    const previous = (await loadClarificationSession({ userId, sessionId, scope: "yukti" })) || {};
    const nextState = {
      ...previous,
      active: Boolean(previous?.active),
      originalQuestion: previous?.originalQuestion || sanitizeText(lastQuestion),
      context,
      updatedAt: new Date().toISOString(),
    };
    await saveClarificationSession({ userId, sessionId, scope: "yukti", state: nextState });
    return nextState;
  }
  const key = getSessionKey({ userId, sessionId });
  const payload = {
    ...context,
    lastQuestion: sanitizeText(lastQuestion).slice(0, 1500),
    updatedAt: new Date().toISOString(),
  };
  await setCachedValue({
    layer: "yukti_session_context",
    key,
    value: payload,
    ttlSeconds: SESSION_TTL_SECONDS,
    localTtlMs: SESSION_TTL_SECONDS * 1000,
    localMaxItems: 500,
  });
  return payload;
};

export const resolveYuktiClarificationState = async ({ question = "", payload = {}, userId = "", sessionId = "" } = {}) => {
  if (featureFlags.yuktiSmartClarificationEnabled) {
    const sessionState = await loadClarificationSession({ userId, sessionId, scope: "yukti" });
    const resolved = resolveClarificationTurn({
      question,
      knowledgeSource: "dtaa",
      payloadContext: {
        residenceCountry: payload.currentCountry || payload.country,
        relevantCountry: payload.relevantCountry || payload.countryRelevantToQuery,
        financialYear: payload.financialYear || payload.taxYear,
        incomeType: payload.incomeType,
        maritalStatus: payload.maritalStatus,
        dependents: payload.dependents ?? payload.numberOfChildren ?? payload.children,
      },
      sessionState,
    });

    if (resolved.shouldClarify) {
      await saveClarificationSession({ userId, sessionId, scope: "yukti", state: resolved.state });
    } else {
      await saveClarificationSession({ userId, sessionId, scope: "yukti", state: resolved.state });
      if (!resolved.state.active) {
        await clearClarificationSession({ userId, sessionId, scope: "yukti" });
      }
    }

    return {
      routing: {
        route: resolved.routing.category,
        confidence: resolved.routing.confidence,
        reasons: resolved.routing.reasons,
      },
      context: resolved.context,
      missingFields: resolved.pendingFields,
      shouldClarify: resolved.shouldClarify,
      followUpQuestion: buildClarificationPrompt({ state: resolved.state }),
      resolvedQuestion: resolved.resolvedQuestion,
      category: resolved.routing.category,
    };
  }

  const routing = classifyTaxQuery(question);
  const storedContext = await loadYuktiSessionContext({ userId, sessionId });
  const derivedContext = buildInitialContext(payload);

  if (!derivedContext.incomeType) {
    derivedContext.incomeType = detectIncomeTypeFromQuestion(question);
  }

  const context = mergeContext(storedContext, derivedContext);
  const missingFields = [];

  if (!context.currentCountry) missingFields.push("currentCountry");
  if (needsTreatyCountries(question) && !context.relevantCountry) missingFields.push("relevantCountry");
  if (!context.residencyStatus) missingFields.push("residencyStatus");
  if (!context.financialYear) missingFields.push("financialYear");
  if (!context.incomeType) missingFields.push("incomeType");
  if (needsFamilyContext(question) && !context.maritalStatus) missingFields.push("maritalStatus");
  if (needsFamilyContext(question) && (context.dependents === null || context.dependents === undefined)) {
    missingFields.push("dependents");
  }

  await saveYuktiSessionContext({
    userId,
    sessionId,
    context,
    lastQuestion: question,
  });

  return {
    routing,
    context,
    missingFields,
    shouldClarify: missingFields.length > 0,
    followUpQuestion: buildFollowUpQuestions({ missingFields, context, question }),
  };
};
