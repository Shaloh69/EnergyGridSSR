import Joi from "joi";

// Common parameter validations
export const idParamsValidation = Joi.object({
  id: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "ID must be a valid number",
    "any.required": "ID is required",
  }),
});

export const buildingIdParamsValidation = Joi.object({
  buildingId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
    "any.required": "Building ID is required",
  }),
});

export const auditIdParamsValidation = Joi.object({
  auditId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Audit ID must be a valid number",
    "any.required": "Audit ID is required",
  }),
});

// Simple date range validation (without interval) for most use cases
export const dateRangeValidation = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
}).custom((value, helpers) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    return helpers.error("any.invalid", {
      message: "Start date must be before end date",
    });
  }
  return value;
});

// Common pagination validation
export const paginationValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortOrder: Joi.string().valid("ASC", "DESC").default("DESC"),
});

// Common search validation
export const searchValidation = Joi.object({
  search: Joi.string().trim().min(1).max(255).optional(),
});
