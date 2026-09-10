import { Request, Response, NextFunction } from "express";
import { HttpError } from "../types/http.types";

// The 4-argument signature is how Express recognizes an error handler —
// keep all four parameters even though `next` is unused.
const errorHandler = (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;

  // Mongo duplicate-key (unique index) — a client mistake, not a server
  // fault. Covers check-then-create races the pre-checks can't.
  if ((err as { code?: number }).code === 11000) {
    statusCode = 400;
    err.message = "A record with this value already exists";
  }

  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export default errorHandler;
