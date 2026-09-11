import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Request, Response } from "express";
import User from "../models/User.model";
import asyncHandler from "../utils/asyncHandler";
import { generateAccessToken, generateRefreshToken, verifyToken } from "../utils/token";
import { httpError } from "../types/http.types";
import { sessionUser } from "../middleware/requireAuth";
import { validatePassword, hashPassword } from "../utils/password";
import {
  notifyPasswordReset,
  notifyPasswordChanged,
  notifyLogin,
} from "../mail/authEmails";

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

  validatePassword(password); // THE policy — shared with reset/change

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw httpError("User already exists", 409);
  }

  const hashedPassword = await hashPassword(password);

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

  // Takeovers should be visible (Slice 14) — fire-and-forget.
  notifyLogin(user.email, String(req.headers["user-agent"] ?? ""));

  res.json({ accessToken });
});

// ---------------------------------------------------------------
// Password reset (Slice 14). The threat model, in code: constant
// responses (no enumeration), only the token's SHA-256 at rest (a DB
// leak exposes nothing usable), single-use + 1h expiry, and global
// refresh revocation on success (stolen sessions die with the old
// password).
// ---------------------------------------------------------------
const hashToken = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

const FORGOT_RESPONSE = { message: "If that account exists, an email is on its way" };

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const email = String((req.body as { email?: unknown })?.email ?? "");
  const user = await User.findOne({ email });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetTokenHash = hashToken(rawToken);
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save();
    notifyPasswordReset(user.email, rawToken); // raw token: email only
  }

  // The SAME answer either way — an attacker learns nothing.
  res.json(FORGOT_RESPONSE);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: unknown; password?: unknown };
  validatePassword(password);

  // One named 400 for every bad-token shape — invalid and expired are
  // deliberately indistinguishable.
  const user = await User.findOne({
    resetTokenHash: hashToken(String(token ?? "")),
    resetTokenExpires: { $gt: new Date() },
  }).select("+resetTokenHash");
  if (!user) {
    throw httpError("Reset link is invalid or expired", 400);
  }

  user.password = await hashPassword(password as string);
  user.resetTokenHash = undefined; // single-use by construction
  user.resetTokenExpires = undefined;
  user.refreshToken = ""; // every session dies with the old password
  await user.save();

  notifyPasswordChanged(user.email);
  res.json({ message: "Password reset — you can sign in now" });
});

/**
 * @desc    Change password (prove the current one)
 * @route   PUT /api/auth/password (requireAuth)
 * Other sessions are revoked; THIS one continues on a fresh pair.
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: unknown;
    newPassword?: unknown;
  };
  validatePassword(newPassword);

  const session = sessionUser(req);
  const user = await User.findById(session._id);
  if (!user) throw httpError("Not authorized", 401);

  const isMatch = await bcrypt.compare(String(currentPassword ?? ""), user.password);
  if (!isMatch) throw httpError("Current password is incorrect", 400);

  user.password = await hashPassword(newPassword as string);

  // The login issuance path, reused: the caller gets a fresh pair (the
  // new refresh token REPLACES the stored one, so every other session's
  // cookie stops minting tokens).
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshToken = refreshToken;
  await user.save();
  setRefreshCookie(res, refreshToken);

  notifyPasswordChanged(user.email);
  res.json({ message: "Password changed", accessToken });
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
