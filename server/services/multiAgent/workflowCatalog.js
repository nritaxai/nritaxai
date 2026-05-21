import { AGENT_IDS, WORKFLOW_IDS } from "./types.js";

const catalog = {
  [WORKFLOW_IDS.taxAdvice]: {
    id: WORKFLOW_IDS.taxAdvice,
    description: "Conversation-first tax reasoning workflow with optional validation and compliance review.",
    asyncPreferred: false,
    humanReviewSupported: true,
    steps: [
      { id: "conversation-intake", agentId: AGENT_IDS.conversational, timeoutMs: 8000, retryLimit: 0 },
      { id: "tax-reasoning", agentId: AGENT_IDS.taxReasoning, timeoutMs: 20000, retryLimit: 1 },
      { id: "validation", agentId: AGENT_IDS.validation, timeoutMs: 8000, retryLimit: 1, optional: true },
      { id: "compliance-check", agentId: AGENT_IDS.compliance, timeoutMs: 8000, retryLimit: 1, optional: true },
    ],
  },
  [WORKFLOW_IDS.documentReview]: {
    id: WORKFLOW_IDS.documentReview,
    description: "Document extraction with tax validation and optional compliance checks.",
    asyncPreferred: true,
    humanReviewSupported: true,
    steps: [
      { id: "document-extraction", agentId: AGENT_IDS.documentExtraction, timeoutMs: 30000, retryLimit: 2 },
      { id: "validation", agentId: AGENT_IDS.validation, timeoutMs: 10000, retryLimit: 1 },
      { id: "compliance-check", agentId: AGENT_IDS.compliance, timeoutMs: 10000, retryLimit: 1, optional: true },
    ],
  },
  [WORKFLOW_IDS.complianceReview]: {
    id: WORKFLOW_IDS.complianceReview,
    description: "Reasoning, evidence validation, and compliance-focused checks for higher-risk outputs.",
    asyncPreferred: true,
    humanReviewSupported: true,
    steps: [
      { id: "tax-reasoning", agentId: AGENT_IDS.taxReasoning, timeoutMs: 20000, retryLimit: 1 },
      { id: "validation", agentId: AGENT_IDS.validation, timeoutMs: 8000, retryLimit: 1 },
      { id: "compliance-check", agentId: AGENT_IDS.compliance, timeoutMs: 10000, retryLimit: 1 },
    ],
  },
};

export const getWorkflowDefinition = (workflowId = "") =>
  catalog[String(workflowId || "").trim()] || null;

export const getAllWorkflowDefinitions = () => Object.values(catalog);
