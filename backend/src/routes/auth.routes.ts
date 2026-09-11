import express from "express";

import {
  registerUser,
  loginUser,
  refreshTokenHandler,
  logoutUser,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/auth.controller";

import {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  passwordChangeLimiter,
} from "../middleware/rateLimit.middleware";
import { requireAuth } from "../middleware/requireAuth";

const router = express.Router();

// Auth routes
router.post("/register", registerUser);
router.post("/login", loginLimiter, loginUser);

// /me is Bearer-protected; /refresh and /logout are the only cookie routes
router.get("/me", requireAuth, me);
router.get("/refresh", refreshTokenHandler);
router.post("/logout", logoutUser);

// Slice 14 — credential hardening. forgot/reset are public by nature;
// change proves the session AND the current password.
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);
router.put("/password", passwordChangeLimiter, requireAuth, changePassword);

export default router;
