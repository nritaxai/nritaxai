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

const cacheRequestsTotal = registry.register(
  new CounterMetric({
    name: "nritax_cache_requests_total",
    help: "Cache requests by cache layer and result.",
    labelNames: ["layer", "result"],
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

export const recordAiMetric = ({ routeTier = "medium", provider = "unknown", latencyMs = 0, failed = false }) => {
  const labels = {
    route_tier: String(routeTier || "medium"),
    provider: String(provider || "unknown"),
    status: failed ? "failure" : "success",
  };
  aiRequestsTotal.inc(labels, 1);
  aiLatencyMs.observe(labels, latencyMs);
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
