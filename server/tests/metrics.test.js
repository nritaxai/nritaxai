import test from "node:test";
import assert from "node:assert/strict";
import {
  getMetricsOutput,
  recordAiMetric,
  recordCacheMetric,
  recordDbOperationMetric,
  recordHttpRequestMetric,
  recordPaymentMetric,
  recordQueueResultMetric,
} from "../services/metrics.js";

test("metrics output exposes observability series for core production signals", () => {
  recordHttpRequestMetric({
    method: "POST",
    route: "/api/chat",
    statusCode: 200,
    durationMs: 120,
  });
  recordAiMetric({
    routeTier: "medium",
    provider: "openrouter",
    latencyMs: 320,
    failed: false,
  });
  recordCacheMetric({
    layer: "ai_gateway_response",
    hit: true,
  });
  recordQueueResultMetric({
    queueName: "payment-jobs",
    jobName: "payment.reconcile",
    status: "completed",
    durationMs: 75,
    waitMs: 10,
  });
  recordDbOperationMetric({
    operation: "findOne",
    collection: "users",
    durationMs: 18,
    failed: false,
  });
  recordPaymentMetric({
    provider: "razorpay",
    status: "verified",
  });

  const output = getMetricsOutput();

  assert.match(output, /nritax_http_requests_total/);
  assert.match(output, /nritax_ai_latency_ms_bucket/);
  assert.match(output, /nritax_cache_requests_total/);
  assert.match(output, /nritax_queue_job_duration_ms_bucket/);
  assert.match(output, /nritax_db_operation_duration_ms_bucket/);
  assert.match(output, /nritax_payment_attempts_total/);
});
