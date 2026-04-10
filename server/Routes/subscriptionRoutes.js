import express from "express";
import { protect } from "../Middlewares/authMiddleware.js";
import {
  cancelSubscription,
  createSubscription,
  getRazorpayDebugConfig,
  getMySubscription,
  getSubscriptionStatus,
  razorpayWebhook,
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
router.get("/debug-config", protect, getRazorpayDebugConfig);

// Razorpay webhook (public route, called by Razorpay)
router.post("/razorpay-webhook", razorpayWebhook);

export default router;
