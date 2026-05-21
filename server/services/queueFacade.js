import { featureFlags } from "../Config/featureFlags.js";
import { dispatchJob } from "../queues/dispatchJob.js";
import { JOB_NAMES, QUEUE_NAMES } from "../queues/jobNames.js";
import { indexStoredPdfByName, rebuildPdfIndex } from "./pdfIndexService.js";
import { sendConsultationNotificationsInline } from "./consultationNotificationService.js";

export const enqueuePdfIndexJob = async ({ fileName }) =>
  dispatchJob({
    queueName: QUEUE_NAMES.pdf,
    jobName: JOB_NAMES.pdfIndexFile,
    payload: { fileName },
    payloadSummary: { fileName },
    dedupeKey: `pdf-index:${fileName}`,
    featureFlagEnabled: featureFlags.backgroundJobsEnabled && featureFlags.pdfQueueEnabled,
    inlineHandler: ({ fileName: targetFileName }) => indexStoredPdfByName(targetFileName),
  });

export const enqueuePdfReindexJob = async () =>
  dispatchJob({
    queueName: QUEUE_NAMES.pdf,
    jobName: JOB_NAMES.pdfReindexAll,
    payload: {},
    payloadSummary: { type: "reindex-all" },
    dedupeKey: `pdf-reindex:${new Date().toISOString().slice(0, 13)}`,
    featureFlagEnabled: featureFlags.backgroundJobsEnabled && featureFlags.pdfQueueEnabled,
    inlineHandler: () => rebuildPdfIndex(),
  });

export const enqueueConsultationNotificationJob = async (payload) =>
  dispatchJob({
    queueName: QUEUE_NAMES.notifications,
    jobName: JOB_NAMES.consultationNotifications,
    payload,
    payloadSummary: {
      requestId: payload?.requestId || "",
      email: payload?.customerEmail || "",
    },
    dedupeKey: `consultation-notify:${payload?.requestId || ""}`,
    featureFlagEnabled: featureFlags.backgroundJobsEnabled && featureFlags.consultationQueueEnabled,
    inlineHandler: sendConsultationNotificationsInline,
  });
