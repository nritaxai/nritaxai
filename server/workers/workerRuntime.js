import { JOB_NAMES, QUEUE_NAMES } from "../queues/jobNames.js";
import { getAllQueueNames, getQueue } from "../queues/queueRegistry.js";
import { getRedisConnection } from "../queues/redis.js";
import {
  markAsyncJobActive,
  markAsyncJobCompleted,
  markAsyncJobDeadLettered,
  markAsyncJobFailed,
} from "../services/asyncJobAudit.js";
import { logger } from "../services/logger.js";
import { processAiEmbeddingJob, processAiGenerationJob } from "./processors/ai.processor.js";
import { processConsultationNotifications } from "./processors/consultation.processor.js";
import { processPdfIndexFile, processPdfReindexAll } from "./processors/pdf.processor.js";
import { processReportGenerationJob } from "./processors/report.processor.js";

const PROCESSOR_BY_JOB = {
  [JOB_NAMES.pdfIndexFile]: processPdfIndexFile,
  [JOB_NAMES.pdfReindexAll]: processPdfReindexAll,
  [JOB_NAMES.consultationNotifications]: processConsultationNotifications,
  [JOB_NAMES.aiEmbedding]: processAiEmbeddingJob,
  [JOB_NAMES.aiGeneration]: processAiGenerationJob,
  [JOB_NAMES.reportGeneration]: processReportGenerationJob,
};

const QUEUE_TO_JOB_NAMES = {
  [QUEUE_NAMES.pdf]: [JOB_NAMES.pdfIndexFile, JOB_NAMES.pdfReindexAll],
  [QUEUE_NAMES.ai]: [JOB_NAMES.aiEmbedding, JOB_NAMES.aiGeneration],
  [QUEUE_NAMES.reports]: [JOB_NAMES.reportGeneration],
  [QUEUE_NAMES.notifications]: [JOB_NAMES.consultationNotifications],
};

export const startWorkerRuntime = async () => {
  const connection = await getRedisConnection();
  if (!connection) {
    logger.warn({ enabled: false }, "worker runtime skipped because Redis is unavailable");
    return [];
  }

  const { Worker } = await import("bullmq");
  const workers = [];

  for (const queueName of getAllQueueNames()) {
    if (queueName === QUEUE_NAMES.deadLetter) continue;
    const acceptedJobs = new Set(QUEUE_TO_JOB_NAMES[queueName] || []);

    const worker = new Worker(
      queueName,
      async (job) => {
        if (!acceptedJobs.has(job.name)) {
          return { skipped: true, reason: "unsupported_job_name" };
        }

        const processor = PROCESSOR_BY_JOB[job.name];
        if (!processor) {
          return { skipped: true, reason: "missing_processor" };
        }

        await markAsyncJobActive(String(job.id), job.attemptsMade);
        try {
          const result = await processor(job.data || {});
          await markAsyncJobCompleted(String(job.id), result, job.attemptsMade);
          return result;
        } catch (error) {
          await markAsyncJobFailed(String(job.id), error?.message || String(error), job.attemptsMade);
          throw error;
        }
      },
      {
        connection,
        concurrency: Number(process.env.WORKER_CONCURRENCY || 4),
      }
    );

    worker.on("failed", async (job, error) => {
      if (!job) return;
      const shouldDeadLetter = job.attemptsMade >= job.opts.attempts;
      if (shouldDeadLetter) {
        const deadLetterQueue = await getQueue(QUEUE_NAMES.deadLetter);
        if (deadLetterQueue) {
          await deadLetterQueue.add(job.name, {
            originalQueue: queueName,
            originalJobId: String(job.id),
            payload: job.data,
            error: error?.message || String(error),
          });
        }
        await markAsyncJobDeadLettered(String(job.id), error?.message || String(error), job.attemptsMade);
      }
      logger.error({ queueName, jobId: job.id, error: error?.message || String(error) }, "worker job failed");
    });

    worker.on("completed", (job) => {
      logger.info({ queueName, jobId: job.id }, "worker job completed");
    });

    workers.push(worker);
  }

  logger.info({ queues: workers.length }, "worker runtime started");
  return workers;
};
