import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import User from "../models/User.model";
import asyncHandler from "../utils/asyncHandler";
import { generateAccessToken, generateRefreshToken, verifyToken } from "../utils/token";
import { httpError } from "../types/http.types";
import { sessionUser } from "../middleware/requireAuth";

interface RegisterBody {
  name?: string;
  email?: string;
  password?: string;
}

interface LoginBody {
  email?: string;
  password?: string;
}

/**
 * Helper to set refresh token cookie in a dev/prod safe way.
 * - Dev (localhost): secure=false, sameSite=lax
 * - Prod (https):     secure=true, sameSite=none
 */
const setRefreshCookie = (res: Response, refreshToken: string): void => {
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
export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body as RegisterBody;

  if (!name || !email || !password) {
    throw httpError("All fields are required", 400);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw httpError("User already exists", 409);
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
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginBody;

  const user = await User.findOne({ email });
  if (!user) {
    throw httpError("Invalid credentials", 401);
  }

  const isMatch = await bcrypt.compare(password ?? "", user.password);
  if (!isMatch) {
    throw httpError("Invalid credentials", 401);
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
export const refreshTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken: string | undefined = req.cookies?.jwt;

  if (!refreshToken) {
    throw httpError("Unauthorized", 401);
  }

  const user = await User.findOne({ refreshToken });
  if (!user) {
    throw httpError("Forbidden", 403);
  }

  const tokenUserId = verifyToken(refreshToken, "refresh");
  if (!tokenUserId || user._id.toString() !== tokenUserId) {
    throw httpError("Forbidden", 403);
  }

  // Rotate tokens
  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshToken = newRefreshToken;
  await user.save();

  // Set rotated refresh cookie
  setRefreshCookie(res, newRefreshToken);

  res.json({ accessToken: newAccessToken });
});

/**
 * @desc    Logout user (revoke refresh token)
 * @route   POST /api/auth/logout
 * @access  Public (cookie based)
 */
export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken: string | undefined = req.cookies?.jwt;

  if (!refreshToken) {
    res.sendStatus(204); // No content
    return;
  }

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

/**
 * @desc    Current session user
 * @route   GET /api/auth/me (behind requireAuth — Bearer access token)
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
  // requireAuth verified the access token and attached the user.
  res.status(200).json({ user: sessionUser(req) });
});
