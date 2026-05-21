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

test("classifyRouteTier keeps short treaty chat prompts on the medium lane", () => {
  assert.equal(
    classifyRouteTier({
      question: "What DTAA relief applies to UAE salary income?",
      routeHints: {
        workflow: "chat_dtaa",
        ragLikely: true,
        retrievedContextChars: 900,
      },
    }),
    "medium"
  );
});

test("buildRoutePlan preserves medium route fallback sequence", () => {
  const plan = buildRoutePlan({
    question: "Explain NRO interest taxation, DTAA relief documentation, and filing implications for an NRI in the UAE.",
    smallModel: "google/gemini-2.0-flash-001",
    mediumModel: "anthropic/claude-3.5-sonnet",
    preferredModel: "anthropic/claude-3.5-sonnet",
  });

  assert.equal(plan.tier, "medium");
  assert.equal(plan.strategy, "rag-small");
  assert.equal(plan.attempts[0].provider, "openrouter");
  assert.equal(plan.attempts[0].preferredModel, "google/gemini-2.0-flash-001");
  assert.equal(plan.attempts[1].provider, "openrouter");
  assert.equal(plan.attempts[1].preferredModel, "anthropic/claude-3.5-sonnet");
  assert.equal(plan.attempts[2].provider, "gemini-direct");
});
