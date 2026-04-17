import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBasicRagContext,
  buildGemmaPrompt,
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
  assert.equal(isTaxRelatedQuery("Write me an Instagram caption for my vacation"), false);
  assert.equal(
    NON_TAX_QUERY_REPLY,
    "I specialize only in NRI and Indian tax matters. Please ask tax-related questions."
  );
});

test("buildBasicRagContext includes DTAA and TDS context when relevant", () => {
  const context = buildBasicRagContext("Explain DTAA relief and TDS on NRI property sale proceeds");

  assert.match(context, /DTAA Context:/);
  assert.match(context, /TDS Context:/);
  assert.match(context, /NRI Taxation Context:/);
});

test("buildGemmaPrompt includes the NRI tax consultant guardrails", () => {
  const prompt = buildGemmaPrompt({
    selectedLanguage: { instruction: "Respond only in English." },
    contextualMessages: [{ role: "user", content: "What is DTAA for NRIs?" }],
    hiddenContext: "",
  });

  assert.match(
    prompt,
    /You are an expert NRI Tax Consultant with 15\+ years of experience in Indian taxation, international tax treaties, and cross-border financial compliance\./
  );
  assert.match(prompt, /=== CORE EXPERTISE ===/);
  assert.match(prompt, /Section 195 generally applies to many payments to non-residents\./);
  assert.match(prompt, /Use this exact response format in markdown:/);
  assert.match(
    prompt,
    /I specialize only in NRI and Indian tax matters\. Please ask tax-related questions\./
  );
});
