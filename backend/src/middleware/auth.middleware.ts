import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import "../types/auth.types"; // loads the req.user augmentation

const protect = (req: Request, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
    return;
  }
  try {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error("Missing JWT_ACCESS_SECRET");

    const decoded = jwt.verify(token, secret);
    // jwt.verify returns `string | JwtPayload` — narrow before touching it.
    if (typeof decoded === "string" || !decoded.userId) {
      res.status(401).json({ message: "Not authorized, token failed" });
      return;
    }
    // Bearer auth attaches the user ID STRING (see auth.types.ts).
    req.user = String(decoded.userId);
    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

export = protect;
