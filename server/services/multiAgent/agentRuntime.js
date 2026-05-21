import { findAgentById } from "./agentRegistry.js";
import { buildHumanReviewCheckpoint } from "./humanReview.js";
import { WORKFLOW_STEP_STATUS } from "./types.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, timeoutMs) => {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`agent_timeout_${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const executeAgentStep = async ({
  workflowId = "",
  workflowRunId = "",
  step = {},
  executor,
  sharedContext = {},
} = {}) => {
  const agent = findAgentById(step.agentId);
  if (!agent) {
    throw new Error(`unknown_agent:${step.agentId}`);
  }

  if (agent.mode === "human") {
    return buildHumanReviewCheckpoint({
      workflowId,
      workflowRunId,
      reason: "human_step_requested",
      summary: `Workflow ${workflowId} requires manual execution for ${step.id}.`,
      requestedByAgentId: step.agentId,
    });
  }

  const retryLimit = Math.max(Number(step.retryLimit ?? agent.maxRetries ?? 0), 0);
  let attempt = 0;
  let lastError = null;

  while (attempt <= retryLimit) {
    attempt += 1;
    try {
      const result = await withTimeout(
        Promise.resolve(
          executor({
            step,
            agent,
            sharedContext,
            attempt,
          })
        ),
        Number(step.timeoutMs || agent.timeoutMs || 0)
      );
      return {
        status: WORKFLOW_STEP_STATUS.completed,
        agentId: step.agentId,
        stepId: step.id,
        attempt,
        result,
      };
    } catch (error) {
      lastError = error;
      if (attempt > retryLimit) break;
      await sleep(Math.min(250 * attempt, 1000));
    }
  }

  const timeoutLike = String(lastError?.message || "").startsWith("agent_timeout_");
  return {
    status: timeoutLike ? WORKFLOW_STEP_STATUS.timed_out : WORKFLOW_STEP_STATUS.failed,
    agentId: step.agentId,
    stepId: step.id,
    attempt,
    error: lastError?.message || String(lastError || "unknown_agent_error"),
  };
};
