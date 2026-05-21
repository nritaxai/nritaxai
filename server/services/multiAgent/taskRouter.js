import { WORKFLOW_IDS } from "./types.js";
import { isMultiAgentAsyncEnabled, isMultiAgentOrchestrationEnabled } from "./runtimeConfig.js";

const textContains = (text = "", pattern) => pattern.test(String(text || ""));

export const routeAgentWorkflow = ({
  workflowHint = "",
  question = "",
  hasDocuments = false,
  requiresCompliance = false,
} = {}) => {
  if (!isMultiAgentOrchestrationEnabled()) {
    return {
      enabled: false,
      workflowId: null,
      executionMode: "legacy",
      reasons: ["multi_agent_disabled"],
    };
  }

  if (workflowHint === "document-review" || hasDocuments) {
    return {
      enabled: true,
      workflowId: WORKFLOW_IDS.documentReview,
      executionMode: isMultiAgentAsyncEnabled() ? "async_preferred" : "sync_preview",
      reasons: ["documents_detected"],
    };
  }

  if (
    requiresCompliance ||
    textContains(question, /\b(compliance|pep|sanction|form 10f|trc|beneficial ownership|validation)\b/i)
  ) {
    return {
      enabled: true,
      workflowId: WORKFLOW_IDS.complianceReview,
      executionMode: isMultiAgentAsyncEnabled() ? "async_preferred" : "sync_preview",
      reasons: ["compliance_signals"],
    };
  }

  return {
    enabled: true,
    workflowId: WORKFLOW_IDS.taxAdvice,
    executionMode: "sync_preview",
    reasons: ["default_tax_advice"],
  };
};
