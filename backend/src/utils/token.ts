import jwt from "jsonwebtoken";
import { Types } from "mongoose";

// Strict mode forces us to face a truth the old JS hid: process.env
// values are `string | undefined`. Instead of silencing that, we check
// once and fail with a clear message if the secret is missing.
const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

// A user id may arrive as an ObjectId (from a document) or a string.
type UserId = Types.ObjectId | string;

export type TokenKind = "access" | "refresh";

const SECRET_ENV: Record<TokenKind, string> = {
  access: "JWT_ACCESS_SECRET",
  refresh: "JWT_REFRESH_SECRET",
};

/**
 * The ONE place a token gets verified (replaces four hand-rolled sites).
 * Returns the userId the token carries, or null for anything invalid:
 * bad signature, expired, string payload, missing/odd userId.
 */
export const verifyToken = (token: string, kind: TokenKind): string | null => {
  try {
    const decoded = jwt.verify(token, requireEnv(SECRET_ENV[kind]));
    if (typeof decoded === "string") return null;
    return typeof decoded.userId === "string" ? decoded.userId : null;
  } catch {
    return null;
  }
};

/**
 * Generate short-lived access token
 */
export const generateAccessToken = (userId: UserId): string => {
  return jwt.sign({ userId: userId.toString() }, requireEnv("JWT_ACCESS_SECRET"), {
    expiresIn: "15m",
  });
};

/**
 * Generate long-lived refresh token
 */
export const generateRefreshToken = (userId: UserId): string => {
  return jwt.sign({ userId: userId.toString() }, requireEnv("JWT_REFRESH_SECRET"), {
    expiresIn: "7d",
  });
};
