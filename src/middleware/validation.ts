import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { ApiResponse } from "@/interfaces/IResponse";

export const validateBody = (schema: Joi.ObjectSchema) => {
  return (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    });

    if (error) {
      const errors: Record<string, string[]> = {};

      error.details.forEach((detail) => {
        const key = detail.path.join(".");
        if (!errors[key]) {
          errors[key] = [];
        }
        errors[key].push(detail.message);
      });

      res.status(400).json({
        success: false,
        message: "Validation failed",
        error: "Invalid input data",
        errors,
      });
      return;
    }

    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    });

    if (error) {
      const errors: Record<string, string[]> = {};

      error.details.forEach((detail) => {
        const key = detail.path.join(".");
        if (!errors[key]) {
          errors[key] = [];
        }
        errors[key].push(detail.message);
      });

      res.status(400).json({
        success: false,
        message: "Query validation failed",
        error: "Invalid query parameters",
        errors,
      });
      return;
    }

    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: "Parameter validation failed",
        error: error.details[0].message,
      });
      return;
    }

    req.params = value;
    next();
  };
};
