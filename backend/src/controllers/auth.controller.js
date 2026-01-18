const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const asyncHandler = require("../utils/asyncHandler");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/token");

/**
 * Helper to set refresh token cookie in a dev/prod safe way.
 * - Dev (localhost): secure=false, sameSite=lax
 * - Prod (https):     secure=true, sameSite=none
 */
const setRefreshCookie = (res, refreshToken) => {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("jwt", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * @desc    Register new user (auto-login by setting refresh cookie)
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    const err = new Error("All fields are required");
    err.statusCode = 400;
    throw err;
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const err = new Error("User already exists");
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    name,
    email,
    password: hashedPassword,
  });

  // Generate tokens (auto-login)
  const accessToken = generateAccessToken(newUser._id);
  const refreshToken = generateRefreshToken(newUser._id);

  // Store refresh token in DB (rotation support)
  newUser.refreshToken = refreshToken;
  await newUser.save();

  // Set refresh cookie
  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    message: "User registered successfully",
    accessToken, // optional; frontend may ignore because cookie is the source of truth
  });
});

/**
 * @desc    Login user (issue access + refresh token)
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error("Invalid credentials");
    err.statusCode = 401;
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const err = new Error("Invalid credentials");
    err.statusCode = 401;
    throw err;
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Store refresh token in DB (rotation support)
  user.refreshToken = refreshToken;
  await user.save();

  // Set refresh cookie
  setRefreshCookie(res, refreshToken);

  res.json({ accessToken });
});

/**
 * @desc    Refresh access token (rotate refresh token)
 * @route   GET /api/auth/refresh
 * @access  Public (cookie based)
 */
const refreshTokenHandler = asyncHandler(async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  const refreshToken = cookies.jwt;

  const user = await User.findOne({ refreshToken });
  if (!user) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  jwt.verify(
    refreshToken,
    process.env.JWT_REFRESH_SECRET,
    async (err, decoded) => {
      if (err || user._id.toString() !== decoded.userId) {
        const error = new Error("Forbidden");
        error.statusCode = 403;
        throw error;
      }

      // Rotate tokens
      const newAccessToken = generateAccessToken(user._id);
      const newRefreshToken = generateRefreshToken(user._id);

      user.refreshToken = newRefreshToken;
      await user.save();

      // Set rotated refresh cookie
      setRefreshCookie(res, newRefreshToken);

      res.json({ accessToken: newAccessToken });
    }
  );
});

/**
 * @desc    Logout user (revoke refresh token)
 * @route   POST /api/auth/logout
 * @access  Public (cookie based)
 */
const logoutUser = asyncHandler(async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    return res.sendStatus(204); // No content
  }

  const refreshToken = cookies.jwt;

  const user = await User.findOne({ refreshToken });
  if (user) {
    user.refreshToken = "";
    await user.save();
  }

  // Clear cookie with matching attributes
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });

  res.sendStatus(204);
});

const me = asyncHandler(async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  const refreshToken = cookies.jwt;

  // Verify refresh token
  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
    if (err) {
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      throw error;
    }

    // decoded.userId because our tokens use { userId }
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(decoded.userId).select("_id name email role");

    if (!user) {
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      throw error;
    }

    res.status(200).json({ user });
  });
});

module.exports = {
  registerUser,
  loginUser,
  refreshTokenHandler,
  logoutUser,
  me,
};
