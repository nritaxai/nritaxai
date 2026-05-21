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
import { recordQueueResultMetric, setWorkerActiveJobsMetric, setWorkerConcurrencyMetric } from "../services/metrics.js";
import { processAiEmbeddingJob, processAiGenerationJob, processAiWorkflowJob } from "./processors/ai.processor.js";
import { processConsultationNotifications } from "./processors/consultation.processor.js";
import { processPaymentReconciliation } from "./processors/payment.processor.js";
import { processPdfIndexFile, processPdfReindexAll } from "./processors/pdf.processor.js";
import { processReportGenerationJob } from "./processors/report.processor.js";
import { getSelectedQueues, getWorkerConcurrencyForQueue, getWorkerGroup } from "./runtimeConfig.js";

const PROCESSOR_BY_JOB = {
  [JOB_NAMES.pdfIndexFile]: processPdfIndexFile,
  [JOB_NAMES.pdfReindexAll]: processPdfReindexAll,
  [JOB_NAMES.consultationNotifications]: processConsultationNotifications,
  [JOB_NAMES.aiEmbedding]: processAiEmbeddingJob,
  [JOB_NAMES.aiGeneration]: processAiGenerationJob,
  [JOB_NAMES.aiWorkflow]: processAiWorkflowJob,
  [JOB_NAMES.reportGeneration]: processReportGenerationJob,
  [JOB_NAMES.paymentReconcile]: processPaymentReconciliation,
};

const QUEUE_TO_JOB_NAMES = {
  [QUEUE_NAMES.pdf]: [JOB_NAMES.pdfIndexFile, JOB_NAMES.pdfReindexAll],
  [QUEUE_NAMES.ai]: [JOB_NAMES.aiEmbedding, JOB_NAMES.aiGeneration, JOB_NAMES.aiWorkflow],
  [QUEUE_NAMES.reports]: [JOB_NAMES.reportGeneration],
  [QUEUE_NAMES.notifications]: [JOB_NAMES.consultationNotifications],
  [QUEUE_NAMES.payments]: [JOB_NAMES.paymentReconcile],
};

export const startWorkerRuntime = async () => {
  const connection = await getRedisConnection();
  if (!connection) {
    logger.warn({ enabled: false }, "worker runtime skipped because Redis is unavailable");
    return [];
  }

  const { Worker } = await import("bullmq");
  const workers = [];
  const workerGroup = getWorkerGroup();
  const selectedQueues = new Set(getSelectedQueues());
  const activeJobsByQueue = new Map();

  for (const queueName of getAllQueueNames()) {
    if (queueName === QUEUE_NAMES.deadLetter || !selectedQueues.has(queueName)) continue;
    const acceptedJobs = new Set(QUEUE_TO_JOB_NAMES[queueName] || []);
    const concurrency = getWorkerConcurrencyForQueue(queueName);
    activeJobsByQueue.set(queueName, 0);
    setWorkerConcurrencyMetric({ queueName, workerGroup, concurrency });
    setWorkerActiveJobsMetric({ queueName, workerGroup, activeJobs: 0, concurrency });

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
          recordQueueResultMetric({
            queueName,
            jobName: job.name,
            status: "completed",
            durationMs: Number(job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : 0),
            waitMs: Number(job.processedOn && job.timestamp ? job.processedOn - job.timestamp : 0),
          });
          return result;
        } catch (error) {
          await markAsyncJobFailed(String(job.id), error?.message || String(error), job.attemptsMade);
          recordQueueResultMetric({
            queueName,
            jobName: job.name,
            status: "failed",
            durationMs: Number(job.processedOn ? Date.now() - job.processedOn : 0),
            waitMs: Number(job.processedOn && job.timestamp ? job.processedOn - job.timestamp : 0),
          });
          throw error;
        }
      },
      {
        connection,
        concurrency,
      }
    );

    worker.on("active", () => {
      const nextActiveJobs = Math.max((activeJobsByQueue.get(queueName) || 0) + 1, 0);
      activeJobsByQueue.set(queueName, nextActiveJobs);
      setWorkerActiveJobsMetric({ queueName, workerGroup, activeJobs: nextActiveJobs, concurrency });
    });

    worker.on("failed", async (job, error) => {
      const nextActiveJobs = Math.max((activeJobsByQueue.get(queueName) || 0) - 1, 0);
      activeJobsByQueue.set(queueName, nextActiveJobs);
      setWorkerActiveJobsMetric({ queueName, workerGroup, activeJobs: nextActiveJobs, concurrency });
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
      const nextActiveJobs = Math.max((activeJobsByQueue.get(queueName) || 0) - 1, 0);
      activeJobsByQueue.set(queueName, nextActiveJobs);
      setWorkerActiveJobsMetric({ queueName, workerGroup, activeJobs: nextActiveJobs, concurrency });
      logger.info({ queueName, jobId: job.id }, "worker job completed");
    });

    workers.push(worker);
  }

  logger.info({ queues: workers.length, workerGroup, selectedQueues: [...selectedQueues] }, "worker runtime started");
  return workers;
};
