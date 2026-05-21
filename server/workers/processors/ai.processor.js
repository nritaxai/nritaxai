import { orchestrateMultiAgentWorkflow } from "../../services/multiAgent/orchestrator.js";

export const processAiGenerationJob = async (payload) => {
  return {
    accepted: true,
    mode: "placeholder",
    jobType: "ai.generation",
    payloadSummary: {
      promptType: payload?.promptType || "unknown",
    },
  };
};

export const processAiEmbeddingJob = async (payload) => {
  return {
    accepted: true,
    mode: "placeholder",
    jobType: "ai.embedding",
    payloadSummary: {
      source: payload?.source || "unknown",
    },
  };
};

export const processAiWorkflowJob = async (payload) => {
  const result = await orchestrateMultiAgentWorkflow({
    workflowHint: payload?.workflowHint || "",
    question: payload?.question || "",
    hasDocuments: Boolean(payload?.hasDocuments),
    requiresCompliance: Boolean(payload?.requiresCompliance),
    seedContext: payload?.seedContext || {},
  });

  return {
    accepted: true,
    mode: result.mode,
    jobType: "ai.workflow",
    workflowId: result.workflowId || "",
    workflowRunId: result.workflowRunId,
    status: result.status || "completed",
    stepCount: Array.isArray(result.steps) ? result.steps.length : 0,
  };
};
