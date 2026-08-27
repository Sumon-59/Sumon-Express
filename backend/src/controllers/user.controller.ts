import { Request, Response } from "express";
import User from "../models/User.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user).select("-password");
  if (!user) {
    throw httpError("User not found", 404);
  }

  res.json(user);
});
