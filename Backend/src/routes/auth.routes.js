import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Strict rate limiters for auth abuse protection
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many authentication requests, please try again in 15 minutes",
});

const loginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts, please try again in 15 minutes",
});

const otpLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many OTP verification attempts, please try again in 15 minutes",
});

// Public Authentication Flow
router.post("/register", authLimiter, authController.register);
router.post("/verify-otp", otpLimiter, authController.verifyOtp);
router.post("/resend-otp", otpLimiter, authController.resendOtp);
router.post("/login", loginLimiter, authController.login);
router.post("/refresh", authController.refresh);

// Password Management
router.post("/forgot-password", otpLimiter, authController.forgotPassword);
router.post("/reset-password", otpLimiter, authController.resetPassword);
router.post("/change-password", authenticate, authController.changePassword);

// Protected Session Management
router.post("/logout", authController.logout);
router.post("/logout-all", authenticate, authController.logoutAll);
router.get("/me", authenticate, authController.getMe);

export default router;
