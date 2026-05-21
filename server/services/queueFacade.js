import { featureFlags } from "../Config/featureFlags.js";
import { dispatchJob } from "../queues/dispatchJob.js";
import { JOB_NAMES, QUEUE_NAMES } from "../queues/jobNames.js";
import { processPdfIndexFile, processPdfReindexAll } from "../workers/processors/pdf.processor.js";
import { processPaymentReconciliation } from "../workers/processors/payment.processor.js";
import { sendConsultationNotificationsInline } from "./consultationNotificationService.js";

export const enqueuePdfIndexJob = async ({ fileName, uploadId = "", requestedBy = "" }) =>
  dispatchJob({
    queueName: QUEUE_NAMES.pdf,
    jobName: JOB_NAMES.pdfIndexFile,
    payload: { fileName, uploadId, requestedBy },
    payloadSummary: { fileName, uploadId, requestedBy },
    resourceType: uploadId ? "pdf_upload" : "pdf_file",
    resourceId: uploadId || fileName,
    dedupeKey: uploadId ? `pdf-upload:${uploadId}` : `pdf-index:${fileName}`,
    featureFlagEnabled: featureFlags.backgroundJobsEnabled && featureFlags.pdfQueueEnabled,
    inlineHandler: ({ fileName: targetFileName, uploadId: stagedUploadId, requestedBy: requestedByUser }) =>
      processPdfIndexFile({ fileName: targetFileName, uploadId: stagedUploadId, requestedBy: requestedByUser }),
  });

export const enqueuePdfReindexJob = async () =>
  dispatchJob({
    queueName: QUEUE_NAMES.pdf,
    jobName: JOB_NAMES.pdfReindexAll,
    payload: {},
    payloadSummary: { type: "reindex-all" },
    dedupeKey: `pdf-reindex:${new Date().toISOString().slice(0, 13)}`,
    featureFlagEnabled: featureFlags.backgroundJobsEnabled && featureFlags.pdfQueueEnabled,
    inlineHandler: () => processPdfReindexAll(),
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

export const enqueueAiWorkflowJob = async (payload) =>
  dispatchJob({
    queueName: QUEUE_NAMES.ai,
    jobName: JOB_NAMES.aiWorkflow,
    payload,
    payloadSummary: {
      workflowHint: payload?.workflowHint || "",
      hasDocuments: Boolean(payload?.hasDocuments),
      requiresCompliance: Boolean(payload?.requiresCompliance),
    },
    resourceType: "ai_workflow",
    resourceId: payload?.workflowRunId || payload?.requestId || "",
    dedupeKey: payload?.workflowRunId ? `ai-workflow:${payload.workflowRunId}` : "",
    featureFlagEnabled:
      featureFlags.backgroundJobsEnabled &&
      featureFlags.aiQueueEnabled &&
      featureFlags.multiAgentAsyncEnabled,
    inlineHandler: null,
  });

export const enqueuePaymentReconciliationJob = async (payload) =>
  dispatchJob({
    queueName: QUEUE_NAMES.payments,
    jobName: JOB_NAMES.paymentReconcile,
    payload,
    payloadSummary: {
      orderId: payload?.orderId || "",
      paymentId: payload?.paymentId || "",
      userId: payload?.userId || "",
    },
    dedupeKey: `payment-reconcile:${payload?.orderId || payload?.paymentId || ""}`,
    featureFlagEnabled:
      featureFlags.backgroundJobsEnabled &&
      featureFlags.paymentQueueEnabled &&
      featureFlags.paymentReconciliationEnabled,
    inlineHandler: processPaymentReconciliation,
  });
