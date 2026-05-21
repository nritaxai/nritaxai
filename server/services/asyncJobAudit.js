import AsyncJob from "../Models/asyncJobModel.js";
import { redactObject } from "./dataProtection.js";

export const createAsyncJobAudit = async ({
  queueName,
  jobName,
  jobId = "",
  dedupeKey = "",
  resourceType = "",
  resourceId = "",
  payloadSummary = {},
}) =>
  AsyncJob.findOneAndUpdate(
    { jobId },
    {
      $set: {
        queueName,
        jobName,
        jobId,
        dedupeKey,
        resourceType: String(resourceType || ""),
        resourceId: String(resourceId || ""),
        payloadSummary: redactObject(payloadSummary),
        status: "queued",
        progressPct: 0,
        statusMessage: "Queued",
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

export const updateAsyncJobAudit = async (jobId, patch = {}) => {
  if (!jobId) return null;
  return AsyncJob.findOneAndUpdate({ jobId }, { $set: patch }, { new: true });
};

export const markAsyncJobActive = async (jobId, attemptsMade = 0) =>
  updateAsyncJobAudit(jobId, {
    status: "active",
    attemptsMade,
    progressPct: 25,
    statusMessage: "Processing",
    startedAt: new Date(),
  });

export const markAsyncJobCompleted = async (jobId, resultSummary = {}, attemptsMade = 0) =>
  updateAsyncJobAudit(jobId, {
    status: "completed",
    resultSummary: redactObject(resultSummary),
    attemptsMade,
    progressPct: 100,
    statusMessage: "Completed",
    completedAt: new Date(),
    lastError: "",
  });

export const markAsyncJobFailed = async (jobId, lastError = "", attemptsMade = 0) =>
  updateAsyncJobAudit(jobId, {
    status: "failed",
    lastError: String(lastError || "").slice(0, 2000),
    attemptsMade,
    progressPct: 100,
    statusMessage: "Failed",
  });

export const markAsyncJobDeadLettered = async (jobId, lastError = "", attemptsMade = 0) =>
  updateAsyncJobAudit(jobId, {
    status: "dead_lettered",
    lastError: String(lastError || "").slice(0, 2000),
    attemptsMade,
    progressPct: 100,
    statusMessage: "Dead lettered",
    deadLetteredAt: new Date(),
  });

export const getAsyncJobAuditByJobId = async (jobId) =>
  AsyncJob.findOne({ jobId: String(jobId || "").trim() }).lean();

export const listAsyncJobsByResource = async ({ resourceType = "", resourceId = "", limit = 20 }) =>
  AsyncJob.find({
    resourceType: String(resourceType || "").trim(),
    resourceId: String(resourceId || "").trim(),
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(Number(limit) || 20, 1))
    .lean();
