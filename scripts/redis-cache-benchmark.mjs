import process from "node:process";
import { performance } from "node:perf_hooks";

const baseUrl = String(process.env.BENCH_BASE_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");
const concurrency = Math.max(Number(process.env.BENCH_CONCURRENCY || 5), 1);
const iterations = Math.max(Number(process.env.BENCH_ITERATIONS || 20), 1);
const bearerToken = String(process.env.BENCH_BEARER_TOKEN || "").trim();

const scenarios = [
  {
    name: "banner-updates",
    path: "/api/banner-updates",
    method: "GET",
  },
  {
    name: "analytics-summary",
    path: "/api/analytics/summary",
    method: "GET",
  },
];

const buildHeaders = () => {
  const headers = {
    Accept: "application/json",
  };

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  return headers;
};

const percentile = (values = [], ratio = 0.95) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Number(sorted[index].toFixed(2));
};

const average = (values = []) =>
  values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;

const runRequest = async ({ method = "GET", path = "/" }) => {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: buildHeaders(),
  });

  await response.text();
  return {
    ok: response.ok,
    status: response.status,
    latencyMs: Number((performance.now() - startedAt).toFixed(2)),
  };
};

const runScenario = async (scenario) => {
  const results = [];
  const totalRequests = concurrency * iterations;

  for (let batch = 0; batch < iterations; batch += 1) {
    const batchResults = await Promise.all(
      Array.from({ length: concurrency }, () => runRequest(scenario))
    );
    results.push(...batchResults);
  }

  const latencies = results.map((result) => result.latencyMs);
  const okCount = results.filter((result) => result.ok).length;

  return {
    scenario: scenario.name,
    totalRequests,
    okCount,
    errorCount: totalRequests - okCount,
    averageLatencyMs: average(latencies),
    p95LatencyMs: percentile(latencies, 0.95),
    p99LatencyMs: percentile(latencies, 0.99),
  };
};

const main = async () => {
  console.log(
    JSON.stringify(
      {
        baseUrl,
        concurrency,
        iterations,
        scenarios: scenarios.map((scenario) => scenario.name),
      },
      null,
      2
    )
  );

  for (const scenario of scenarios) {
    const cold = await runRequest(scenario);
    const warmSummary = await runScenario(scenario);
    console.log(
      JSON.stringify(
        {
          scenario: scenario.name,
          coldRequest: cold,
          warmSummary,
        },
        null,
        2
      )
    );
  }
};

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        message: error?.message || String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
