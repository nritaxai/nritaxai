import { appConfig, assertRuntimeConfig } from "./Config/runtimeConfig.js";
import app from "./app.js";
import { initObservability, shutdownObservability } from "./services/observability.js";
import { logger } from "./services/logger.js";
import { startQueueMonitoring } from "./services/queueMonitoring.js";

assertRuntimeConfig();

const PORT = appConfig.app.port;

const start = async () => {
  await initObservability();
  const stopQueueMonitoring = startQueueMonitoring();
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, "server started");
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, "server shutdown requested");
    server.close(async () => {
      stopQueueMonitoring?.();
      await shutdownObservability();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

start().catch((error) => {
  logger.error({ error: error?.message || String(error) }, "server failed to start");
  process.exit(1);
});
