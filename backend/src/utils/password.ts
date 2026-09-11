import bcrypt from "bcryptjs";
import { httpError } from "../types/http.types";

// THE password policy (Slice 14) — register, reset, and change all call
// this; there is exactly one definition of "acceptable password".
export const validatePassword = (password: unknown): string => {
  if (typeof password !== "string" || password.length < 8) {
    throw httpError("Password must be at least 8 characters", 400);
  }
  return password;
};

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
