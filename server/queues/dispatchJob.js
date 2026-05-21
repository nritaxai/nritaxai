import { featureFlags } from "../Config/featureFlags.js";
import {
  createAsyncJobAudit,
  markAsyncJobCompleted,
  markAsyncJobFailed,
} from "../services/asyncJobAudit.js";
import { logger } from "../services/logger.js";
import { getQueue } from "./queueRegistry.js";

const buildInlineJobId = (queueName, jobName) =>
  `${queueName}:${jobName}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

export const dispatchJob = async ({
  queueName,
  jobName,
  payload,
  payloadSummary = {},
  dedupeKey = "",
  featureFlagEnabled = featureFlags.backgroundJobsEnabled,
  inlineHandler,
}) => {
  if (!featureFlagEnabled) {
    const result = inlineHandler ? await inlineHandler(payload) : null;
    return {
      queued: false,
      inline: true,
      result,
      jobId: null,
    };
  }

  const queue = await getQueue(queueName);
  if (!queue) {
    const result = inlineHandler ? await inlineHandler(payload) : null;
    return {
      queued: false,
      inline: true,
      result,
      jobId: null,
    };
  }

  const job = await queue.add(jobName, payload, {
    jobId: dedupeKey || undefined,
  });

  await createAsyncJobAudit({
    queueName,
    jobName,
    jobId: String(job.id),
    dedupeKey,
    payloadSummary,
  });

  logger.info({ queueName, jobName, jobId: job.id }, "job queued");

  return {
    queued: true,
    inline: false,
    result: null,
    jobId: String(job.id),
  };
};

export const runInlineAuditedJob = async ({
  queueName,
  jobName,
  payload,
  payloadSummary = {},
  handler,
}) => {
  const jobId = buildInlineJobId(queueName, jobName);
  await createAsyncJobAudit({
    queueName,
    jobName,
    jobId,
    dedupeKey: "",
    payloadSummary,
  });

  try {
    const result = await handler(payload);
    await markAsyncJobCompleted(jobId, result, 1);
    return { jobId, result };
  } catch (error) {
    await markAsyncJobFailed(jobId, error?.message || String(error), 1);
    throw error;
  }
};
