import express from "express";
import multer from "multer";
import {
  submitExpertOnboarding,
} from "../Controllers/expertOnboardingController.js";
import { createRateLimiter } from "../Middlewares/rateLimit.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.EXPERT_ONBOARDING_MAX_FILE_BYTES || 10 * 1024 * 1024),
    files: 1,
  },
});

router.post(
  "/submit",
  createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: Number(process.env.EXPERT_ONBOARDING_SUBMIT_PER_MIN || 8),
    message: "Too many onboarding attempts. Please try again in a minute.",
  }),
  upload.single("profile"),
  submitExpertOnboarding
);

export default router;
