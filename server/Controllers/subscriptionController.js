import crypto from "crypto";
import User from "../Models/userModel.js";
import razorpay from "../Config/razorpay.js";
import {
  PLAN_KEYS,
  SUBSCRIPTION_STATUSES,
  getLegacyPlanCode,
  getPlanConfig,
  normalizePlanKey,
} from "../../shared/subscriptionConfig.js";
import {
  downgradeToStarter,
  getSubscriptionSummary,
  normalizeUserSubscriptionState,
} from "../Utils/subscriptionAccess.js";

const PLAN_ALIAS = {
  pro: PLAN_KEYS.PROFESSIONAL,
  professional: PLAN_KEYS.PROFESSIONAL,
  enterprise: PLAN_KEYS.ENTERPRISE,
};

const PROMO_CODES = {
  SANDBOX10: {
    discountPercent: 10,
  },
  SANDBOX15: {
    discountPercent: 15,
  },
  SANDBOX20: {
    discountPercent: 20,
  },
  NRITAX99: {
    discountPercent: 99,
  },
  SANDBOXY25: {
    discountPercent: 25,
    billing: "yearly",
  },
};

const mapPlanFromRazorpayPlanId = (planId) => {
  if (planId && planId === process.env.RAZORPAY_PRO_PLAN_ID) return getLegacyPlanCode(PLAN_KEYS.PROFESSIONAL);
  return getLegacyPlanCode(PLAN_KEYS.STARTER);
};

const EVENT_STATUS_MAP = {
  "subscription.authenticated": "inactive",
  "subscription.activated": "active",
  "subscription.charged": "active",
  "subscription.pending": "inactive",
  "subscription.halted": "inactive",
  "subscription.paused": "inactive",
  "subscription.resumed": "active",
  "subscription.cancelled": "cancelled",
  "subscription.completed": "expired",
  "subscription.expired": "expired",
};

const RAZORPAY_LIFECYCLE_STATUS_TO_LOCAL = {
  created: "inactive",
  authenticated: "inactive",
  active: "active",
  pending: "inactive",
  halted: "inactive",
  paused: "inactive",
  cancelled: "cancelled",
  completed: "expired",
  expired: "expired",
};

const resolvePlanMeta = ({ plan }) => {
  if (!plan) return null;
  const normalizedPlan = String(plan).toLowerCase();
  const mappedPlan = PLAN_ALIAS[normalizedPlan];
  if (!mappedPlan) return null;
  return { planKey: mappedPlan, planName: getLegacyPlanCode(mappedPlan) };
};

const normalizeText = (value) => String(value || "").trim();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const normalizeCountryKey = (value) => normalizeText(value).toLowerCase();

const normalizeStateKey = (value) => normalizeText(value).toLowerCase();

const INDIA_COUNTRY_KEYS = new Set(["india", "in", "bharat"]);
const KARNATAKA_STATE_KEYS = new Set(["karnataka", "ka"]);

const resolveTaxClassification = ({ billingCountry, billingState }) => {
  const countryKey = normalizeCountryKey(billingCountry);
  const stateKey = normalizeStateKey(billingState);
  const isIndia = INDIA_COUNTRY_KEYS.has(countryKey);

  if (!isIndia) {
    return {
      taxType: "EXPORT_OF_SERVICE",
      gstMode: "NONE",
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      totalTaxRate: 0,
    };
  }

  if (KARNATAKA_STATE_KEYS.has(stateKey)) {
    return {
      taxType: "DOMESTIC_INTRA_STATE",
      gstMode: "CGST_SGST",
      cgstRate: 9,
      sgstRate: 9,
      igstRate: 0,
      totalTaxRate: 18,
    };
  }

  return {
    taxType: "DOMESTIC_INTER_STATE",
    gstMode: "IGST",
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 18,
    totalTaxRate: 18,
  };
};

const hmacSha256 = (payload, secret) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");

const toDateOrNull = (epochSeconds) =>
  epochSeconds ? new Date(epochSeconds * 1000) : null;

const getRazorpayStatus = (status) =>
  RAZORPAY_LIFECYCLE_STATUS_TO_LOCAL[String(status || "").toLowerCase()] || "inactive";

const getHeaderValue = (value) => {
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
};

const maskValue = (value, keepStart = 4, keepEnd = 3) => {
  if (!value) return null;
  const str = String(value);
  if (str.length <= keepStart + keepEnd) return "*".repeat(str.length);
  return `${str.slice(0, keepStart)}${"*".repeat(str.length - keepStart - keepEnd)}${str.slice(-keepEnd)}`;
};

const ensureRequiredEnv = (...keys) => {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return `Missing required env vars: ${missing.join(", ")}`;
  }
  return null;
};

const getRazorpayErrorMessage = (error) => {
  const apiDescription = error?.error?.description || error?.error?.message;
  const directMessage = error?.message;
  return apiDescription || directMessage || "Unknown Razorpay error";
};

export const getRazorpayDebugConfig = async (_req, res) => {
  try {
    const required = [
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
    ];

    const missing = required.filter((key) => !process.env[key]);

    return res.status(200).json({
      success: true,
      razorpay: {
        ready: missing.length === 0,
        missing,
        keyIdMasked: maskValue(process.env.RAZORPAY_KEY_ID),
        keySecretMasked: maskValue(process.env.RAZORPAY_KEY_SECRET),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load Razorpay debug config",
      error: error.message,
    });
  }
};

const syncUserSubscriptionFromRazorpayEntity = (user, subscriptionEntity) => {
  if (!subscriptionEntity) return;

  if (subscriptionEntity.id) {
    user.subscription.subscriptionId = subscriptionEntity.id;
  }

  if (subscriptionEntity.status) {
    user.subscription.status = getRazorpayStatus(subscriptionEntity.status);
  }

  if (subscriptionEntity.plan_id) {
    user.subscription.plan = mapPlanFromRazorpayPlanId(subscriptionEntity.plan_id);
  }

  user.subscription.currentPeriodStart = toDateOrNull(subscriptionEntity.current_start);
  user.subscription.currentPeriodEnd = toDateOrNull(subscriptionEntity.current_end);
  if (subscriptionEntity.plan_id) {
    const legacyPlan = mapPlanFromRazorpayPlanId(subscriptionEntity.plan_id);
    user.plan =
      legacyPlan === "PRO"
        ? PLAN_KEYS.PROFESSIONAL
        : legacyPlan === "PREMIUM"
        ? PLAN_KEYS.ENTERPRISE
        : PLAN_KEYS.STARTER;
  }
  user.subscriptionStatus =
    getRazorpayStatus(subscriptionEntity.status) === "cancelled"
      ? SUBSCRIPTION_STATUSES.CANCELED
      : getRazorpayStatus(subscriptionEntity.status) === "expired"
      ? SUBSCRIPTION_STATUSES.INACTIVE
      : SUBSCRIPTION_STATUSES.ACTIVE;
  user.subscriptionStartDate = toDateOrNull(subscriptionEntity.current_start);
  user.subscriptionEndDate = toDateOrNull(subscriptionEntity.current_end);
};

export const createSubscription = async (req, res) => {
  try {
    const envError = ensureRequiredEnv("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET");
    if (envError) {
      return res.status(500).json({ success: false, message: envError });
    }

    const meta = resolvePlanMeta(req.body || {});
    if (!meta) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan. Only `professional` checkout is supported here.",
      });
    }
    if (meta.planKey !== PLAN_KEYS.PROFESSIONAL) {
      return res.status(400).json({
        success: false,
        message: "Enterprise activation is handled separately. Please contact support.",
      });
    }

    const billing = String(req.body?.billing || "monthly").toLowerCase();
    if (!["monthly", "yearly"].includes(billing)) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing. Allowed values: monthly, yearly.",
      });
    }

    const promoCode = String(req.body?.promoCode || "").trim().toUpperCase();
    const baseAmountInPaise = billing === "yearly" ? 999900 : 99900;

    let discountPercent = 0;
    if (promoCode) {
      if (!Object.prototype.hasOwnProperty.call(PROMO_CODES, promoCode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid promo code.",
        });
      }
      if (promoCode === "SANDBOXY25" && billing !== "yearly") {
        return res.status(400).json({
          success: false,
          message: "SANDBOXY25 is valid only for yearly billing.",
        });
      }
      discountPercent = PROMO_CODES[promoCode].discountPercent;
    }
    const billingCountry = normalizeText(req.body?.billingCountry);
    const billingState = normalizeText(req.body?.billingState);
    const countryCode = normalizeText(req.body?.countryCode);
    const organization = normalizeText(req.body?.organization);
    const gstVatNumber = normalizeUpper(req.body?.gstVatNumber);
    const referralUserCode = normalizeUpper(req.body?.referralUserCode);
    const tax = resolveTaxClassification({ billingCountry, billingState });

    if (countryCode && !/^\+\d{1,4}$/.test(countryCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid country code format. Use +NN format.",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    normalizeUserSubscriptionState(user);

    const discountPaise = Math.round((baseAmountInPaise * discountPercent) / 100);
    const amountInPaise = Math.max(100, baseAmountInPaise - discountPaise);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      // Razorpay receipt has a max length limit; keep it compact.
      receipt: `nri-${String(user._id).slice(-8)}-${Date.now()}`,
      notes: {
        userId: String(user._id),
        userEmail: user.email,
        plan: meta.planName,
        planKey: meta.planKey,
        billing,
        billingCountry: billingCountry || "UNKNOWN",
        billingState: billingState || "NA",
        countryCode: countryCode || "NA",
        organization: organization || "NA",
        gstVatNumber: gstVatNumber || "NA",
        referralUserCode: referralUserCode || "NA",
        promoCode: promoCode || "NONE",
        discountPercent: String(discountPercent),
        taxType: tax.taxType,
        gstMode: tax.gstMode,
        cgstRate: String(tax.cgstRate),
        sgstRate: String(tax.sgstRate),
        igstRate: String(tax.igstRate),
        totalTaxRate: String(tax.totalTaxRate),
      },
    });

    return res.status(200).json({
      success: true,
      id: order.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      plan: meta.planName,
      planKey: meta.planKey,
      billing,
      promoCode: promoCode || null,
      discountPercent,
      baseAmount: baseAmountInPaise,
      discountAmount: discountPaise,
      tax,
    });
  } catch (error) {
    const razorpayMessage = getRazorpayErrorMessage(error);
    console.error("createSubscription error:", razorpayMessage, error);
    return res.status(500).json({
      success: false,
      message: `Payment order creation failed: ${razorpayMessage}`,
    });
  }
};

export const verifySubscriptionPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
      razorpay_signature: signature,
      billing,
    } = req.body || {};

    if (!paymentId || !orderId || !signature) {
      return res.status(400).json({
        success: false,
        message: "Missing Razorpay payment verification fields",
      });
    }

    const envError = ensureRequiredEnv("RAZORPAY_KEY_SECRET");
    if (envError) {
      return res.status(500).json({ success: false, message: envError });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const expectedSignature = hmacSha256(`${orderId}|${paymentId}`, secret);

    if (expectedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    normalizeUserSubscriptionState(user);

    let orderBilling = String(billing || "monthly").toLowerCase();
    try {
      const fetchedOrder = await razorpay.orders.fetch(orderId);
      const notesBilling = String(fetchedOrder?.notes?.billing || "").toLowerCase();
      if (notesBilling === "monthly" || notesBilling === "yearly") {
        orderBilling = notesBilling;
      }
    } catch (fetchError) {
      console.warn("verifySubscriptionPayment: unable to fetch order:", fetchError?.message || fetchError);
    }

    const start = new Date();
    const end = new Date(start);
    if (orderBilling === "yearly") {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }

    user.subscription.subscriptionId = orderId;
    user.subscription.provider = "razorpay";
    user.subscription.plan = "PRO";
    user.subscription.status = "active";
    user.subscription.currentPeriodStart = start;
    user.subscription.currentPeriodEnd = end;
    user.plan = PLAN_KEYS.PROFESSIONAL;
    user.subscriptionStatus = SUBSCRIPTION_STATUSES.ACTIVE;
    user.subscriptionStartDate = start;
    user.subscriptionEndDate = end;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      subscription: user.subscription,
      subscriptionDetails: getSubscriptionSummary(user),
    });
  } catch (error) {
    console.error("verifySubscriptionPayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    downgradeToStarter(user);
    user.subscription.plan = "FREE";
    user.subscription.status = "active";
    user.subscription.currentPeriodStart = null;
    user.subscription.currentPeriodEnd = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Subscription canceled. Your account has been downgraded to Starter.",
      subscription: user.subscription,
      subscriptionDetails: getSubscriptionSummary(user),
    });
  } catch (error) {
    console.error("cancelSubscription error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message,
    });
  }
};

export const getSubscriptionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "subscription plan subscriptionStatus subscriptionStartDate subscriptionEndDate chatUsageCount chatUsageMonth cpaUsageCount cpaUsageMonth"
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const changed = normalizeUserSubscriptionState(user);
    if (changed) {
      await user.save();
    }

    return res.status(200).json({
      success: true,
      subscription: user.subscription,
      subscriptionDetails: getSubscriptionSummary(user),
    });
  } catch (error) {
    console.error("getSubscriptionStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription status",
      error: error.message,
    });
  }
};

export const getMySubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "subscription plan subscriptionStatus subscriptionStartDate subscriptionEndDate chatUsageCount chatUsageMonth cpaUsageCount cpaUsageMonth"
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const changed = normalizeUserSubscriptionState(user);
    if (changed) {
      await user.save();
    }
    return res.status(200).json({
      success: true,
      ...getSubscriptionSummary(user),
    });
  } catch (error) {
    console.error("getMySubscription error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription details",
    });
  }
};

export const subscribeToPlan = async (req, res) => {
  try {
    const nextPlan = normalizePlanKey(req.body?.plan);
    if (![PLAN_KEYS.PROFESSIONAL, PLAN_KEYS.ENTERPRISE].includes(nextPlan)) {
      return res.status(400).json({
        success: false,
        message: "Only professional or enterprise plans can be requested.",
      });
    }
    if (nextPlan === PLAN_KEYS.ENTERPRISE) {
      return res.status(400).json({
        success: false,
        message: "Enterprise activation is handled separately. Please contact support.",
      });
    }

    return res.status(402).json({
      success: false,
      message: `${getPlanConfig(nextPlan).displayName} plan is activated only after successful payment verification.`,
    });
  } catch (error) {
    console.error("subscribeToPlan error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process subscription request",
    });
  }
};

export const razorpayWebhook = async (req, res) => {
  try {
    const envError = ensureRequiredEnv("RAZORPAY_WEBHOOK_SECRET");
    if (envError) {
      return res
        .status(500)
        .json({ success: false, message: envError });
    }

    const signature = getHeaderValue(req.headers["x-razorpay-signature"]);
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const expected = hmacSha256(rawBody, process.env.RAZORPAY_WEBHOOK_SECRET);

    if (!signature || expected !== signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const event = req.body?.event;
    const subscriptionEntity = req.body?.payload?.subscription?.entity;
    const paymentEntity = req.body?.payload?.payment?.entity;

    if (!event) {
      return res.status(200).json({ status: "ignored", reason: "missing_event" });
    }

    console.log("Razorpay webhook event received:", {
      event,
      subscriptionId: subscriptionEntity?.id || paymentEntity?.subscription_id || null,
      paymentId: paymentEntity?.id || null,
    });

    if (event === "payment.captured" && paymentEntity) {
      const userIdFromNotes = paymentEntity?.notes?.userId;
      const subscriptionIdFromPayment = paymentEntity?.subscription_id;

      let user = null;
      if (userIdFromNotes) {
        user = await User.findById(userIdFromNotes);
      }
      if (!user && subscriptionIdFromPayment) {
        user = await User.findOne({
          "subscription.subscriptionId": subscriptionIdFromPayment,
        });
      }

      if (!user) {
        return res.status(200).json({ status: "user_not_found_for_payment" });
      }

      user.subscription.status = "active";
      if (!user.subscription.currentPeriodStart) {
        user.subscription.currentPeriodStart = new Date();
      }
      await user.save();

      return res.status(200).json({ status: "ok", handledEvent: event });
    }

    if (!subscriptionEntity?.id) {
      return res.status(200).json({ status: "ignored", reason: "missing_subscription_entity" });
    }

    let user = await User.findOne({
      "subscription.subscriptionId": subscriptionEntity.id,
    });

    if (!user && subscriptionEntity?.notes?.userId) {
      user = await User.findById(subscriptionEntity.notes.userId);
      if (user) {
        user.subscription.subscriptionId = subscriptionEntity.id;
      }
    }

    if (!user) {
      return res.status(200).json({ status: "user_not_found_for_subscription" });
    }

    const nextStatus = EVENT_STATUS_MAP[event];
    if (nextStatus) {
      user.subscription.status = nextStatus;
    } else if (subscriptionEntity.status) {
      user.subscription.status = getRazorpayStatus(subscriptionEntity.status);
    }

    if (subscriptionEntity.plan_id) {
      user.subscription.plan = mapPlanFromRazorpayPlanId(subscriptionEntity.plan_id);
    }

    user.subscription.currentPeriodStart = toDateOrNull(subscriptionEntity.current_start);
    user.subscription.currentPeriodEnd = toDateOrNull(subscriptionEntity.current_end);
    await user.save();

    return res.status(200).json({ status: "ok", handledEvent: event });
  } catch (error) {
    console.error("razorpayWebhook error:", error);
    return res.status(500).json({ success: false, message: "Webhook handling failed" });
  }
};

