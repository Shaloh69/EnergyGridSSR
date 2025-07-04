import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "@/interfaces/IResponse";
import { logger } from "@/utils/logger";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response<ErrorResponse>,
  next: NextFunction
): void => {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal Server Error";

  // Log error
  logger.error("Error occurred:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    user: req.user?.email,
  });

  // Handle specific error types
  if (error.message.includes("ER_DUP_ENTRY")) {
    statusCode = 409;
    message = "Duplicate entry detected";
  } else if (error.message.includes("ER_NO_REFERENCED_ROW")) {
    statusCode = 400;
    message = "Referenced resource not found";
  } else if (error.message.includes("ER_ROW_IS_REFERENCED")) {
    statusCode = 400;
    message = "Cannot delete resource: it is referenced by other records";
  }

  const response: ErrorResponse = {
    success: false,
    message,
    error:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : error.message,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV !== "production") {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

export const notFoundHandler = (
  req: Request,
  res: Response<ErrorResponse>,
  next: NextFunction
): void => {
  const error = new CustomError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
