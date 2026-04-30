import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBasicRagContext,
  buildChatPrompt,
  isTaxRelatedQuery,
  NON_TAX_QUERY_REPLY,
} from "../Controllers/chatController.js";
import { buildHiddenContextFromMatches } from "../Utils/chatPromptContext.js";

test("buildHiddenContextFromMatches limits retrieved context size for faster chat requests", () => {
  const largeText = "A".repeat(1200);
  const context = buildHiddenContextFromMatches([
    { text: largeText },
    { text: `B${"B".repeat(1200)}` },
    { text: `C${"C".repeat(1200)}` },
  ]);

  assert.ok(context.length <= 1400);
  assert.match(context, /^A+/);
  assert.ok(!context.includes(`C${"C".repeat(50)}`));
});

test("isTaxRelatedQuery allows NRI tax questions and blocks unrelated questions", () => {
  assert.equal(isTaxRelatedQuery("How does DTAA apply to NRI rental income from India?"), true);
  assert.equal(isTaxRelatedQuery("What's the difference between NRO and NRE accounts?"), true);
  assert.equal(isTaxRelatedQuery("Write me an Instagram caption for my vacation"), false);
  assert.equal(
    NON_TAX_QUERY_REPLY,
    "Please ask a tax-related question."
  );
});

test("buildBasicRagContext includes DTAA and TDS context when relevant", () => {
  const context = buildBasicRagContext("Explain DTAA relief and TDS on NRI property sale proceeds");

  assert.match(context, /DTAA Context:/);
  assert.match(context, /TDS Context:/);
  assert.match(context, /NRI Taxation Context:/);
});

test("buildChatPrompt prioritizes retrieved context and preserves tax-only guardrails", () => {
  const prompt = buildChatPrompt({
    selectedLanguage: { instruction: "Respond only in English." },
    contextualMessages: [{ role: "user", content: "What is DTAA for NRIs?" }],
    hiddenContext: "DTAA stands for Double Tax Avoidance Agreement.",
  });

  assert.match(prompt, /=== RETRIEVED CONTEXT \(HIGHEST PRIORITY\) ===/);
  assert.match(prompt, /DTAA stands for Double Tax Avoidance Agreement\./);
  assert.match(prompt, /- You MUST use the above context to answer\./);
  assert.match(prompt, /- DO NOT create your own definitions\./);
  assert.match(prompt, /Section 195 applies to payments made to NRIs\./);
  assert.match(prompt, /Please ask a tax-related question\./);
});
