import express from "express";
import { protect } from "../Middlewares/authMiddleware.js";
import { requirePermissions } from "../services/enterpriseAccess.js";
import {
  cancelSubscription,
  createSubscription,
  getPaymentReadinessReport,
  getRazorpayDebugConfig,
  getMySubscription,
  getPaymentReliabilityStatus,
  getSubscriptionStatus,
  razorpayWebhook,
  reconcileSubscriptionPayment,
  retryFailedPaymentRecoveries,
  subscribeToPlan,
  validatePromoCode,
  verifySubscriptionPayment,
} from "../Controllers/subscriptionController.js";

const router = express.Router();

// Create subscription (protected route)
router.post("/create-subscription", protect, createSubscription);
router.post("/validate-promo", protect, validatePromoCode);
router.post("/verify-subscription", protect, verifySubscriptionPayment);
router.get("/me", protect, getMySubscription);
router.post("/subscribe", protect, subscribeToPlan);
router.get("/status", protect, getSubscriptionStatus);
router.post("/cancel", protect, cancelSubscription);
router.get("/debug-config", protect, requirePermissions(["payments:read"]), getRazorpayDebugConfig);
router.get("/reliability-status", protect, requirePermissions(["payments:read"]), getPaymentReliabilityStatus);
router.get("/readiness-report", protect, requirePermissions(["payments:read"]), getPaymentReadinessReport);
router.post("/reconcile", protect, requirePermissions(["payments:write"]), reconcileSubscriptionPayment);
router.post("/retry-recoveries", protect, requirePermissions(["payments:write"]), retryFailedPaymentRecoveries);

// Razorpay webhook (public route, called by Razorpay)
router.post("/razorpay-webhook", razorpayWebhook);

export default router;
