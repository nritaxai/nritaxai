import AsyncJob from "../Models/asyncJobModel.js";

export const createAsyncJobAudit = async ({
  queueName,
  jobName,
  jobId = "",
  dedupeKey = "",
  payloadSummary = {},
}) =>
  AsyncJob.create({
    queueName,
    jobName,
    jobId,
    dedupeKey,
    payloadSummary,
    status: "queued",
  });

export const updateAsyncJobAudit = async (jobId, patch = {}) => {
  if (!jobId) return null;
  return AsyncJob.findOneAndUpdate({ jobId }, { $set: patch }, { new: true });
};

export const markAsyncJobActive = async (jobId, attemptsMade = 0) =>
  updateAsyncJobAudit(jobId, {
    status: "active",
    attemptsMade,
    startedAt: new Date(),
  });

export const markAsyncJobCompleted = async (jobId, resultSummary = {}, attemptsMade = 0) =>
  updateAsyncJobAudit(jobId, {
    status: "completed",
    resultSummary,
    attemptsMade,
    completedAt: new Date(),
    lastError: "",
  });

export const markAsyncJobFailed = async (jobId, lastError = "", attemptsMade = 0) =>
  updateAsyncJobAudit(jobId, {
    status: "failed",
    lastError: String(lastError || "").slice(0, 2000),
    attemptsMade,
  });

export const markAsyncJobDeadLettered = async (jobId, lastError = "", attemptsMade = 0) =>
  updateAsyncJobAudit(jobId, {
    status: "dead_lettered",
    lastError: String(lastError || "").slice(0, 2000),
    attemptsMade,
    deadLetteredAt: new Date(),
  });
