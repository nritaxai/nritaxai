import {
  FEATURE_KEYS,
  PLAN_CONFIG,
  PLAN_KEYS,
  PLAN_ORDER,
  normalizePlanKey,
} from "../../../shared/subscriptionConfig.js";

export type PlanKey = "starter" | "professional" | "enterprise";
export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export type SubscriptionMe = {
  plan: PlanKey;
  subscriptionStatus: "active" | "inactive" | "canceled";
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  currentPlan: {
    key: PlanKey;
    displayName: string;
    priceLabel: string;
    modelTier: string;
  };
  usage: {
    chatUsageCount: number;
    chatUsageMonth: string | null;
    cpaUsageCount: number;
    cpaUsageMonth: string | null;
  };
  limits: {
    chatMessagesPerMonth: number | null;
    cpaConsultationsPerMonth: number | null;
  };
  remaining: {
    chatMessages: number | null;
    cpaConsultations: number | null;
  };
  allowedFeatures: string[];
  features: Record<string, boolean>;
};

export const CLIENT_PLAN_ORDER = PLAN_ORDER as PlanKey[];
export const CLIENT_PLAN_CONFIG = PLAN_CONFIG as typeof PLAN_CONFIG;
export { FEATURE_KEYS, PLAN_KEYS };

export const getPlanLabel = (plan: string | undefined | null) =>
  CLIENT_PLAN_CONFIG[normalizePlanKey(plan)]?.displayName || "Starter";

export const isFeatureAvailable = (subscription: Partial<SubscriptionMe> | null | undefined, featureKey: string) =>
  Boolean(subscription?.features?.[featureKey]);

export const isCurrentPlan = (subscription: Partial<SubscriptionMe> | null | undefined, planKey: PlanKey) =>
  normalizePlanKey(subscription?.plan) === planKey;

export const getRemainingChatLabel = (subscription: Partial<SubscriptionMe> | null | undefined) => {
  if (!subscription) return "";
  if (subscription.remaining?.chatMessages === null) return "Unlimited AI chat";
  const remaining = Math.max(0, Number(subscription.remaining?.chatMessages || 0));
  return `${remaining} of ${subscription.limits?.chatMessagesPerMonth ?? 0} AI messages left this month`;
};
