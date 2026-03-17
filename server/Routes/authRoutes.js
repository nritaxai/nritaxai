import express from 'express';
import {
  appleLogin,
  changePassword,
  deleteAccount,
  forgotPassword,
  getUserProfile,
  googleLogin,
  loginUser, registerUser,
  resetPassword,
  updateUserProfile
} from '../Controllers/authController.js';
import { protect } from '../Middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/google-login", googleLogin);
router.post("/apple", appleLogin);

router.get("/profile", protect, getUserProfile);

router.put("/profile", protect, updateUserProfile);
router.put("/change-password", protect, changePassword);

router.delete("/delete-account", protect, deleteAccount);

export default router;
