import { Request, Response, NextFunction } from "express";
import User from "../models/User.model";
import { verifyToken } from "../utils/token";
import { SessionUser } from "../types/auth.types";

/**
 * THE auth middleware (canonical JWT pattern, decision D3).
 * Verifies the short-lived Bearer access token, loads the user, and
 * attaches one consistent req.user shape. Every protected route uses
 * this; admin routes chain requireAdmin after it.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (!token) {
      res.status(401).json({ message: "Not authorized, no token" });
      return;
    }

    const userId = verifyToken(token, "access");
    if (!userId) {
      res.status(401).json({ message: "Not authorized, token failed" });
      return;
    }

    const user = await User.findById(userId).select("_id name email role");
    if (!user) {
      res.status(401).json({ message: "Not authorized, user not found" });
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

/**
 * Role gate. Assumes requireAuth already ran — the server-side security
 * boundary for the admin area (the frontend guard is only UX).
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: "Not authorized" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ message: "Admin access only" });
    return;
  }
  next();
};

/**
 * Accessor for handlers behind requireAuth: returns the attached
 * session user, or throws 401 if somehow absent (defense in depth).
 */
export const sessionUser = (req: Request): SessionUser => {
  if (!req.user) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
  return req.user;
};
