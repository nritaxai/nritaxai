import dotenv from "dotenv";
import connectDB, { getDbReadiness } from "../Config/db.js";
import { initObservability, shutdownObservability } from "../services/observability.js";
import { initErrorMonitoring } from "../services/monitoring.js";
import { logger } from "../services/logger.js";
import { startStandaloneMetricsServer } from "../services/metrics.js";
import { startQueueMonitoring } from "../services/queueMonitoring.js";
import { startWorkerRuntime } from "./workerRuntime.js";

dotenv.config();

const run = async () => {
  await initObservability();
  await initErrorMonitoring();
  await connectDB();
  const stopQueueMonitoring = startQueueMonitoring();
  const metricsServer = startStandaloneMetricsServer({
    port: Number(process.env.WORKER_METRICS_PORT || 5000),
    readinessProvider: () => {
      const db = getDbReadiness();
      return {
        ready: db.ready,
        body: {
          success: db.ready,
          status: db.ready ? "ready" : "not_ready",
          dependencies: {
            database: db,
          },
        },
      };
    },
  });
  const workers = await startWorkerRuntime();

  const shutdown = async (signal) => {
    logger.info({ signal }, "worker shutdown requested");
    stopQueueMonitoring?.();
    metricsServer.close();
    await Promise.all(workers.map((worker) => worker.close().catch(() => null)));
    await shutdownObservability();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

run().catch((error) => {
  logger.error({ error: error?.message || String(error) }, "worker runtime failed to start");
  process.exit(1);
});
