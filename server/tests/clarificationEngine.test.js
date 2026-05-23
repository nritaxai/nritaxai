import test from "node:test";
import assert from "node:assert/strict";

import { resolveClarificationTurn } from "../services/ai/clarificationEngine.js";

test("general educational questions answer directly without clarification", () => {
  const result = resolveClarificationTurn({
    question: "What is DTAA?",
    knowledgeSource: "dtaa",
  });

  assert.equal(result.shouldClarify, false);
  assert.equal(result.routing.category, "GENERAL_INFO");
});

test("dtaa benefit question asks only residence country first", () => {
  const result = resolveClarificationTurn({
    question: "How does DTAA help me?",
    knowledgeSource: "dtaa",
  });

  assert.equal(result.shouldClarify, true);
  assert.deepEqual(result.pendingFields, ["residenceCountry"]);
  assert.match(result.nextQuestion, /currently residing in/i);
});

test("relocation scenario asks year first and then country for that year", () => {
  const firstTurn = resolveClarificationTurn({
    question: "I moved from Indonesia to Singapore and need tax guidance.",
    knowledgeSource: "dtaa",
  });

  assert.equal(firstTurn.shouldClarify, true);
  assert.deepEqual(firstTurn.pendingFields, ["financialYear", "residenceCountry"]);
  assert.match(firstTurn.nextQuestion, /financial year/i);

  const secondTurn = resolveClarificationTurn({
    question: "FY 2025-26",
    knowledgeSource: "dtaa",
    sessionState: firstTurn.state,
  });

  assert.equal(secondTurn.shouldClarify, true);
  assert.deepEqual(secondTurn.pendingFields, ["residenceCountry"]);
  assert.match(secondTurn.nextQuestion, /during that year/i);
});

test("tax filing reuses stored country and asks only income type", () => {
  const result = resolveClarificationTurn({
    question: "Do I need to file ITR as an NRI?",
    knowledgeSource: "dtaa",
    sessionState: {
      active: false,
      context: { residenceCountry: "Singapore" },
    },
  });

  assert.equal(result.shouldClarify, true);
  assert.deepEqual(result.pendingFields, ["incomeType"]);
});

test("new question can override stored country context safely", () => {
  const result = resolveClarificationTurn({
    question: "I now live in UAE. Do I need to file ITR as an NRI?",
    knowledgeSource: "dtaa",
    sessionState: {
      active: false,
      context: { residenceCountry: "Singapore" },
    },
  });

  assert.equal(result.context.residenceCountry, "United Arab Emirates");
  assert.deepEqual(result.pendingFields, ["incomeType"]);
});
