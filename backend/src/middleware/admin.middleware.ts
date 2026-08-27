import { Request, Response, NextFunction } from "express";
import User from "../models/User.model";
import "../types/auth.types";

const isAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Under Bearer auth req.user is the id string (see auth.types.ts);
    // Mongoose accepts it directly as a findById argument.
    const user = await User.findById(req.user);

    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    if (user.role !== "admin") {
      res.status(403).json({ message: "Admin access only" });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export = isAdmin;
