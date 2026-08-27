import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import User from "../models/User.model";
import { SessionUser } from "../types/auth.types";

/**
 * Cookie-based authentication middleware.
 * Expects refresh token in httpOnly cookie named "jwt".
 * Attaches req.user (a SessionUser) on success.
 */
export const protectCookie = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token: string | undefined = req.cookies?.jwt;

    if (!token) {
      res.status(401).json({ message: "Not authorized, no token" });
      return;
    }

    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      res.status(500).json({ message: "Auth error" });
      return;
    }

    let decoded: string | jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      res.status(401).json({ message: "Not authorized, invalid token" });
      return;
    }

    if (typeof decoded === "string") {
      res.status(401).json({ message: "Not authorized, invalid payload" });
      return;
    }

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      res.status(401).json({ message: "Not authorized, invalid payload" });
      return;
    }

    const user = await User.findById(userId).select("_id name email role refreshToken");
    if (!user || user.refreshToken !== token) {
      res.status(401).json({ message: "Not authorized, session revoked" });
      return;
    }

    const sessionUser: SessionUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    req.user = sessionUser;
    next();
  } catch (e) {
    res.status(500).json({ message: "Auth error" });
  }
};
