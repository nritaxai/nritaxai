import {
  AI_DEFAULT_MAX_TOKENS,
  AI_DEFAULT_TEMPERATURE,
  NRI_TAX_SYSTEM_PROMPT,
  callGemini,
  callOllama,
  callOpenRouter,
  withRetry,
} from "../aiService.js";
import { validateChatbotResponse } from "../responseValidation.js";
import { recordAiGatewayExecution } from "./metricsStore.js";
import { buildRoutePlan } from "./router.js";
import {
  buildAiGatewayCacheKey,
  clearInFlightGatewayRequest,
  getCachedGatewayResponse,
  getInFlightGatewayRequest,
  setCachedGatewayResponse,
  setInFlightGatewayRequest,
} from "./cacheStore.js";
import { featureFlags } from "../../Config/featureFlags.js";
import { buildStreamingPreviewChunks, createSseEnvelope } from "./stream.js";
import {
  compressGatewayMessages,
  compressSystemPrompt,
  estimateAiCost,
  resolveTokenBudget,
} from "./costEngineering.js";

const PRIMARY_TIMEOUT_THRESHOLD_MS = Math.max(Number(process.env.AI_ROUTER_TIMEOUT_THRESHOLD_MS || 12000), 3000);

const buildOptimizedRequest = ({ routeTier = "medium", messages = [], systemPrompt = "", maxTokens } = {}) => ({
  messages: featureFlags.aiContextCompressionEnabled
    ? compressGatewayMessages({ messages, routeTier })
    : messages,
  systemPrompt: featureFlags.aiContextCompressionEnabled
    ? compressSystemPrompt({ systemPrompt, routeTier })
    : systemPrompt,
  maxTokens: featureFlags.aiCostAwareRoutingEnabled ? resolveTokenBudget({ routeTier, maxTokens }) : maxTokens,
});

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
      : provider === "ollama"
        ? () => callOllama(messages, systemPrompt, { preferredModel, maxTokens, temperature })
      : () => callOpenRouter(messages, systemPrompt, { preferredModel, maxTokens, temperature });

  const result = await withRetry(runner, retries, `${provider}:${preferredModel || "default"}`);
  return {
    ...result,
    responseTimeMs: Date.now() - startedAt,
  };
};

const validateAttempt = ({ question, response, responseTimeMs, nonTaxReply }) => {
  const validation = validateChatbotResponse({
    question,
    response,
    nonTaxReply,
  });
  const timedOutByThreshold = responseTimeMs > PRIMARY_TIMEOUT_THRESHOLD_MS;
  return {
    validation,
    timedOutByThreshold,
    valid: validation.valid && !timedOutByThreshold,
  };
};

const toAttemptMeta = (attempt, attemptConfig, validationIssues) => ({
  provider: attempt.provider,
  model: attempt.model,
  responseTimeMs: attempt.responseTimeMs,
  fallbackUsed: attemptConfig.fallbackUsed,
  validationIssues,
});

const executeAttemptPlan = async ({
  attempts = [],
  question,
  messages,
  systemPrompt,
  maxTokens,
  temperature,
  retries,
  nonTaxReply,
}) => {
  const results = [];
  let lastError = null;

  for (const attemptConfig of attempts) {
    try {
      const attempt = await buildAttempt({
        ...attemptConfig,
        messages,
        systemPrompt,
        maxTokens,
        temperature,
        retries,
      });

      const { validation, timedOutByThreshold, valid } = validateAttempt({
        question,
        response: attempt.response,
        responseTimeMs: attempt.responseTimeMs,
        nonTaxReply,
      });

      results.push(toAttemptMeta(attempt, attemptConfig, validation.issues));

      if (valid) {
        return {
          attempt,
          attempts: results,
          validationIssues: validation.issues,
          fallbackUsed: attemptConfig.fallbackUsed,
        };
      }

      lastError = new Error(
        timedOutByThreshold
          ? `Model exceeded timeout threshold (${attempt.responseTimeMs}ms)`
          : `Response validation failed: ${validation.issues.map((issue) => issue.code).join(", ")}`
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || "Unknown AI gateway error"));
      results.push({
        provider: attemptConfig.provider,
        model: attemptConfig.preferredModel || "",
        responseTimeMs: null,
        fallbackUsed: attemptConfig.fallbackUsed,
        validationIssues: [{ code: "provider_failure", message: lastError.message }],
      });
    }
  }

  throw Object.assign(lastError || new Error("All AI routes failed"), { attempts: results });
};

const executeParallelAttemptPlan = async ({
  primaryAttempt,
  secondaryAttempts = [],
  question,
  messages,
  systemPrompt,
  maxTokens,
  temperature,
  retries,
  nonTaxReply,
}) => {
  const executions = [primaryAttempt, ...secondaryAttempts].map((attemptConfig) =>
    buildAttempt({
      ...attemptConfig,
      messages,
      systemPrompt,
      maxTokens,
      temperature,
      retries,
    })
      .then((attempt) => ({ status: "fulfilled", attemptConfig, attempt }))
      .catch((error) => ({ status: "rejected", attemptConfig, error }))
  );

  const settled = await Promise.all(executions);
  const attempts = [];
  let lastError = null;

  for (const item of settled) {
    if (item.status === "fulfilled") {
      const { validation, timedOutByThreshold, valid } = validateAttempt({
        question,
        response: item.attempt.response,
        responseTimeMs: item.attempt.responseTimeMs,
        nonTaxReply,
      });
      attempts.push(toAttemptMeta(item.attempt, item.attemptConfig, validation.issues));
      if (valid) {
        return {
          attempt: item.attempt,
          attempts,
          validationIssues: validation.issues,
          fallbackUsed: item.attemptConfig.fallbackUsed,
        };
      }
      lastError = new Error(
        timedOutByThreshold
          ? `Model exceeded timeout threshold (${item.attempt.responseTimeMs}ms)`
          : `Response validation failed: ${validation.issues.map((issue) => issue.code).join(", ")}`
      );
    } else {
      lastError = item.error instanceof Error ? item.error : new Error(String(item.error || "Unknown AI gateway error"));
      attempts.push({
        provider: item.attemptConfig.provider,
        model: item.attemptConfig.preferredModel || "",
        responseTimeMs: null,
        fallbackUsed: item.attemptConfig.fallbackUsed,
        validationIssues: [{ code: "provider_failure", message: lastError.message }],
      });
    }
  }

  throw Object.assign(lastError || new Error("All AI routes failed"), { attempts });
};

const resolveGatewayRequest = async ({
  question,
  messages,
  systemPrompt,
  preferredModel,
  maxTokens,
  temperature,
  nonTaxReply,
  retries,
  routeHints = {},
}) => {
  const routePlan = buildRoutePlan({
    question,
    preferredModel,
    openRouterGeminiModel: process.env.OPENROUTER_GEMINI_MODEL || "google/gemini-2.0-flash-001",
    smallModel: process.env.AI_GATEWAY_SMALL_MODEL || "google/gemini-2.0-flash-001",
    mediumModel: process.env.AI_GATEWAY_MEDIUM_MODEL || process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
    largeModel: process.env.AI_GATEWAY_LARGE_MODEL || process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
    ollamaModel: process.env.AI_GATEWAY_OLLAMA_MODEL || process.env.OLLAMA_MODEL || "",
    ollamaEnabled: featureFlags.aiGatewayOllamaEnabled,
    costAwareEnabled: featureFlags.aiCostAwareRoutingEnabled,
    routeHints,
  });

  const primaryAttempt = routePlan.attempts[0];
  const secondaryAttempts = routePlan.attempts.slice(1);
  const optimizedRequest = buildOptimizedRequest({
    routeTier: routePlan.tier,
    messages,
    systemPrompt,
    maxTokens,
  });

  let execution;
  try {
    execution =
      featureFlags.aiGatewayParallelFallbackEnabled && secondaryAttempts.length > 0
        ? await executeParallelAttemptPlan({
            primaryAttempt,
            secondaryAttempts,
            question,
            messages: optimizedRequest.messages,
            systemPrompt: optimizedRequest.systemPrompt,
            maxTokens: optimizedRequest.maxTokens,
            temperature,
            retries,
            nonTaxReply,
          })
        : await executeAttemptPlan({
            attempts: routePlan.attempts,
            question,
            messages: optimizedRequest.messages,
            systemPrompt: optimizedRequest.systemPrompt,
            maxTokens: optimizedRequest.maxTokens,
            temperature,
            retries,
            nonTaxReply,
          });
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error("All AI routes failed"), {
      attempts: Array.isArray(error?.attempts) ? error.attempts : [],
      routeTier: routePlan.tier,
    });
  }

  return {
    ...execution,
    routePlan,
    optimizedRequest,
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
  routeHints = {},
} = {}) => {
  const startedAt = Date.now();
  const cacheKey = featureFlags.aiGatewayCacheEnabled
    ? buildAiGatewayCacheKey({ question, messages, preferredModel, systemPrompt })
    : "";

  if (featureFlags.aiGatewayCacheEnabled) {
    const cached = await getCachedGatewayResponse(cacheKey);
    if (cached) {
      await recordAiGatewayExecution({
        routeTier: cached.routeTier || "medium",
        provider: cached.provider || "cache",
        latencyMs: 0,
        attempts: 0,
        failed: false,
        cacheHit: true,
        modelFamily: cached?.usage?.modelFamily || "cache",
        strategy: cached?.strategy || cached?.usage?.strategy || "cached",
        workflow: routeHints?.workflow || cached?.workflow || "unknown",
      });
      return {
        ...cached,
        cached: true,
      };
    }

    const inFlight = getInFlightGatewayRequest(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const executionPromise = (async () => {
    try {
      const { attempt, attempts, validationIssues, fallbackUsed, routePlan, optimizedRequest } = await resolveGatewayRequest({
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

      const result = {
        ...attempt,
        fallbackUsed,
        validationIssues,
        attempts,
        routeTier: routePlan.tier,
        strategy: routePlan.strategy,
      };
      const usageEstimate = featureFlags.aiTokenTrackingEnabled
        ? estimateAiCost({
            provider: attempt.provider,
            model: attempt.model,
            routeTier: routePlan.tier,
            messages: optimizedRequest?.messages || messages,
            systemPrompt: optimizedRequest?.systemPrompt || systemPrompt,
            response: attempt.response,
          })
        : null;

      await recordAiGatewayExecution({
        routeTier: routePlan.tier,
        provider: attempt.provider,
        latencyMs: Date.now() - startedAt,
        attempts: attempts.length,
        failed: false,
        inputTokens: usageEstimate?.inputTokens || 0,
        outputTokens: usageEstimate?.outputTokens || 0,
        estimatedCostUsd: usageEstimate?.estimatedCostUsd || 0,
        modelFamily: usageEstimate?.modelFamily || "unknown",
        strategy: routePlan.strategy || usageEstimate?.strategy || "unknown",
        workflow: routeHints?.workflow || "unknown",
      });

      if (featureFlags.aiGatewayCacheEnabled && cacheKey) {
        await setCachedGatewayResponse(cacheKey, {
          ...result,
          strategy: routePlan.strategy,
          workflow: routeHints?.workflow || "unknown",
          usage: usageEstimate || undefined,
        });
      }

      return {
        ...result,
        usage: usageEstimate || undefined,
      };
    } catch (error) {
      const attempts = Array.isArray(error?.attempts) ? error.attempts : [];
      const routeTier = error?.routeTier || "medium";

      await recordAiGatewayExecution({
        routeTier,
        provider: attempts[attempts.length - 1]?.provider || "",
        latencyMs: Date.now() - startedAt,
        attempts: attempts.length,
        failed: true,
        strategy: "failure",
        workflow: routeHints?.workflow || "unknown",
      });

      throw Object.assign(error instanceof Error ? error : new Error("All AI routes failed"), {
        attempts,
        routeTier,
      });
    } finally {
      if (featureFlags.aiGatewayCacheEnabled && cacheKey) {
        clearInFlightGatewayRequest(cacheKey);
      }
    }
  })();

  if (featureFlags.aiGatewayCacheEnabled && cacheKey) {
    setInFlightGatewayRequest(cacheKey, executionPromise);
  }

  return executionPromise;
};

export const routeChatCompletionStream = async (params = {}) => {
  const response = await routeChatCompletion(params);
  const requestId = `aigw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const chunks = buildStreamingPreviewChunks(response.response || "");

  return {
    ...response,
    requestId,
    sseMessages: [
      ...chunks.map((chunk) =>
        createSseEnvelope({
          requestId,
          routeTier: response.routeTier,
          provider: response.provider,
          chunk,
          done: false,
        })
      ),
      createSseEnvelope({
        requestId,
        routeTier: response.routeTier,
        provider: response.provider,
        chunk: "",
        done: true,
        meta: {
          cached: Boolean(response.cached),
        },
      }),
    ],
  };
};
