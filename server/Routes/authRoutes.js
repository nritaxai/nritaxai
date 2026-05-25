import express from 'express';
import {
  acceptTerms,
  appleAuthController,
  changePassword,
  deleteAccount,
  forgotPassword,
  getUserProfile,
  googleLogin,
  googleNativeLogin,
  linkedinLogin,
  linkedinCallback,
  listCountryChangeRequests,
  loginUser, registerUser,
  decideCountryChangeRequest,
  requestCountryChange,
  resetPassword,
  startLinkedInAuth,
  updateUserProfile
} from '../Controllers/authController.js';
import { createRateLimiter } from "../Middlewares/rateLimit.js";
import { protect } from '../Middlewares/authMiddleware.js';
import { rejectLockedCountryMutation, validateSignupCountry } from "../Middlewares/countryMiddleware.js";
import { ADMIN_EMAIL } from "../Config/branding.js";

const router = express.Router();
const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.AUTH_RATE_LIMIT_PER_MIN || 20),
  message: "Too many auth attempts. Please retry in a minute.",
});

const requireCountryAdmin = (req, res, next) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const isAdminRole = roles.map((role) => String(role || "").toLowerCase()).includes("admin");
  const isConfiguredAdmin = ADMIN_EMAIL && String(req.user?.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if (isAdminRole || isConfiguredAdmin) return next();

  return res.status(403).json({
    success: false,
    message: "Admin access required.",
  });
};

router.post('/register', authRateLimiter, validateSignupCountry, registerUser);
router.post("/login", authRateLimiter, loginUser);
router.post("/forgot-password", authRateLimiter, forgotPassword);
router.post("/reset-password", authRateLimiter, resetPassword);

router.post("/google-login", authRateLimiter, googleLogin);
router.post("/google-native", authRateLimiter, googleNativeLogin);
router.post("/apple", authRateLimiter, appleAuthController);
router.post("/linkedin", authRateLimiter, linkedinLogin);
router.get("/linkedin", authRateLimiter, startLinkedInAuth);
router.get("/linkedin/callback", linkedinCallback);
router.post("/accept-terms", protect, acceptTerms);

router.get("/profile", protect, getUserProfile);

router.put("/profile", protect, rejectLockedCountryMutation, updateUserProfile);
router.post("/country-change-request", protect, requestCountryChange);
router.post("/request-country-change", protect, requestCountryChange);
router.get("/admin/country-change-requests", protect, requireCountryAdmin, listCountryChangeRequests);
router.put("/admin/country-change-requests/:requestId", protect, requireCountryAdmin, decideCountryChangeRequest);
router.put("/change-password", protect, changePassword);

router.delete("/delete-account", protect, deleteAccount);

export default router;
