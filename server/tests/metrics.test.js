import test from "node:test";
import assert from "node:assert/strict";
import {
  getMetricsOutput,
  recordAuthEvent,
  recordAiMetric,
  recordCacheMetric,
  recordCacheOperationMetric,
  recordDbOperationMetric,
  recordDocumentProcessingMetric,
  recordHttpRequestMetric,
  recordPaymentMetric,
  recordQueueResultMetric,
  setAuthActiveSessionsMetric,
  setCacheBackendStateMetric,
  setWorkerActiveJobsMetric,
  setWorkerConcurrencyMetric,
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
    inputTokens: 540,
    outputTokens: 210,
    estimatedCostUsd: 0.0045,
    modelFamily: "premium",
    strategy: "rag-small",
  });
  recordCacheMetric({
    layer: "ai_gateway_response",
    hit: true,
  });
  recordCacheOperationMetric({
    layer: "ai_gateway_response",
    backend: "redis",
    operation: "get",
    durationMs: 8,
  });
  setCacheBackendStateMetric({
    backend: "redis",
    role: "cache",
    connected: true,
  });
  recordQueueResultMetric({
    queueName: "payment-jobs",
    jobName: "payment.reconcile",
    status: "completed",
    durationMs: 75,
    waitMs: 10,
  });
  setWorkerConcurrencyMetric({
    queueName: "payment-jobs",
    workerGroup: "priority",
    concurrency: 6,
  });
  setWorkerActiveJobsMetric({
    queueName: "payment-jobs",
    workerGroup: "priority",
    activeJobs: 2,
    concurrency: 6,
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
  recordDocumentProcessingMetric({
    workflow: "pdf-index",
    extractionMode: "native_text",
    status: "completed",
    durationMs: 42,
    fileSizeBytes: 4096,
    pages: 3,
  });
  recordAuthEvent({
    action: "login_success",
    status: "success",
    provider: "local",
  });
  setAuthActiveSessionsMetric({
    provider: "local",
    count: 3,
  });

  const output = getMetricsOutput();

  assert.match(output, /nritax_http_requests_total/);
  assert.match(output, /nritax_ai_latency_ms_bucket/);
  assert.match(output, /nritax_ai_tokens_total/);
  assert.match(output, /nritax_ai_estimated_cost_usd_total/);
  assert.match(output, /nritax_ai_route_strategy_total/);
  assert.match(output, /nritax_ai_workflow_requests_total/);
  assert.match(output, /nritax_cache_requests_total/);
  assert.match(output, /nritax_cache_operation_duration_ms_bucket/);
  assert.match(output, /nritax_cache_backend_state/);
  assert.match(output, /nritax_queue_job_duration_ms_bucket/);
  assert.match(output, /nritax_worker_concurrency_configured/);
  assert.match(output, /nritax_worker_jobs_active/);
  assert.match(output, /nritax_worker_utilization_ratio/);
  assert.match(output, /nritax_document_processing_runs_total/);
  assert.match(output, /nritax_document_processing_duration_ms_bucket/);
  assert.match(output, /nritax_document_processing_bytes_total/);
  assert.match(output, /nritax_db_operation_duration_ms_bucket/);
  assert.match(output, /nritax_payment_attempts_total/);
  assert.match(output, /nritax_auth_events_total/);
  assert.match(output, /nritax_auth_sessions_active/);
});
