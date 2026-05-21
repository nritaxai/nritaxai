import test from "node:test";
import assert from "node:assert/strict";
import {
  getSelectedQueues,
  getWorkerConcurrencyForQueue,
  getWorkerGroup,
} from "../workers/runtimeConfig.js";

test("worker runtime config defaults stay backward compatible", () => {
  const previous = {
    WORKER_QUEUES: process.env.WORKER_QUEUES,
    WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY,
    WORKER_GROUP: process.env.WORKER_GROUP,
  };

  delete process.env.WORKER_QUEUES;
  delete process.env.WORKER_CONCURRENCY;
  delete process.env.WORKER_GROUP;

  assert.deepEqual(getSelectedQueues(), [
    "pdf-jobs",
    "ai-jobs",
    "report-jobs",
    "notification-jobs",
    "payment-jobs",
  ]);
  assert.equal(getWorkerConcurrencyForQueue("ai-jobs"), 4);
  assert.equal(getWorkerGroup(), "default");

  Object.entries(previous).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
});

test("worker runtime config supports queue isolation and per-queue concurrency overrides", () => {
  const previous = {
    WORKER_QUEUES: process.env.WORKER_QUEUES,
    WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY,
    WORKER_CONCURRENCY__AI_JOBS: process.env.WORKER_CONCURRENCY__AI_JOBS,
    WORKER_GROUP: process.env.WORKER_GROUP,
  };

  process.env.WORKER_QUEUES = "payments, notifications";
  process.env.WORKER_CONCURRENCY = "3";
  process.env.WORKER_CONCURRENCY__AI_JOBS = "2";
  process.env.WORKER_GROUP = "priority";

  assert.deepEqual(getSelectedQueues(), ["payment-jobs", "notification-jobs"]);
  assert.equal(getWorkerConcurrencyForQueue("ai-jobs"), 2);
  assert.equal(getWorkerConcurrencyForQueue("payment-jobs"), 3);
  assert.equal(getWorkerGroup(), "priority");

  Object.entries(previous).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
});
