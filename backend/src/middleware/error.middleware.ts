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
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export = errorHandler;
