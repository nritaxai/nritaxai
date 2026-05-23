import test from "node:test";
import assert from "node:assert/strict";

import { classifyClarificationQuery } from "../services/ai/classifier.js";

test("classifier routes direct educational DTAA questions to general info", () => {
  const result = classifyClarificationQuery({ question: "What is DTAA?" });
  assert.equal(result.category, "GENERAL_INFO");
  assert.equal(result.answerDirectly, true);
});

test("classifier routes return filing questions to tax filing", () => {
  const result = classifyClarificationQuery({ question: "Do I need to file ITR as an NRI?" });
  assert.equal(result.category, "TAX_FILING");
  assert.equal(result.answerDirectly, false);
});

test("classifier routes relocation scenarios to year specific guidance", () => {
  const result = classifyClarificationQuery({
    question: "I moved from Indonesia to Singapore and need tax guidance.",
  });
  assert.equal(result.category, "YEAR_SPECIFIC");
});
