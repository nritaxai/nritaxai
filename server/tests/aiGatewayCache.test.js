import test from "node:test";
import assert from "node:assert/strict";
import { buildAiGatewayCacheKey } from "../services/aiGateway/cacheStore.js";
import { buildStreamingPreviewChunks } from "../services/aiGateway/stream.js";

test("buildAiGatewayCacheKey is stable for equivalent message windows", () => {
  const first = buildAiGatewayCacheKey({
    question: "How is NRO interest taxed?",
    preferredModel: "claude",
    systemPrompt: "tax prompt",
    messages: [{ role: "user", content: "How is NRO interest taxed?" }],
  });

  const second = buildAiGatewayCacheKey({
    question: "How is NRO interest taxed?",
    preferredModel: "claude",
    systemPrompt: "tax prompt",
    messages: [{ role: "user", content: "How is NRO interest taxed?" }],
  });

  assert.equal(first, second);
});

test("buildStreamingPreviewChunks splits long answers into deterministic chunks", () => {
  const chunks = buildStreamingPreviewChunks("A".repeat(250), 100);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 100);
  assert.equal(chunks[2].length, 50);
});
