import { logger } from "../logger.js";
import { executeAgentStep } from "./agentRuntime.js";
import { recordAgentMessage } from "./communicationBus.js";
import { appendWorkflowArtifact, createWorkflowMemory, upsertWorkflowMemory } from "./memoryStore.js";
import { routeAgentWorkflow } from "./taskRouter.js";
import { getWorkflowDefinition } from "./workflowCatalog.js";
import { AGENT_IDS, MEMORY_SCOPES, WORKFLOW_STEP_STATUS } from "./types.js";

const createWorkflowRunId = () =>
  `maw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const defaultExecutor = async ({ step, sharedContext, attempt }) => ({
  mode: "scaffold",
  stepId: step.id,
  agentId: step.agentId,
  attempt,
  sharedContextKeys: Object.keys(sharedContext || {}),
});

export const planMultiAgentWorkflow = (input = {}) => {
  const route = routeAgentWorkflow(input);
  const definition = route.workflowId ? getWorkflowDefinition(route.workflowId) : null;
  return {
    route,
    definition,
  };
};

export const orchestrateMultiAgentWorkflow = async ({
  workflowHint = "",
  question = "",
  hasDocuments = false,
  requiresCompliance = false,
  executor = defaultExecutor,
  scope = MEMORY_SCOPES.request,
  scopeId = "",
  seedContext = {},
} = {}) => {
  const runId = createWorkflowRunId();
  const { route, definition } = planMultiAgentWorkflow({
    workflowHint,
    question,
    hasDocuments,
    requiresCompliance,
  });

  if (!route.enabled || !definition) {
    return {
      mode: "legacy",
      workflowRunId: runId,
      route,
      steps: [],
    };
  }

  createWorkflowMemory({
    scope,
    scopeId: scopeId || runId,
    seed: {
      question,
      workflowId: definition.id,
      routeReasons: route.reasons,
      ...seedContext,
    },
  });

  const steps = [];
  let currentStatus = WORKFLOW_STEP_STATUS.completed;
  let sharedContext = {
    question,
    workflowId: definition.id,
    workflowRunId: runId,
    ...seedContext,
  };

  recordAgentMessage({
    workflowId: definition.id,
    workflowRunId: runId,
    fromAgentId: AGENT_IDS.orchestrator,
    toAgentId: definition.steps[0]?.agentId || "",
    kind: "workflow_started",
    payload: {
      route,
    },
  });

  for (const step of definition.steps) {
    const result = await executeAgentStep({
      workflowId: definition.id,
      workflowRunId: runId,
      step,
      executor,
      sharedContext,
    });
    steps.push(result);
    appendWorkflowArtifact({
      scope,
      scopeId: scopeId || runId,
      artifact: {
        type: "step_result",
        stepId: step.id,
        status: result.status,
        agentId: step.agentId,
      },
    });

    if (result.status !== WORKFLOW_STEP_STATUS.completed) {
      currentStatus = result.status;
      if (!step.optional) {
        break;
      }
      continue;
    }

    sharedContext = {
      ...sharedContext,
      [step.id]: result.result,
    };
  }

  upsertWorkflowMemory({
    scope,
    scopeId: scopeId || runId,
    patch: {
      context: {
        finalStatus: currentStatus,
        workflowId: definition.id,
        executionMode: route.executionMode,
      },
    },
  });

  logger.info(
    {
      workflowId: definition.id,
      workflowRunId: runId,
      status: currentStatus,
      steps: steps.length,
      executionMode: route.executionMode,
    },
    "multi-agent workflow orchestrated"
  );

  return {
    mode: route.executionMode,
    workflowId: definition.id,
    workflowRunId: runId,
    status: currentStatus,
    route,
    steps,
  };
};
