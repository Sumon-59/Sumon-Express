import { Request, Response, NextFunction, RequestHandler } from "express";

// The function we wrap: an Express handler that returns a Promise.
type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

// asyncHandler takes an async handler and returns a normal Express
// RequestHandler that forwards any rejection to the error middleware.
const asyncHandler =
  (fn: AsyncRouteHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default asyncHandler;
