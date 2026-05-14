import { PLAN_KEYS, SUBSCRIPTION_STATUSES } from "../../shared/subscriptionConfig.js";

export const PAYMENT_RECOVERY_STATUS = {
  NONE: "none",
  PENDING: "pending",
  RECOVERED: "recovered",
  MANUAL_REVIEW: "manual_review",
};

export const PAYMENT_LIFECYCLE_STATE = {
  CREATED: "created",
  AUTHENTICATED: "authenticated",
  ACTIVE: "active",
  PENDING: "pending",
  HALTED: "halted",
  PAUSED: "paused",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
};

const BILLING_MONTHS = {
  monthly: 1,
  yearly: 12,
};

export const getBillingMonths = (billing = "monthly") => BILLING_MONTHS[String(billing || "monthly").toLowerCase()] || 1;

export const calculateSubscriptionWindow = ({ start = new Date(), billing = "monthly" } = {}) => {
  const startDate = new Date(start);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + getBillingMonths(billing));
  return { startDate, endDate };
};

export const applyPaidSubscriptionState = ({ user, orderId = "", billing = "monthly", provider = "razorpay" }) => {
  const { startDate, endDate } = calculateSubscriptionWindow({ billing });
  user.subscription.subscriptionId = orderId;
  user.subscription.provider = provider;
  user.subscription.plan = "PRO";
  user.subscription.status = "active";
  user.subscription.currentPeriodStart = startDate;
  user.subscription.currentPeriodEnd = endDate;
  user.plan = PLAN_KEYS.PROFESSIONAL;
  user.subscriptionStatus = SUBSCRIPTION_STATUSES.ACTIVE;
  user.subscriptionStartDate = startDate;
  user.subscriptionEndDate = endDate;

  return {
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodStart: startDate,
    currentPeriodEnd: endDate,
  };
};

export const isDuplicateSuccessfulCharge = ({ existingAttempt, paymentId = "" }) =>
  Boolean(
    existingAttempt &&
      existingAttempt.status === "verified" &&
      existingAttempt.paymentId &&
      String(existingAttempt.paymentId) !== "" &&
      String(existingAttempt.paymentId) !== String(paymentId || "")
  );
