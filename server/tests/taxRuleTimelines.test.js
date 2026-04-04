import test from "node:test";
import assert from "node:assert/strict";

import { calculateCapitalGainsTax } from "../Controllers/calculatorController.js";
import {
  appendTimelineToAnswer,
  getTaxRuleTimelinesForQuery,
  resolveApplicablePeriod,
} from "../Utils/taxRuleTimelines.js";

const createMockRes = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return response;
};

test("getTaxRuleTimelinesForQuery returns dated periods for LTCG questions", () => {
  const timelines = getTaxRuleTimelinesForQuery("Explain LTCG on listed equity after the new law change.");
  assert.equal(timelines.length, 1);
  assert.equal(timelines[0].ruleName, "India LTCG on listed equity");
  assert.equal(timelines[0].periods[0].label, "Before 31 Mar 2026");
  assert.equal(timelines[0].periods[1].label, "From 1 Apr 2026");
});

test("resolveApplicablePeriod selects the pre-change LTCG rule for earlier dates", () => {
  const [timeline] = getTaxRuleTimelinesForQuery("LTCG tax");
  const applicable = resolveApplicablePeriod(timeline.periods, "2026-03-15");
  assert.equal(applicable.rate, 0.1);
  assert.equal(applicable.exemption, 100000);
});

test("appendTimelineToAnswer injects date-wise tax rule sections into markdown", () => {
  const timelines = getTaxRuleTimelinesForQuery("LTCG tax");
  const reply = appendTimelineToAnswer(
    "### Answer\nLTCG rates changed recently.\n\n### Key Tax Points\n- Point one.\n- Point two.\n\n### Next Steps\n1. First.\n2. Second.\n\n### Follow-up Questions\n- One?\n- Two?",
    timelines
  );

  assert.match(reply, /#### India LTCG on listed equity/);
  assert.match(reply, /Before 31 Mar 2026: 10% tax, ₹1,00,000 exemption/);
  assert.match(reply, /From 1 Apr 2026: 12.5% tax, ₹1,25,000 exemption/);
});

test("calculateCapitalGainsTax uses dated LTCG rule when sale date is before 1 Apr 2026", () => {
  const req = {
    body: {
      purchasePrice: 1000000,
      salePrice: 1500000,
      period: "long-term",
      saleDate: "2026-03-20",
    },
  };
  const res = createMockRes();

  calculateCapitalGainsTax(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.result.rate, 0.1);
  assert.equal(res.body.result.baseTax, 50000);
  assert.equal(res.body.result.applicableRule.label, "Before 31 Mar 2026");
  assert.equal(res.body.result.taxRuleTimelines[0].periods.length, 2);
});
