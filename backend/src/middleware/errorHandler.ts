import { Request, Response, NextFunction } from "express";
import { logger } from "../infrastructure/logger/logger";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error with full details
  logger.error("Unhandled error in request", {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Determine status code based on error type
  let statusCode = 500;
  let errorMessage = "Internal server error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    errorMessage = err.message;
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    errorMessage = "Unauthorized";
  } else if (err.name === "NotFoundError") {
    statusCode = 404;
    errorMessage = "Not found";
  } else if (err.message) {
    errorMessage = err.message;
  }

  res.status(statusCode).json({
    success: false,
    error: errorMessage,
  });
}
