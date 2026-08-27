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
