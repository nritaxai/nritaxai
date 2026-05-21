import { featureFlags } from "../Config/featureFlags.js";
import http from "node:http";

const DEFAULT_HISTOGRAM_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

const escapeHelp = (value = "") => String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
const escapeLabelValue = (value = "") =>
  String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');

const normalizeLabels = (labelNames = [], labels = {}) =>
  labelNames.reduce((acc, labelName) => {
    acc[labelName] = String(labels?.[labelName] ?? "");
    return acc;
  }, {});

const serializeLabels = (labelNames = [], labels = {}) => {
  if (!labelNames.length) return "";
  const normalized = normalizeLabels(labelNames, labels);
  return `{${labelNames.map((name) => `${name}="${escapeLabelValue(normalized[name])}"`).join(",")}}`;
};

const labelKey = (labelNames = [], labels = {}) =>
  JSON.stringify(labelNames.map((name) => [name, String(labels?.[name] ?? "")]));

class CounterMetric {
  constructor({ name, help, labelNames = [] }) {
    this.type = "counter";
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.series = new Map();
  }

  inc(labels = {}, value = 1) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) return;
    const key = labelKey(this.labelNames, labels);
    const current = this.series.get(key);
    if (current) {
      current.value += numericValue;
      return;
    }
    this.series.set(key, {
      labels: normalizeLabels(this.labelNames, labels),
      value: numericValue,
    });
  }

  render() {
    const lines = [`# HELP ${this.name} ${escapeHelp(this.help)}`, `# TYPE ${this.name} counter`];
    for (const row of this.series.values()) {
      lines.push(`${this.name}${serializeLabels(this.labelNames, row.labels)} ${row.value}`);
    }
    return lines.join("\n");
  }
}

class GaugeMetric {
  constructor({ name, help, labelNames = [] }) {
    this.type = "gauge";
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.series = new Map();
  }

  set(labels = {}, value = 0) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    const key = labelKey(this.labelNames, labels);
    this.series.set(key, {
      labels: normalizeLabels(this.labelNames, labels),
      value: numericValue,
    });
  }

  inc(labels = {}, value = 1) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    const key = labelKey(this.labelNames, labels);
    const current = this.series.get(key);
    if (!current) {
      this.set(labels, numericValue);
      return;
    }
    current.value += numericValue;
  }

  dec(labels = {}, value = 1) {
    this.inc(labels, -1);
  }

  render() {
    const lines = [`# HELP ${this.name} ${escapeHelp(this.help)}`, `# TYPE ${this.name} gauge`];
    for (const row of this.series.values()) {
      lines.push(`${this.name}${serializeLabels(this.labelNames, row.labels)} ${row.value}`);
    }
    return lines.join("\n");
  }
}

class HistogramMetric {
  constructor({ name, help, labelNames = [], buckets = DEFAULT_HISTOGRAM_BUCKETS }) {
    this.type = "histogram";
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.buckets = [...buckets].sort((a, b) => a - b);
    this.series = new Map();
  }

  observe(labels = {}, value = 0) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) return;
    const key = labelKey(this.labelNames, labels);
    if (!this.series.has(key)) {
      this.series.set(key, {
        labels: normalizeLabels(this.labelNames, labels),
        bucketCounts: this.buckets.map(() => 0),
        sum: 0,
        count: 0,
      });
    }
    const row = this.series.get(key);
    row.count += 1;
    row.sum += numericValue;
    this.buckets.forEach((bucket, index) => {
      if (numericValue <= bucket) {
        row.bucketCounts[index] += 1;
      }
    });
  }

  render() {
    const lines = [`# HELP ${this.name} ${escapeHelp(this.help)}`, `# TYPE ${this.name} histogram`];
    for (const row of this.series.values()) {
      this.buckets.forEach((bucket, index) => {
        lines.push(
          `${this.name}_bucket${serializeLabels([...this.labelNames, "le"], { ...row.labels, le: bucket })} ${row.bucketCounts[index]}`
        );
      });
      lines.push(`${this.name}_bucket${serializeLabels([...this.labelNames, "le"], { ...row.labels, le: "+Inf" })} ${row.count}`);
      lines.push(`${this.name}_sum${serializeLabels(this.labelNames, row.labels)} ${row.sum}`);
      lines.push(`${this.name}_count${serializeLabels(this.labelNames, row.labels)} ${row.count}`);
    }
    return lines.join("\n");
  }
}

class MetricsRegistry {
  constructor() {
    this.metrics = [];
  }

  register(metric) {
    this.metrics.push(metric);
    return metric;
  }

  render() {
    return this.metrics.map((metric) => metric.render()).filter(Boolean).join("\n\n");
  }
}

const registry = new MetricsRegistry();

const httpRequestsTotal = registry.register(
  new CounterMetric({
    name: "nritax_http_requests_total",
    help: "Total HTTP requests handled by the API.",
    labelNames: ["method", "route", "status_code"],
  })
);

const httpRequestDurationMs = registry.register(
  new HistogramMetric({
    name: "nritax_http_request_duration_ms",
    help: "HTTP request duration in milliseconds.",
    labelNames: ["method", "route", "status_code"],
  })
);

const apiFailuresTotal = registry.register(
  new CounterMetric({
    name: "nritax_api_failures_total",
    help: "API failures by route and status code.",
    labelNames: ["method", "route", "status_code", "error_type"],
  })
);

const aiRequestsTotal = registry.register(
  new CounterMetric({
    name: "nritax_ai_requests_total",
    help: "AI gateway requests by provider and outcome.",
    labelNames: ["route_tier", "provider", "status"],
  })
);

const aiLatencyMs = registry.register(
  new HistogramMetric({
    name: "nritax_ai_latency_ms",
    help: "AI gateway latency in milliseconds.",
    labelNames: ["route_tier", "provider", "status"],
  })
);

const aiTokensTotal = registry.register(
  new CounterMetric({
    name: "nritax_ai_tokens_total",
    help: "Estimated AI token volume by route, provider, direction, and model family.",
    labelNames: ["route_tier", "provider", "direction", "model_family"],
  })
);

const aiEstimatedCostUsdTotal = registry.register(
  new CounterMetric({
    name: "nritax_ai_estimated_cost_usd_total",
    help: "Estimated AI inference spend in USD.",
    labelNames: ["route_tier", "provider", "model_family", "strategy"],
  })
);

const aiRouteStrategyTotal = registry.register(
  new CounterMetric({
    name: "nritax_ai_route_strategy_total",
    help: "AI route strategy decisions used by the gateway.",
    labelNames: ["route_tier", "strategy"],
  })
);

const aiWorkflowRequestsTotal = registry.register(
  new CounterMetric({
    name: "nritax_ai_workflow_requests_total",
    help: "AI workflow requests by workflow, route tier, strategy, and outcome.",
    labelNames: ["workflow", "route_tier", "strategy", "status"],
  })
);

const cacheRequestsTotal = registry.register(
  new CounterMetric({
    name: "nritax_cache_requests_total",
    help: "Cache requests by cache layer and result.",
    labelNames: ["layer", "result"],
  })
);

const cacheOperationDurationMs = registry.register(
  new HistogramMetric({
    name: "nritax_cache_operation_duration_ms",
    help: "Cache operation duration in milliseconds by layer, backend, and operation.",
    labelNames: ["layer", "backend", "operation"],
  })
);

const cacheBackendStateGauge = registry.register(
  new GaugeMetric({
    name: "nritax_cache_backend_state",
    help: "Cache backend availability state.",
    labelNames: ["backend", "role"],
  })
);

const queueJobsTotal = registry.register(
  new CounterMetric({
    name: "nritax_queue_jobs_total",
    help: "Queued or inline jobs by queue, job type, mode, and outcome.",
    labelNames: ["queue", "job", "mode", "status"],
  })
);

const queueJobDurationMs = registry.register(
  new HistogramMetric({
    name: "nritax_queue_job_duration_ms",
    help: "Queue job processing duration in milliseconds.",
    labelNames: ["queue", "job", "status"],
  })
);

const queueJobWaitMs = registry.register(
  new HistogramMetric({
    name: "nritax_queue_job_wait_ms",
    help: "Time spent waiting in queue before processing.",
    labelNames: ["queue", "job"],
  })
);

const queueDepthGauge = registry.register(
  new GaugeMetric({
    name: "nritax_queue_depth",
    help: "Current queue depth snapshot.",
    labelNames: ["queue", "state"],
  })
);

const workerConcurrencyConfiguredGauge = registry.register(
  new GaugeMetric({
    name: "nritax_worker_concurrency_configured",
    help: "Configured worker concurrency by queue and worker group.",
    labelNames: ["queue", "worker_group"],
  })
);

const workerJobsActiveGauge = registry.register(
  new GaugeMetric({
    name: "nritax_worker_jobs_active",
    help: "Currently active worker jobs by queue and worker group.",
    labelNames: ["queue", "worker_group"],
  })
);

const workerUtilizationRatioGauge = registry.register(
  new GaugeMetric({
    name: "nritax_worker_utilization_ratio",
    help: "Active worker jobs divided by configured concurrency.",
    labelNames: ["queue", "worker_group"],
  })
);

const documentProcessingRunsTotal = registry.register(
  new CounterMetric({
    name: "nritax_document_processing_runs_total",
    help: "Document processing runs by workflow, extraction mode, and outcome.",
    labelNames: ["workflow", "extraction_mode", "status"],
  })
);

const documentProcessingDurationMs = registry.register(
  new HistogramMetric({
    name: "nritax_document_processing_duration_ms",
    help: "Document processing duration in milliseconds.",
    labelNames: ["workflow", "extraction_mode", "status"],
  })
);

const documentProcessingPagesGauge = registry.register(
  new GaugeMetric({
    name: "nritax_document_processing_pages",
    help: "Last observed page count for a document workflow.",
    labelNames: ["workflow", "extraction_mode"],
  })
);

const documentProcessingBytesTotal = registry.register(
  new CounterMetric({
    name: "nritax_document_processing_bytes_total",
    help: "Total bytes processed by document workflow and extraction mode.",
    labelNames: ["workflow", "extraction_mode"],
  })
);

const dbOperationDurationMs = registry.register(
  new HistogramMetric({
    name: "nritax_db_operation_duration_ms",
    help: "Database operation duration in milliseconds.",
    labelNames: ["operation", "collection", "status"],
  })
);

const dbConnectionStateGauge = registry.register(
  new GaugeMetric({
    name: "nritax_db_connection_state",
    help: "MongoDB connection state as reported by mongoose.",
    labelNames: ["state"],
  })
);

const paymentAttemptsTotal = registry.register(
  new CounterMetric({
    name: "nritax_payment_attempts_total",
    help: "Payment attempts and lifecycle outcomes.",
    labelNames: ["provider", "status"],
  })
);

const securityEventsTotal = registry.register(
  new CounterMetric({
    name: "nritax_security_events_total",
    help: "Security and privacy events by category, severity, and outcome.",
    labelNames: ["category", "severity", "status"],
  })
);

const authEventsTotal = registry.register(
  new CounterMetric({
    name: "nritax_auth_events_total",
    help: "Authentication lifecycle events by action and outcome.",
    labelNames: ["action", "status", "provider"],
  })
);

const authSessionsGauge = registry.register(
  new GaugeMetric({
    name: "nritax_auth_sessions_active",
    help: "Active tracked authentication sessions by provider.",
    labelNames: ["provider"],
  })
);

const processResidentMemoryGauge = registry.register(
  new GaugeMetric({
    name: "process_resident_memory_bytes",
    help: "Resident memory size in bytes.",
  })
);

const processHeapUsedGauge = registry.register(
  new GaugeMetric({
    name: "process_heap_used_bytes",
    help: "Heap used in bytes.",
  })
);

const processUptimeGauge = registry.register(
  new GaugeMetric({
    name: "process_uptime_seconds",
    help: "Process uptime in seconds.",
  })
);

const appInfoGauge = registry.register(
  new GaugeMetric({
    name: "nritax_app_info",
    help: "Static build and environment metadata.",
    labelNames: ["service", "version", "env", "region", "runtime"],
  })
);

const updateProcessMetrics = () => {
  const usage = process.memoryUsage();
  processResidentMemoryGauge.set({}, usage.rss);
  processHeapUsedGauge.set({}, usage.heapUsed);
  processUptimeGauge.set({}, process.uptime());
  appInfoGauge.set(
    {
      service: process.env.APP_NAME || "nritax-server",
      version: process.env.APP_VERSION || "dev",
      env: process.env.NODE_ENV || "development",
      region: process.env.APP_REGION || process.env.RENDER_REGION || "unknown",
      runtime: process.env.APP_RUNTIME || "nodejs",
    },
    1
  );
};

export const metricsContentType = "text/plain; version=0.0.4; charset=utf-8";

export const isMetricsEnabled = () => featureFlags.prometheusMetricsEnabled;

export const getMetricsOutput = () => {
  updateProcessMetrics();
  return registry.render();
};

export const metricsHandler = (_req, res) => {
  if (!isMetricsEnabled()) {
    return res.status(404).json({
      success: false,
      message: "Metrics endpoint is disabled.",
    });
  }

  const expectedToken = String(process.env.METRICS_AUTH_TOKEN || "").trim();
  if (expectedToken) {
    const header = String(_req.headers.authorization || "").trim();
    const providedToken = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (providedToken !== expectedToken) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized metrics access.",
      });
    }
  }

  res.setHeader("Content-Type", metricsContentType);
  return res.status(200).send(getMetricsOutput());
};

export const recordHttpRequestMetric = ({ method = "GET", route = "unknown", statusCode = 200, durationMs = 0 }) => {
  const labels = {
    method: String(method || "GET").toUpperCase(),
    route: String(route || "unknown"),
    status_code: String(statusCode || 0),
  };
  httpRequestsTotal.inc(labels, 1);
  httpRequestDurationMs.observe(labels, durationMs);
};

export const recordApiFailureMetric = ({
  method = "GET",
  route = "unknown",
  statusCode = 500,
  errorType = "unknown",
}) => {
  apiFailuresTotal.inc(
    {
      method: String(method || "GET").toUpperCase(),
      route: String(route || "unknown"),
      status_code: String(statusCode || 0),
      error_type: String(errorType || "unknown"),
    },
    1
  );
};

export const recordAiMetric = ({
  routeTier = "medium",
  provider = "unknown",
  latencyMs = 0,
  failed = false,
  inputTokens = 0,
  outputTokens = 0,
  estimatedCostUsd = 0,
  modelFamily = "unknown",
  strategy = "unknown",
  workflow = "unknown",
}) => {
  const labels = {
    route_tier: String(routeTier || "medium"),
    provider: String(provider || "unknown"),
    status: failed ? "failure" : "success",
  };
  aiRequestsTotal.inc(labels, 1);
  aiLatencyMs.observe(labels, latencyMs);
  aiRouteStrategyTotal.inc(
    {
      route_tier: String(routeTier || "medium"),
      strategy: String(strategy || "unknown"),
    },
    1
  );
  aiWorkflowRequestsTotal.inc(
    {
      workflow: String(workflow || "unknown"),
      route_tier: String(routeTier || "medium"),
      strategy: String(strategy || "unknown"),
      status: failed ? "failure" : "success",
    },
    1
  );

  const family = String(modelFamily || "unknown");
  if (Number(inputTokens) > 0) {
    aiTokensTotal.inc(
      {
        route_tier: String(routeTier || "medium"),
        provider: String(provider || "unknown"),
        direction: "input",
        model_family: family,
      },
      Number(inputTokens)
    );
  }
  if (Number(outputTokens) > 0) {
    aiTokensTotal.inc(
      {
        route_tier: String(routeTier || "medium"),
        provider: String(provider || "unknown"),
        direction: "output",
        model_family: family,
      },
      Number(outputTokens)
    );
  }
  if (Number(estimatedCostUsd) > 0) {
    aiEstimatedCostUsdTotal.inc(
      {
        route_tier: String(routeTier || "medium"),
        provider: String(provider || "unknown"),
        model_family: family,
        strategy: String(strategy || "unknown"),
      },
      Number(estimatedCostUsd)
    );
  }
};

export const recordCacheMetric = ({ layer = "unknown", hit = false }) => {
  cacheRequestsTotal.inc(
    {
      layer: String(layer || "unknown"),
      result: hit ? "hit" : "miss",
    },
    1
  );
};

export const recordCacheOperationMetric = ({ layer = "unknown", backend = "local", operation = "get", durationMs = 0 }) => {
  cacheOperationDurationMs.observe(
    {
      layer: String(layer || "unknown"),
      backend: String(backend || "local"),
      operation: String(operation || "get"),
    },
    durationMs
  );
};

export const setCacheBackendStateMetric = ({ backend = "redis", role = "shared", connected = false }) => {
  cacheBackendStateGauge.set(
    {
      backend: String(backend || "redis"),
      role: String(role || "shared"),
    },
    connected ? 1 : 0
  );
};

export const recordQueueDispatchMetric = ({ queueName = "unknown", jobName = "unknown", queued = false }) => {
  queueJobsTotal.inc(
    {
      queue: String(queueName || "unknown"),
      job: String(jobName || "unknown"),
      mode: queued ? "queued" : "inline",
      status: queued ? "accepted" : "completed",
    },
    1
  );
};

export const recordQueueResultMetric = ({
  queueName = "unknown",
  jobName = "unknown",
  status = "completed",
  durationMs = 0,
  waitMs = null,
}) => {
  const statusLabel = String(status || "completed");
  queueJobsTotal.inc(
    {
      queue: String(queueName || "unknown"),
      job: String(jobName || "unknown"),
      mode: "queued",
      status: statusLabel,
    },
    1
  );
  queueJobDurationMs.observe(
    {
      queue: String(queueName || "unknown"),
      job: String(jobName || "unknown"),
      status: statusLabel,
    },
    durationMs
  );
  if (waitMs !== null && waitMs !== undefined) {
    queueJobWaitMs.observe(
      {
        queue: String(queueName || "unknown"),
        job: String(jobName || "unknown"),
      },
      waitMs
    );
  }
};

export const setQueueDepthMetric = ({ queueName = "unknown", state = "waiting", value = 0 }) => {
  queueDepthGauge.set(
    {
      queue: String(queueName || "unknown"),
      state: String(state || "waiting"),
    },
    value
  );
};

export const setWorkerConcurrencyMetric = ({ queueName = "unknown", workerGroup = "default", concurrency = 0 }) => {
  workerConcurrencyConfiguredGauge.set(
    {
      queue: String(queueName || "unknown"),
      worker_group: String(workerGroup || "default"),
    },
    Math.max(Number(concurrency) || 0, 0)
  );
};

export const setWorkerActiveJobsMetric = ({ queueName = "unknown", workerGroup = "default", activeJobs = 0, concurrency = 0 }) => {
  const safeConcurrency = Math.max(Number(concurrency) || 0, 0);
  const safeActiveJobs = Math.max(Number(activeJobs) || 0, 0);
  const labels = {
    queue: String(queueName || "unknown"),
    worker_group: String(workerGroup || "default"),
  };

  workerJobsActiveGauge.set(labels, safeActiveJobs);
  workerUtilizationRatioGauge.set(labels, safeConcurrency > 0 ? Number((safeActiveJobs / safeConcurrency).toFixed(4)) : 0);
};

export const recordDocumentProcessingMetric = ({
  workflow = "pdf-index",
  extractionMode = "native_text",
  status = "completed",
  durationMs = 0,
  fileSizeBytes = 0,
  pages = 0,
}) => {
  const workflowLabel = String(workflow || "pdf-index");
  const modeLabel = String(extractionMode || "native_text");
  const statusLabel = String(status || "completed");

  documentProcessingRunsTotal.inc(
    {
      workflow: workflowLabel,
      extraction_mode: modeLabel,
      status: statusLabel,
    },
    1
  );
  documentProcessingDurationMs.observe(
    {
      workflow: workflowLabel,
      extraction_mode: modeLabel,
      status: statusLabel,
    },
    Math.max(Number(durationMs) || 0, 0)
  );
  documentProcessingPagesGauge.set(
    {
      workflow: workflowLabel,
      extraction_mode: modeLabel,
    },
    Math.max(Number(pages) || 0, 0)
  );

  const bytes = Math.max(Number(fileSizeBytes) || 0, 0);
  if (bytes > 0) {
    documentProcessingBytesTotal.inc(
      {
        workflow: workflowLabel,
        extraction_mode: modeLabel,
      },
      bytes
    );
  }
};

export const recordDbOperationMetric = ({ operation = "unknown", collection = "unknown", durationMs = 0, failed = false }) => {
  dbOperationDurationMs.observe(
    {
      operation: String(operation || "unknown"),
      collection: String(collection || "unknown"),
      status: failed ? "failure" : "success",
    },
    durationMs
  );
};

export const setDbConnectionStateMetric = (stateValue = 0) => {
  const knownStates = {
    disconnected: 0,
    connected: 0,
    connecting: 0,
    disconnecting: 0,
  };

  if (stateValue === 1) knownStates.connected = 1;
  else if (stateValue === 2) knownStates.connecting = 1;
  else if (stateValue === 3) knownStates.disconnecting = 1;
  else knownStates.disconnected = 1;

  Object.entries(knownStates).forEach(([state, value]) => {
    dbConnectionStateGauge.set({ state }, value);
  });
};

export const recordPaymentMetric = ({ provider = "unknown", status = "unknown" }) => {
  paymentAttemptsTotal.inc(
    {
      provider: String(provider || "unknown"),
      status: String(status || "unknown"),
    },
    1
  );
};

export const recordSecurityEvent = ({ category = "security", severity = "low", status = "info" }) => {
  securityEventsTotal.inc(
    {
      category: String(category || "security"),
      severity: String(severity || "low"),
      status: String(status || "info"),
    },
    1
  );
};

export const recordAuthEvent = ({ action = "unknown", status = "info", provider = "unknown", value = 1 }) => {
  authEventsTotal.inc(
    {
      action: String(action || "unknown"),
      status: String(status || "info"),
      provider: String(provider || "unknown"),
    },
    Math.max(Number(value) || 0, 0)
  );
};

export const setAuthActiveSessionsMetric = ({ provider = "unknown", count = 0 }) => {
  authSessionsGauge.set(
    {
      provider: String(provider || "unknown"),
    },
    Math.max(Number(count) || 0, 0)
  );
};

export const startStandaloneMetricsServer = ({
  port = Number(process.env.WORKER_METRICS_PORT || process.env.PORT || 5000),
  readinessProvider = () => ({ ready: true, body: { success: true, status: "ready" } }),
} = {}) => {
  const server = http.createServer((req, res) => {
    const url = req.url || "/";

    if (url === "/metrics") {
      if (!isMetricsEnabled()) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Metrics endpoint is disabled." }));
        return;
      }

      const expectedToken = String(process.env.METRICS_AUTH_TOKEN || "").trim();
      if (expectedToken) {
        const header = String(req.headers.authorization || "").trim();
        const providedToken = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (providedToken !== expectedToken) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, message: "Unauthorized metrics access." }));
          return;
        }
      }

      res.writeHead(200, { "Content-Type": metricsContentType });
      res.end(getMetricsOutput());
      return;
    }

    if (url === "/health" || url === "/livez") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, status: "alive" }));
      return;
    }

    if (url === "/readyz" || url === "/ready") {
      const readiness = readinessProvider();
      res.writeHead(readiness.ready ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify(readiness.body));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, message: "Not found" }));
  });

  server.listen(port);
  return server;
};
