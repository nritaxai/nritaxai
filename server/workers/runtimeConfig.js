import { QUEUE_NAMES } from "../queues/jobNames.js";

const PROCESSABLE_QUEUES = [
  QUEUE_NAMES.pdf,
  QUEUE_NAMES.ai,
  QUEUE_NAMES.reports,
  QUEUE_NAMES.notifications,
  QUEUE_NAMES.payments,
];

const QUEUE_ALIASES = {
  pdf: QUEUE_NAMES.pdf,
  pdf_jobs: QUEUE_NAMES.pdf,
  ai: QUEUE_NAMES.ai,
  ai_jobs: QUEUE_NAMES.ai,
  reports: QUEUE_NAMES.reports,
  report: QUEUE_NAMES.reports,
  report_jobs: QUEUE_NAMES.reports,
  notifications: QUEUE_NAMES.notifications,
  notification: QUEUE_NAMES.notifications,
  notification_jobs: QUEUE_NAMES.notifications,
  payments: QUEUE_NAMES.payments,
  payment: QUEUE_NAMES.payments,
  payment_jobs: QUEUE_NAMES.payments,
};

const normalizeToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseQueueList = (value = "") =>
  String(value || "")
    .split(",")
    .map((item) => normalizeToken(item))
    .filter(Boolean)
    .map((item) => QUEUE_ALIASES[item] || item)
    .filter((item) => PROCESSABLE_QUEUES.includes(item));

const toEnvSuffix = (queueName = "") =>
  String(queueName || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

const readPositiveInteger = (...values) => {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return null;
};

export const getWorkerGroup = () => String(process.env.WORKER_GROUP || "default").trim() || "default";

export const getSelectedQueues = () => {
  const selectedQueues = parseQueueList(process.env.WORKER_QUEUES || "");
  return selectedQueues.length ? selectedQueues : [...PROCESSABLE_QUEUES];
};

export const getWorkerConcurrencyForQueue = (queueName) => {
  const suffix = toEnvSuffix(queueName);
  const alias = normalizeToken(queueName).replace(/_jobs$/, "");
  return (
    readPositiveInteger(
      process.env[`WORKER_CONCURRENCY__${suffix}`],
      process.env[`WORKER_CONCURRENCY__${String(alias || "").toUpperCase()}`],
      process.env.WORKER_CONCURRENCY
    ) || 4
  );
};

export const getProcessableQueues = () => [...PROCESSABLE_QUEUES];
