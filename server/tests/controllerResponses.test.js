import test from "node:test";
import assert from "node:assert/strict";
import { respondError, respondLegacyError, respondOk } from "../services/controllerResponses.js";

const createResponseMock = () => {
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

test("respondOk writes success payloads with default status", () => {
  const res = createResponseMock();
  respondOk(res, { ok: true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
});

test("respondError writes message payloads consistently", () => {
  const res = createResponseMock();
  respondError(res, 400, "Invalid request", { success: false });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { success: false, message: "Invalid request" });
});

test("respondLegacyError preserves legacy error key shape", () => {
  const res = createResponseMock();
  respondLegacyError(res, 500, "Broken", "error");
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "Broken" });
});
