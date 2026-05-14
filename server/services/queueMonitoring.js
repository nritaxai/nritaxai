import { featureFlags } from "../Config/featureFlags.js";
import { setQueueDepthMetric } from "./metrics.js";
import { logger } from "./logger.js";
import { getAllQueueNames, getQueue } from "../queues/queueRegistry.js";
import { getRedisConnection } from "../queues/redis.js";

let pollingTimer = null;

const QUEUE_STATES = ["waiting", "active", "completed", "failed", "delayed", "paused", "prioritized"];

const snapshotQueues = async () => {
  const connection = await getRedisConnection();
  if (!featureFlags.backgroundJobsEnabled || !connection) {
    return;
  }

  await Promise.all(
    getAllQueueNames().map(async (queueName) => {
      const queue = await getQueue(queueName);
      if (!queue) return;
      try {
        const counts = await queue.getJobCounts(...QUEUE_STATES);
        QUEUE_STATES.forEach((state) => {
          setQueueDepthMetric({
            queueName,
            state,
            value: Number(counts?.[state] || 0),
          });
        });
      } catch (error) {
        logger.warn({ queueName, error: error?.message || String(error) }, "queue depth snapshot failed");
      }
    })
  );
};

export const startQueueMonitoring = () => {
  if (pollingTimer) return () => {};

  const intervalMs = Math.max(Number(process.env.QUEUE_METRICS_POLL_INTERVAL_MS || 15000), 5000);
  void snapshotQueues();
  pollingTimer = setInterval(() => {
    void snapshotQueues();
  }, intervalMs);
  pollingTimer.unref?.();

  return () => {
    if (!pollingTimer) return;
    clearInterval(pollingTimer);
    pollingTimer = null;
  };
};
