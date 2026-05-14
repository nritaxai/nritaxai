import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, "..", "..", "..", "logs");
const METRICS_PATH = path.join(LOGS_DIR, "ai_gateway_metrics.json");

const defaultMetrics = () => ({
  totalRequests: 0,
  totalFailures: 0,
  routeCounts: {
    small: 0,
    medium: 0,
    large: 0,
  },
  providerCounts: {
    openrouter: 0,
    gemini: 0,
    "gemini-direct": 0,
  },
  averageLatencyMs: 0,
  averageAttempts: 0,
  lastUpdatedAt: null,
});

let metricsQueue = Promise.resolve();

const ensureMetricsStore = async () => {
  await fs.mkdir(LOGS_DIR, { recursive: true });
  try {
    await fs.access(METRICS_PATH);
  } catch {
    await fs.writeFile(METRICS_PATH, JSON.stringify(defaultMetrics(), null, 2), "utf8");
  }
};

const readMetrics = async () => {
  try {
    await ensureMetricsStore();
    const raw = await fs.readFile(METRICS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : defaultMetrics();
  } catch {
    return defaultMetrics();
  }
};

const writeMetrics = async (metrics) => {
  await ensureMetricsStore();
  await fs.writeFile(METRICS_PATH, JSON.stringify(metrics, null, 2), "utf8");
};

const enqueueWrite = (task) => {
  metricsQueue = metricsQueue.then(task, task);
  return metricsQueue;
};

export const recordAiGatewayExecution = async ({
  routeTier = "medium",
  provider = "",
  latencyMs = 0,
  attempts = 1,
  failed = false,
} = {}) =>
  enqueueWrite(async () => {
    const metrics = await readMetrics();
    const nextTotal = Number(metrics.totalRequests || 0) + 1;
    const safeLatency = Number.isFinite(Number(latencyMs)) ? Number(latencyMs) : 0;
    const safeAttempts = Number.isFinite(Number(attempts)) ? Number(attempts) : 1;

    metrics.totalRequests = nextTotal;
    metrics.totalFailures = Number(metrics.totalFailures || 0) + (failed ? 1 : 0);
    metrics.routeCounts = metrics.routeCounts || defaultMetrics().routeCounts;
    metrics.providerCounts = metrics.providerCounts || defaultMetrics().providerCounts;
    metrics.routeCounts[routeTier] = Number(metrics.routeCounts[routeTier] || 0) + 1;
    if (provider) {
      metrics.providerCounts[provider] = Number(metrics.providerCounts[provider] || 0) + 1;
    }
    metrics.averageLatencyMs = Number(
      ((((Number(metrics.averageLatencyMs || 0) * (nextTotal - 1)) + safeLatency) / nextTotal).toFixed(2))
    );
    metrics.averageAttempts = Number(
      ((((Number(metrics.averageAttempts || 0) * (nextTotal - 1)) + safeAttempts) / nextTotal).toFixed(2))
    );
    metrics.lastUpdatedAt = new Date().toISOString();

    await writeMetrics(metrics);
  });
