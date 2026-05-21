export const AGENT_IDS = {
  orchestrator: "workflow-orchestrator",
  taxReasoning: "tax-reasoning",
  documentExtraction: "document-extraction",
  validation: "validation",
  compliance: "compliance-check",
  conversational: "conversational-assistant",
  humanReview: "human-review",
};

export const AGENT_CAPABILITIES = {
  tax_reasoning: "tax_reasoning",
  document_extraction: "document_extraction",
  validation: "validation",
  compliance_check: "compliance_check",
  conversation: "conversation",
  workflow_orchestration: "workflow_orchestration",
  human_review: "human_review",
};

export const WORKFLOW_IDS = {
  taxAdvice: "tax-advice.v1",
  documentReview: "document-review.v1",
  complianceReview: "compliance-review.v1",
};

export const WORKFLOW_STEP_STATUS = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
  timed_out: "timed_out",
  human_review_required: "human_review_required",
};

export const MEMORY_SCOPES = {
  request: "request",
  session: "session",
  workflow: "workflow",
};
