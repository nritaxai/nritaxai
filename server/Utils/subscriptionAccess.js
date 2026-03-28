import {
  FEATURE_KEYS,
  PLAN_KEYS,
  SUBSCRIPTION_STATUSES,
  getLegacyPlanCode,
  getPlanCapabilities,
  getPlanConfig,
  getRemainingCount,
  isFeatureEnabled,
  normalizePlanKey,
  normalizeSubscriptionStatus,
} from "../../shared/subscriptionConfig.js";

const isSameUtcMonth = (dateA, dateB) =>
  dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
  dateA.getUTCMonth() === dateB.getUTCMonth();

const getSafeDate = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

export const normalizeUserSubscriptionState = (userDoc) => {
  if (!userDoc) return false;

  let changed = false;
  const now = new Date();
  const normalizedPlan = normalizePlanKey(
    userDoc.plan || userDoc.subscription?.plan || PLAN_KEYS.STARTER
  );
  const normalizedStatus = normalizeSubscriptionStatus(
    userDoc.subscriptionStatus || userDoc.subscription?.status || SUBSCRIPTION_STATUSES.ACTIVE
  );

  if (userDoc.plan !== normalizedPlan) {
    userDoc.plan = normalizedPlan;
    changed = true;
  }

  if (userDoc.subscriptionStatus !== normalizedStatus) {
    userDoc.subscriptionStatus = normalizedStatus;
    changed = true;
  }

  if (typeof userDoc.chatUsageCount !== "number" || userDoc.chatUsageCount < 0) {
    userDoc.chatUsageCount = 0;
    changed = true;
  }

  if (typeof userDoc.cpaUsageCount !== "number" || userDoc.cpaUsageCount < 0) {
    userDoc.cpaUsageCount = 0;
    changed = true;
  }

  const chatUsageMonth = getSafeDate(userDoc.chatUsageMonth);
  if (!chatUsageMonth || !isSameUtcMonth(chatUsageMonth, now)) {
    userDoc.chatUsageMonth = now;
    userDoc.chatUsageCount = 0;
    changed = true;
  }

  const cpaUsageMonth = getSafeDate(userDoc.cpaUsageMonth);
  if (!cpaUsageMonth || !isSameUtcMonth(cpaUsageMonth, now)) {
    userDoc.cpaUsageMonth = now;
    userDoc.cpaUsageCount = 0;
    changed = true;
  }

  const endDate = getSafeDate(userDoc.subscriptionEndDate);
  const shouldExpirePaidPlan =
    normalizedPlan !== PLAN_KEYS.STARTER &&
    endDate &&
    endDate.getTime() < now.getTime() &&
    normalizedStatus === SUBSCRIPTION_STATUSES.ACTIVE;

  if (shouldExpirePaidPlan) {
    userDoc.plan = PLAN_KEYS.STARTER;
    userDoc.subscriptionStatus = SUBSCRIPTION_STATUSES.INACTIVE;
    userDoc.subscriptionStartDate = null;
    userDoc.subscriptionEndDate = null;
    changed = true;
  }

  userDoc.subscription = {
    ...(userDoc.subscription?.toObject?.() || userDoc.subscription || {}),
    plan: getLegacyPlanCode(userDoc.plan),
    status:
      userDoc.subscriptionStatus === SUBSCRIPTION_STATUSES.CANCELED
        ? "cancelled"
        : userDoc.subscriptionStatus,
    subscriptionId: userDoc.subscription?.subscriptionId || null,
    provider: userDoc.subscription?.provider || "razorpay",
    currentPeriodStart: userDoc.subscriptionStartDate || null,
    currentPeriodEnd: userDoc.subscriptionEndDate || null,
  };

  return changed;
};

export const getSubscriptionSummary = (userDoc) => {
  normalizeUserSubscriptionState(userDoc);
  const config = getPlanConfig(userDoc?.plan);
  const canUsePaidPlan =
    userDoc?.plan === PLAN_KEYS.STARTER || userDoc?.subscriptionStatus === SUBSCRIPTION_STATUSES.ACTIVE;

  return {
    plan: userDoc?.plan || PLAN_KEYS.STARTER,
    subscriptionStatus: canUsePaidPlan
      ? userDoc?.subscriptionStatus || SUBSCRIPTION_STATUSES.ACTIVE
      : SUBSCRIPTION_STATUSES.INACTIVE,
    subscriptionStartDate: userDoc?.subscriptionStartDate || null,
    subscriptionEndDate: userDoc?.subscriptionEndDate || null,
    currentPlan: {
      key: config.key,
      displayName: config.displayName,
      priceLabel: config.priceLabel,
      modelTier: config.modelTier,
    },
    usage: {
      chatUsageCount: Math.max(0, Number(userDoc?.chatUsageCount || 0)),
      chatUsageMonth: userDoc?.chatUsageMonth || null,
      cpaUsageCount: Math.max(0, Number(userDoc?.cpaUsageCount || 0)),
      cpaUsageMonth: userDoc?.cpaUsageMonth || null,
    },
    limits: config.limits,
    remaining: {
      chatMessages: getRemainingCount(config.limits.chatMessagesPerMonth, userDoc?.chatUsageCount || 0),
      cpaConsultations: getRemainingCount(config.limits.cpaConsultationsPerMonth, userDoc?.cpaUsageCount || 0),
    },
    allowedFeatures: Object.entries(config.features)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([featureKey]) => featureKey),
    features: config.features,
  };
};

export const activatePlan = (userDoc, planKey) => {
  const normalizedPlan = normalizePlanKey(planKey);
  const now = new Date();
  userDoc.plan = normalizedPlan;
  userDoc.subscriptionStatus = SUBSCRIPTION_STATUSES.ACTIVE;
  userDoc.subscriptionStartDate = now;
  userDoc.subscriptionEndDate =
    normalizedPlan === PLAN_KEYS.PROFESSIONAL
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      : normalizedPlan === PLAN_KEYS.ENTERPRISE
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      : null;
  normalizeUserSubscriptionState(userDoc);
};

export const downgradeToStarter = (userDoc) => {
  userDoc.plan = PLAN_KEYS.STARTER;
  userDoc.subscriptionStatus = SUBSCRIPTION_STATUSES.ACTIVE;
  userDoc.subscriptionStartDate = null;
  userDoc.subscriptionEndDate = null;
  normalizeUserSubscriptionState(userDoc);
};

export const requireActiveSubscription = (req, res, next) => {
  const userDoc = req.user;
  if (!userDoc) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  normalizeUserSubscriptionState(userDoc);
  const isStarter = userDoc.plan === PLAN_KEYS.STARTER;
  const isActive = userDoc.subscriptionStatus === SUBSCRIPTION_STATUSES.ACTIVE;
  if (!isStarter && !isActive) {
    return res.status(403).json({
      success: false,
      message: "Your subscription is inactive or expired.",
      subscription: getSubscriptionSummary(userDoc),
    });
  }

  return next();
};

export const requireFeature = (featureKey) => (req, res, next) => {
  const userDoc = req.user;
  if (!userDoc) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  normalizeUserSubscriptionState(userDoc);
  if (!isFeatureEnabled(userDoc.plan, featureKey)) {
    return res.status(403).json({
      success: false,
      message:
        featureKey === FEATURE_KEYS.UNLIMITED_CPA_CONSULTATIONS
          ? "Enterprise plan required for CPA consultations."
          : "This feature is not included in your current plan.",
      subscription: getSubscriptionSummary(userDoc),
    });
  }

  return next();
};

export const checkAndConsumeChatUsage = async (userDoc) => {
  normalizeUserSubscriptionState(userDoc);
  const capabilities = getPlanCapabilities(userDoc.plan);
  const monthlyLimit = capabilities.limits.chatMessagesPerMonth;
  if (monthlyLimit === null) {
    return {
      allowed: true,
      summary: getSubscriptionSummary(userDoc),
      modelTier: capabilities.modelTier,
    };
  }

  const used = Math.max(0, Number(userDoc.chatUsageCount || 0));
  if (used >= monthlyLimit) {
    return {
      allowed: false,
      message: "Free plan limit reached. Upgrade to Professional.",
      summary: getSubscriptionSummary(userDoc),
      modelTier: capabilities.modelTier,
    };
  }

  userDoc.chatUsageCount = used + 1;
  await userDoc.save();
  return {
    allowed: true,
    summary: getSubscriptionSummary(userDoc),
    modelTier: capabilities.modelTier,
  };
};

export const incrementCpaUsage = async (userDoc) => {
  normalizeUserSubscriptionState(userDoc);
  const capabilities = getPlanCapabilities(userDoc.plan);
  const monthlyLimit = capabilities.limits.cpaConsultationsPerMonth;
  if (monthlyLimit !== null) {
    const used = Math.max(0, Number(userDoc.cpaUsageCount || 0));
    if (used >= monthlyLimit) {
      return {
        allowed: false,
        message: "CPA consultations are not included in your current plan.",
        summary: getSubscriptionSummary(userDoc),
      };
    }
    userDoc.cpaUsageCount = used + 1;
  } else {
    userDoc.cpaUsageCount = Math.max(0, Number(userDoc.cpaUsageCount || 0)) + 1;
  }

  await userDoc.save();
  return {
    allowed: true,
    summary: getSubscriptionSummary(userDoc),
  };
};
