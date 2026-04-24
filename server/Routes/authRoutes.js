import express from 'express';
import {
  appleAuth,
  appleLogin,
  changePassword,
  deleteAccount,
  forgotPassword,
  getUserProfile,
  googleCallback,
  googleLogin,
  linkedinLogin,
  linkedinCallback,
  loginUser, registerUser,
  resetPassword,
  startGoogleAuth,
  startLinkedInAuth,
  updateUserProfile
} from '../Controllers/authController.js';
import { createRateLimiter } from "../Middlewares/rateLimit.js";
import { protect } from '../Middlewares/authMiddleware.js';

const router = express.Router();
const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.AUTH_RATE_LIMIT_PER_MIN || 20),
  message: "Too many auth attempts. Please retry in a minute.",
});

router.post('/register', authRateLimiter, registerUser);
router.post("/login", authRateLimiter, loginUser);
router.post("/forgot-password", authRateLimiter, forgotPassword);
router.post("/reset-password", authRateLimiter, resetPassword);

router.post("/google-login", authRateLimiter, googleLogin);
router.get("/google", authRateLimiter, startGoogleAuth);
router.get("/google/callback", googleCallback);
router.post("/auth/apple", authRateLimiter, appleAuth);
router.post("/apple", authRateLimiter, appleLogin);
router.post("/linkedin", authRateLimiter, linkedinLogin);
router.get("/linkedin", authRateLimiter, startLinkedInAuth);
router.get("/linkedin/callback", linkedinCallback);

router.get("/profile", protect, getUserProfile);

router.put("/profile", protect, updateUserProfile);
router.put("/change-password", protect, changePassword);

router.delete("/delete-account", protect, deleteAccount);

export default router;
