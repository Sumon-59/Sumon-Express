import express from "express";

import {
  registerUser,
  loginUser,
  refreshTokenHandler,
  logoutUser,
  me,
} from "../controllers/auth.controller";

import { loginLimiter } from "../middleware/rateLimit.middleware";

const router = express.Router();

// Auth routes
router.post("/register", registerUser);
router.post("/login", loginLimiter, loginUser);

// Session routes (cookie-based)
router.get("/me", me);
router.get("/refresh", refreshTokenHandler);
router.post("/logout", logoutUser);

export = router;
