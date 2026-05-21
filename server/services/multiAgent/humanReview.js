import { AGENT_IDS, WORKFLOW_STEP_STATUS } from "./types.js";
import { recordAgentMessage } from "./communicationBus.js";
import { isMultiAgentHumanReviewEnabled } from "./runtimeConfig.js";

export const buildHumanReviewCheckpoint = ({
  workflowId = "",
  workflowRunId = "",
  reason = "manual_review_requested",
  summary = "",
  requestedByAgentId = AGENT_IDS.orchestrator,
} = {}) => {
  const checkpoint = {
    status: isMultiAgentHumanReviewEnabled()
      ? WORKFLOW_STEP_STATUS.human_review_required
      : WORKFLOW_STEP_STATUS.failed,
    humanReviewRequired: isMultiAgentHumanReviewEnabled(),
    reason,
    summary,
    requestedByAgentId,
    createdAt: new Date().toISOString(),
  };

  recordAgentMessage({
    workflowId,
    workflowRunId,
    fromAgentId: requestedByAgentId,
    toAgentId: AGENT_IDS.humanReview,
    kind: "human_review_requested",
    payload: checkpoint,
  });

  return checkpoint;
};
