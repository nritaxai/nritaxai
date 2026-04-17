import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBasicRagContext,
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
  assert.equal(NON_TAX_QUERY_REPLY, "I can only assist with NRI and tax-related queries.");
});

test("buildBasicRagContext includes DTAA and TDS context when relevant", () => {
  const context = buildBasicRagContext("Explain DTAA relief and TDS on NRI property sale proceeds");

  assert.match(context, /DTAA Context:/);
  assert.match(context, /TDS Context:/);
  assert.match(context, /NRI Taxation Context:/);
});
