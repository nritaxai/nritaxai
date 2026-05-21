import test from "node:test";
import assert from "node:assert/strict";
import { QUEUE_NAMES, JOB_NAMES } from "../queues/jobNames.js";

test("queue names stay stable for deployment wiring", () => {
  assert.equal(QUEUE_NAMES.pdf, "pdf-jobs");
  assert.equal(QUEUE_NAMES.notifications, "notification-jobs");
});

test("job names stay stable for worker routing", () => {
  assert.equal(JOB_NAMES.pdfIndexFile, "pdf.index-file");
  assert.equal(JOB_NAMES.consultationNotifications, "consultation.notifications");
  assert.equal(JOB_NAMES.aiWorkflow, "ai.workflow");
});
