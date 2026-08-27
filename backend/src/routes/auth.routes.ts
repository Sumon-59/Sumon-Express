import express from "express";

import {
  registerUser,
  loginUser,
  refreshTokenHandler,
  logoutUser,
  me,
} from "../controllers/auth.controller";

import { loginLimiter } from "../middleware/rateLimit.middleware";
import { requireAuth } from "../middleware/requireAuth";

const router = express.Router();

// Auth routes
router.post("/register", registerUser);
router.post("/login", loginLimiter, loginUser);

// /me is Bearer-protected; /refresh and /logout are the only cookie routes
router.get("/me", requireAuth, me);
router.get("/refresh", refreshTokenHandler);
router.post("/logout", logoutUser);

export default router;
