import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { recordAiMetric } from "../metrics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, "..", "..", "..", "logs");
const METRICS_PATH = path.join(LOGS_DIR, "ai_gateway_metrics.json");
const REQUEST_LOG_PATH = path.join(LOGS_DIR, "ai_gateway_requests.json");

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
    ollama: 0,
  },
  cacheHits: 0,
  strategyCounts: {
    lightweight: 0,
    "rag-small": 0,
    advanced: 0,
  },
  modelFamilyCounts: {},
  workflowCounts: {},
  tokenTotals: {
    input: 0,
    output: 0,
    total: 0,
  },
  estimatedCostUsdTotal: 0,
  averageTokensPerRequest: 0,
  averageEstimatedCostUsd: 0,
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
  try {
    await fs.access(REQUEST_LOG_PATH);
  } catch {
    await fs.writeFile(REQUEST_LOG_PATH, JSON.stringify([], null, 2), "utf8");
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

const readRequestLog = async () => {
  try {
    await ensureMetricsStore();
    const raw = await fs.readFile(REQUEST_LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRequestLog = async (rows) => {
  await ensureMetricsStore();
  await fs.writeFile(REQUEST_LOG_PATH, JSON.stringify(rows, null, 2), "utf8");
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
  cacheHit = false,
  inputTokens = 0,
  outputTokens = 0,
  estimatedCostUsd = 0,
  modelFamily = "unknown",
  strategy = "unknown",
  workflow = "unknown",
} = {}) =>
  enqueueWrite(async () => {
    recordAiMetric({
      routeTier,
      provider,
      latencyMs,
      failed,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      modelFamily,
      strategy,
      workflow,
    });

    const [metrics, requestLog] = await Promise.all([readMetrics(), readRequestLog()]);
    const nextTotal = Number(metrics.totalRequests || 0) + 1;
    const safeLatency = Number.isFinite(Number(latencyMs)) ? Number(latencyMs) : 0;
    const safeAttempts = Number.isFinite(Number(attempts)) ? Number(attempts) : 1;
    const safeInputTokens = Number.isFinite(Number(inputTokens)) ? Number(inputTokens) : 0;
    const safeOutputTokens = Number.isFinite(Number(outputTokens)) ? Number(outputTokens) : 0;
    const safeTotalTokens = safeInputTokens + safeOutputTokens;
    const safeEstimatedCostUsd = Number.isFinite(Number(estimatedCostUsd)) ? Number(estimatedCostUsd) : 0;

    metrics.totalRequests = nextTotal;
    metrics.totalFailures = Number(metrics.totalFailures || 0) + (failed ? 1 : 0);
    metrics.routeCounts = metrics.routeCounts || defaultMetrics().routeCounts;
    metrics.providerCounts = metrics.providerCounts || defaultMetrics().providerCounts;
    metrics.strategyCounts = metrics.strategyCounts || defaultMetrics().strategyCounts;
    metrics.modelFamilyCounts = metrics.modelFamilyCounts || {};
    metrics.workflowCounts = metrics.workflowCounts || {};
    metrics.tokenTotals = metrics.tokenTotals || defaultMetrics().tokenTotals;
    metrics.routeCounts[routeTier] = Number(metrics.routeCounts[routeTier] || 0) + 1;
    metrics.cacheHits = Number(metrics.cacheHits || 0) + (cacheHit ? 1 : 0);
    if (provider) {
      metrics.providerCounts[provider] = Number(metrics.providerCounts[provider] || 0) + 1;
    }
    if (strategy) {
      metrics.strategyCounts[strategy] = Number(metrics.strategyCounts[strategy] || 0) + 1;
    }
    if (modelFamily) {
      metrics.modelFamilyCounts[modelFamily] = Number(metrics.modelFamilyCounts[modelFamily] || 0) + 1;
    }
    if (workflow) {
      metrics.workflowCounts[workflow] = Number(metrics.workflowCounts[workflow] || 0) + 1;
    }
    metrics.tokenTotals.input = Number(metrics.tokenTotals.input || 0) + safeInputTokens;
    metrics.tokenTotals.output = Number(metrics.tokenTotals.output || 0) + safeOutputTokens;
    metrics.tokenTotals.total = Number(metrics.tokenTotals.total || 0) + safeTotalTokens;
    metrics.estimatedCostUsdTotal = Number((Number(metrics.estimatedCostUsdTotal || 0) + safeEstimatedCostUsd).toFixed(6));
    metrics.averageTokensPerRequest = Number(
      ((((Number(metrics.averageTokensPerRequest || 0) * (nextTotal - 1)) + safeTotalTokens) / nextTotal).toFixed(2))
    );
    metrics.averageEstimatedCostUsd = Number(
      ((((Number(metrics.averageEstimatedCostUsd || 0) * (nextTotal - 1)) + safeEstimatedCostUsd) / nextTotal).toFixed(6))
    );
    metrics.averageLatencyMs = Number(
      ((((Number(metrics.averageLatencyMs || 0) * (nextTotal - 1)) + safeLatency) / nextTotal).toFixed(2))
    );
    metrics.averageAttempts = Number(
      ((((Number(metrics.averageAttempts || 0) * (nextTotal - 1)) + safeAttempts) / nextTotal).toFixed(2))
    );
    metrics.lastUpdatedAt = new Date().toISOString();

    requestLog.push({
      timestamp: new Date().toISOString(),
      routeTier,
      provider,
      latencyMs: safeLatency,
      attempts: safeAttempts,
      failed: Boolean(failed),
      cacheHit: Boolean(cacheHit),
      inputTokens: safeInputTokens,
      outputTokens: safeOutputTokens,
      totalTokens: safeTotalTokens,
      estimatedCostUsd: safeEstimatedCostUsd,
      modelFamily: String(modelFamily || "unknown"),
      strategy: String(strategy || "unknown"),
      workflow: String(workflow || "unknown"),
    });

    await Promise.all([
      writeMetrics(metrics),
      writeRequestLog(requestLog.slice(-2500)),
    ]);
  });

export const readAiGatewayMetrics = readMetrics;
export const readAiGatewayRequestLog = readRequestLog;
export { METRICS_PATH as AI_GATEWAY_METRICS_PATH, REQUEST_LOG_PATH as AI_GATEWAY_REQUEST_LOG_PATH };
