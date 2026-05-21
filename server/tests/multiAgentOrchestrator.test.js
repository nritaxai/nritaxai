import test from "node:test";
import assert from "node:assert/strict";
import { orchestrateMultiAgentWorkflow, planMultiAgentWorkflow } from "../services/multiAgent/orchestrator.js";
import { WORKFLOW_IDS, WORKFLOW_STEP_STATUS } from "../services/multiAgent/types.js";

test("multi-agent planner stays disabled by default for backward compatibility", () => {
  const previous = process.env.MULTI_AGENT_ORCHESTRATION_ENABLED;
  delete process.env.MULTI_AGENT_ORCHESTRATION_ENABLED;

  const plan = planMultiAgentWorkflow({
    question: "Review DTAA treatment for salary income.",
  });

  assert.equal(plan.route.enabled, false);
  assert.equal(plan.route.executionMode, "legacy");

  if (previous === undefined) delete process.env.MULTI_AGENT_ORCHESTRATION_ENABLED;
  else process.env.MULTI_AGENT_ORCHESTRATION_ENABLED = previous;
});

test("multi-agent planner routes document workflows when enabled", () => {
  const previous = process.env.MULTI_AGENT_ORCHESTRATION_ENABLED;
  process.env.MULTI_AGENT_ORCHESTRATION_ENABLED = "true";

  const plan = planMultiAgentWorkflow({
    question: "Extract Form 10F fields from this document and validate them.",
    hasDocuments: true,
  });

  assert.equal(plan.route.enabled, true);
  assert.equal(plan.route.workflowId, WORKFLOW_IDS.documentReview);

  if (previous === undefined) delete process.env.MULTI_AGENT_ORCHESTRATION_ENABLED;
  else process.env.MULTI_AGENT_ORCHESTRATION_ENABLED = previous;
});

test("multi-agent orchestrator runs scaffold workflow steps without impacting legacy mode", async () => {
  const previous = {
    MULTI_AGENT_ORCHESTRATION_ENABLED: process.env.MULTI_AGENT_ORCHESTRATION_ENABLED,
    MULTI_AGENT_ASYNC_ENABLED: process.env.MULTI_AGENT_ASYNC_ENABLED,
  };
  process.env.MULTI_AGENT_ORCHESTRATION_ENABLED = "true";
  process.env.MULTI_AGENT_ASYNC_ENABLED = "true";

  const result = await orchestrateMultiAgentWorkflow({
    question: "Check compliance requirements for TRC and Form 10F.",
    requiresCompliance: true,
  });

  assert.equal(result.workflowId, WORKFLOW_IDS.complianceReview);
  assert.equal(Array.isArray(result.steps), true);
  assert.equal(result.steps.length >= 1, true);
  assert.equal(result.steps[0].status, WORKFLOW_STEP_STATUS.completed);

  Object.entries(previous).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
});
