const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  refreshTokenHandler,
  logoutUser,
  me,
} = require("../controllers/auth.controller");

const { loginLimiter } = require("../middleware/rateLimit.middleware");

// Auth routes
router.post("/register", registerUser);
router.post("/login", loginLimiter, loginUser);

// Session routes (cookie-based)
router.get("/me", me);
router.get("/refresh", refreshTokenHandler);
router.post("/logout", logoutUser);

module.exports = router;
