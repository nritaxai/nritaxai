import { QUEUE_NAMES } from "./jobNames.js";
import { getRedisConnection } from "./redis.js";

const queues = new Map();

const createQueue = async (queueName) => {
  const connection = await getRedisConnection();
  if (!connection) return null;

  const { Queue } = await import("bullmq");
  return new Queue(queueName, {
    connection,
    defaultJobOptions: {
      attempts: Number(process.env.QUEUE_DEFAULT_ATTEMPTS || 3),
      backoff: {
        type: "exponential",
        delay: Number(process.env.QUEUE_DEFAULT_BACKOFF_MS || 1000),
      },
      removeOnComplete: {
        age: Number(process.env.QUEUE_COMPLETE_RETENTION_SECONDS || 86400),
        count: Number(process.env.QUEUE_COMPLETE_RETENTION_COUNT || 5000),
      },
      removeOnFail: {
        age: Number(process.env.QUEUE_FAIL_RETENTION_SECONDS || 604800),
        count: Number(process.env.QUEUE_FAIL_RETENTION_COUNT || 10000),
      },
    },
  });
};

export const getQueue = async (queueName) => {
  if (queues.has(queueName)) return queues.get(queueName);
  const queue = await createQueue(queueName);
  queues.set(queueName, queue);
  return queue;
};

export const getAllQueueNames = () => Object.values(QUEUE_NAMES);
