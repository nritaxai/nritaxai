import { deleteCachedValue, getCachedValue, setCachedValue } from "../cacheService.js";

const SESSION_TTL_SECONDS = Math.max(Number(process.env.YUKTI_CONTEXT_TTL_SECONDS || 1800), 300);
const CLARIFICATION_LAYER = "ai_clarification_session";

const normalizeText = (value = "") => String(value || "").trim();

const getSessionKey = ({ userId = "", sessionId = "", scope = "chat" } = {}) =>
  `${normalizeText(scope || "chat")}:${normalizeText(userId || sessionId || "anonymous")}`;

export const loadClarificationSession = async ({ userId = "", sessionId = "", scope = "chat" } = {}) => {
  const key = getSessionKey({ userId, sessionId, scope });
  return (await getCachedValue({ layer: CLARIFICATION_LAYER, key })) || null;
};

export const saveClarificationSession = async ({
  userId = "",
  sessionId = "",
  scope = "chat",
  state = {},
} = {}) => {
  const key = getSessionKey({ userId, sessionId, scope });
  await setCachedValue({
    layer: CLARIFICATION_LAYER,
    key,
    value: state,
    ttlSeconds: SESSION_TTL_SECONDS,
    localTtlMs: SESSION_TTL_SECONDS * 1000,
    localMaxItems: 500,
  });
  return state;
};

export const clearClarificationSession = async ({ userId = "", sessionId = "", scope = "chat" } = {}) => {
  const key = getSessionKey({ userId, sessionId, scope });
  await deleteCachedValue({ layer: CLARIFICATION_LAYER, key });
};
