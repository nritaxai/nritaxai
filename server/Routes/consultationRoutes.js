import express from "express";
import {
  sendConsultationTestEmail,
  submitConsultationRequest,
} from "../Controllers/consultationController.js";

const router = express.Router();

router.post("/", submitConsultationRequest);
router.post("/email/test-consultation", sendConsultationTestEmail);

export default router;
