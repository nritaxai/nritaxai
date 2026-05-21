import {
  AI_DEFAULT_MAX_TOKENS,
  AI_DEFAULT_TEMPERATURE,
  NRI_TAX_SYSTEM_PROMPT,
  callGemini,
  callOpenRouter,
  withRetry,
} from "./aiService.js";
import { validateChatbotResponse } from "./responseValidation.js";
import { featureFlags } from "../Config/featureFlags.js";
import { routeChatCompletion } from "./aiGateway/gateway.js";
import { appConfig } from "../Config/runtimeConfig.js";

const PRIMARY_TIMEOUT_THRESHOLD_MS = appConfig.ai.routing.timeoutThresholdMs;
const OPENROUTER_GEMINI_MODEL = appConfig.ai.openRouter.geminiModel;

const buildAttempt = async ({
  provider = "openrouter",
  preferredModel,
  messages,
  systemPrompt,
  maxTokens,
  temperature,
  retries,
}) => {
  const startedAt = Date.now();
  const runner =
    provider === "gemini-direct"
      ? () => callGemini(messages, systemPrompt, { maxTokens, temperature })
      : () => callOpenRouter(messages, systemPrompt, { preferredModel, maxTokens, temperature });

  const result = await withRetry(runner, retries, `${provider}:${preferredModel || "default"}`);
  return {
    ...result,
    responseTimeMs: Date.now() - startedAt,
  };
};

export const requestValidatedCompletion = async ({
  question = "",
  messages = [],
  systemPrompt = NRI_TAX_SYSTEM_PROMPT,
  preferredModel,
  maxTokens = AI_DEFAULT_MAX_TOKENS,
  temperature = AI_DEFAULT_TEMPERATURE,
  nonTaxReply = "",
  retries = 1,
  routeHints = {},
} = {}) => {
  if (featureFlags.aiGatewayEnabled) {
    return routeChatCompletion({
      question,
      messages,
      systemPrompt,
      preferredModel,
      maxTokens,
      temperature,
      nonTaxReply,
      retries,
      routeHints,
    });
  }

  const attempts = [];
  let lastError = null;

  const attemptConfigs = [
    { provider: "openrouter", preferredModel, fallbackUsed: false },
    { provider: "openrouter", preferredModel: OPENROUTER_GEMINI_MODEL, fallbackUsed: true },
    { provider: "gemini-direct", preferredModel: appConfig.ai.gemini.model, fallbackUsed: true },
  ];

  for (const attemptConfig of attemptConfigs) {
    try {
      const attempt = await buildAttempt({
        ...attemptConfig,
        messages,
        systemPrompt,
        maxTokens,
        temperature,
        retries,
      });
      const validation = validateChatbotResponse({
        question,
        response: attempt.response,
        nonTaxReply,
      });
      const timedOutByThreshold = attempt.responseTimeMs > PRIMARY_TIMEOUT_THRESHOLD_MS;

      attempts.push({
        provider: attempt.provider,
        model: attempt.model,
        responseTimeMs: attempt.responseTimeMs,
        fallbackUsed: attemptConfig.fallbackUsed,
        validationIssues: validation.issues,
      });

      if (validation.valid && !timedOutByThreshold) {
        return {
          ...attempt,
          fallbackUsed: attemptConfig.fallbackUsed,
          validationIssues: validation.issues,
          attempts,
        };
      }

      lastError = new Error(
        timedOutByThreshold
          ? `Model exceeded timeout threshold (${attempt.responseTimeMs}ms)`
          : `Response validation failed: ${validation.issues.map((issue) => issue.code).join(", ")}`
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || "Unknown AI router error"));
      attempts.push({
        provider: attemptConfig.provider,
        model: attemptConfig.preferredModel || "",
        responseTimeMs: null,
        fallbackUsed: attemptConfig.fallbackUsed,
        validationIssues: [{ code: "provider_failure", message: lastError.message }],
      });
    }
  }

  throw Object.assign(lastError || new Error("All AI routes failed"), { attempts });
};
