import express from "express";
import {
  sendConsultationTestEmail,
  submitConsultationRequest,
} from "../Controllers/consultationController.js";
import { protect } from "../Middlewares/authMiddleware.js";
import { requireFeature } from "../Utils/subscriptionAccess.js";
import { FEATURE_KEYS } from "../../shared/subscriptionConfig.js";

const router = express.Router();

router.post("/", protect, requireFeature(FEATURE_KEYS.UNLIMITED_CPA_CONSULTATIONS), submitConsultationRequest);
router.post("/email/test-consultation", sendConsultationTestEmail);

export default router;
