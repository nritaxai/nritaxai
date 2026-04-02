import express from "express";
import multer from "multer";
import {
  createExpertOnboardingCaptchaChallenge,
  submitExpertOnboarding,
} from "../Controllers/expertOnboardingController.js";
import { createRateLimiter } from "../Middlewares/rateLimit.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.EXPERT_ONBOARDING_MAX_FILE_BYTES || 10 * 1024 * 1024),
  },
});

router.get(
  "/captcha-challenge",
  createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: Number(process.env.EXPERT_ONBOARDING_CAPTCHA_REFRESH_PER_MIN || 20),
    message: "Too many CAPTCHA refresh attempts. Please try again in a minute.",
  }),
  createExpertOnboardingCaptchaChallenge
);

router.post(
  "/submit",
  createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: Number(process.env.EXPERT_ONBOARDING_SUBMIT_PER_MIN || 8),
    message: "Too many onboarding attempts. Please try again in a minute.",
  }),
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "profile", maxCount: 1 },
  ]),
  submitExpertOnboarding
);

export default router;
