import test from "node:test";
import assert from "node:assert/strict";
import {
  compressGatewayMessages,
  compressSystemPrompt,
  estimateAiCost,
  getTierStrategy,
  resolveTokenBudget,
} from "../services/aiGateway/costEngineering.js";

test("resolveTokenBudget applies tighter default caps by route tier", () => {
  assert.equal(resolveTokenBudget({ routeTier: "small" }), 384);
  assert.equal(resolveTokenBudget({ routeTier: "medium" }), 768);
  assert.equal(resolveTokenBudget({ routeTier: "large" }), 1400);
  assert.equal(resolveTokenBudget({ routeTier: "small", maxTokens: 5000 }), 640);
});

test("compressSystemPrompt returns compact instructions for lightweight tiers", () => {
  const prompt = "x".repeat(8000);
  assert.ok(compressSystemPrompt({ routeTier: "small", systemPrompt: prompt }).length < 700);
  assert.ok(compressSystemPrompt({ routeTier: "medium", systemPrompt: prompt }).length < 900);
  assert.ok(compressSystemPrompt({ routeTier: "large", systemPrompt: prompt }).length < prompt.length);
});

test("compressGatewayMessages keeps recent context but trims large payloads", () => {
  const messages = new Array(6).fill(null).map((_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `message-${index} ${"A".repeat(5000)}`,
  }));

  const compressed = compressGatewayMessages({ routeTier: "small", messages });
  assert.equal(compressed.length, 3);
  assert.ok(compressed.every((message) => message.content.length < 2600));
});

test("estimateAiCost produces token and strategy telemetry", () => {
  const usage = estimateAiCost({
    provider: "openrouter",
    model: "google/gemini-2.0-flash-001",
    routeTier: "small",
    systemPrompt: "Short prompt",
    messages: [{ role: "user", content: "How is NRO interest taxed?" }],
    response: "Interest on an NRO account is generally taxable in India.",
  });

  assert.equal(getTierStrategy("small"), "lightweight");
  assert.ok(usage.inputTokens > 0);
  assert.ok(usage.outputTokens > 0);
  assert.ok(usage.totalTokens >= usage.inputTokens);
  assert.equal(usage.strategy, "lightweight");
  assert.ok(usage.estimatedCostUsd >= 0);
});
