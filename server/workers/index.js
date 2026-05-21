import dotenv from "dotenv";
import connectDB from "../Config/db.js";
import { initObservability, shutdownObservability } from "../services/observability.js";
import { initErrorMonitoring } from "../services/monitoring.js";
import { logger } from "../services/logger.js";
import { startWorkerRuntime } from "./workerRuntime.js";

dotenv.config();

const run = async () => {
  await initObservability();
  await initErrorMonitoring();
  await connectDB();
  const workers = await startWorkerRuntime();

  const shutdown = async (signal) => {
    logger.info({ signal }, "worker shutdown requested");
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
