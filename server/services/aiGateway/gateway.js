import {
  AI_DEFAULT_MAX_TOKENS,
  AI_DEFAULT_TEMPERATURE,
  NRI_TAX_SYSTEM_PROMPT,
  callGemini,
  callOpenRouter,
  withRetry,
} from "../aiService.js";
import { validateChatbotResponse } from "../responseValidation.js";
import { recordAiGatewayExecution } from "./metricsStore.js";
import { buildRoutePlan } from "./router.js";

const PRIMARY_TIMEOUT_THRESHOLD_MS = Math.max(Number(process.env.AI_ROUTER_TIMEOUT_THRESHOLD_MS || 12000), 3000);

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

export const routeChatCompletion = async ({
  question = "",
  messages = [],
  systemPrompt = NRI_TAX_SYSTEM_PROMPT,
  preferredModel,
  maxTokens = AI_DEFAULT_MAX_TOKENS,
  temperature = AI_DEFAULT_TEMPERATURE,
  nonTaxReply = "",
  retries = 1,
} = {}) => {
  const startedAt = Date.now();
  const attempts = [];
  let lastError = null;

  const routePlan = buildRoutePlan({
    question,
    preferredModel,
    openRouterGeminiModel: process.env.OPENROUTER_GEMINI_MODEL || "google/gemini-2.0-flash-001",
    smallModel: process.env.AI_GATEWAY_SMALL_MODEL || "google/gemini-2.0-flash-001",
    mediumModel: process.env.AI_GATEWAY_MEDIUM_MODEL || process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
    largeModel: process.env.AI_GATEWAY_LARGE_MODEL || process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
  });

  for (const attemptConfig of routePlan.attempts) {
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
        await recordAiGatewayExecution({
          routeTier: routePlan.tier,
          provider: attempt.provider,
          latencyMs: Date.now() - startedAt,
          attempts: attempts.length,
          failed: false,
        });

        return {
          ...attempt,
          fallbackUsed: attemptConfig.fallbackUsed,
          validationIssues: validation.issues,
          attempts,
          routeTier: routePlan.tier,
        };
      }

      lastError = new Error(
        timedOutByThreshold
          ? `Model exceeded timeout threshold (${attempt.responseTimeMs}ms)`
          : `Response validation failed: ${validation.issues.map((issue) => issue.code).join(", ")}`
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || "Unknown AI gateway error"));
      attempts.push({
        provider: attemptConfig.provider,
        model: attemptConfig.preferredModel || "",
        responseTimeMs: null,
        fallbackUsed: attemptConfig.fallbackUsed,
        validationIssues: [{ code: "provider_failure", message: lastError.message }],
      });
    }
  }

  await recordAiGatewayExecution({
    routeTier: routePlan.tier,
    provider: attempts[attempts.length - 1]?.provider || "",
    latencyMs: Date.now() - startedAt,
    attempts: attempts.length,
    failed: true,
  });

  throw Object.assign(lastError || new Error("All AI routes failed"), {
    attempts,
    routeTier: routePlan.tier,
  });
};
