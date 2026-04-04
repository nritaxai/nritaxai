import test from "node:test";
import assert from "node:assert/strict";

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
