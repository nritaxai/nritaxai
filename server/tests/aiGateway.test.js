import test from "node:test";
import assert from "node:assert/strict";
import { buildRoutePlan, classifyRouteTier } from "../services/aiGateway/router.js";

test("classifyRouteTier routes extraction-style prompts to small models", () => {
  assert.equal(classifyRouteTier({ question: "Extract PAN and summarize TDS obligations." }), "small");
});

test("classifyRouteTier routes multi-country treaty prompts to large models", () => {
  assert.equal(
    classifyRouteTier({ question: "Compare DTAA treatment for multi-country salary and foreign tax credit." }),
    "large"
  );
});

test("buildRoutePlan preserves medium route fallback sequence", () => {
  const plan = buildRoutePlan({
    question: "How is NRO interest taxed for an NRI in the UAE?",
    preferredModel: "anthropic/claude-3.5-sonnet",
  });

  assert.equal(plan.tier, "medium");
  assert.equal(plan.attempts[0].provider, "openrouter");
  assert.equal(plan.attempts[1].provider, "openrouter");
  assert.equal(plan.attempts[2].provider, "gemini-direct");
});
