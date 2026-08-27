import { Request, Response } from "express";
import User from "../models/User.model";
import { sessionUser } from "../middleware/requireAuth";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(sessionUser(req)._id).select("-password -refreshToken");
  if (!user) {
    throw httpError("User not found", 404);
  }

  res.json(user);
});
