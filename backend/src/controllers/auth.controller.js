const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const asyncHandler = require("../utils/asyncHandler");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/token");

/**
 * @desc    Register new user
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

  await User.create({
    name,
    email,
    password: hashedPassword,
  });

  res.status(201).json({ message: "User registered successfully" });
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

  // generate tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // store refresh token in DB (rotation support)
  user.refreshToken = refreshToken;
  await user.save();

  // send refresh token as httpOnly cookie
  res.cookie("jwt", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

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

      // rotate tokens
      const newAccessToken = generateAccessToken(user._id);
      const newRefreshToken = generateRefreshToken(user._id);

      user.refreshToken = newRefreshToken;
      await user.save();

      res.cookie("jwt", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

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

  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: "strict",
  });

  res.sendStatus(204);
});

module.exports = {
  registerUser,
  loginUser,
  refreshTokenHandler,
  logoutUser,
};
