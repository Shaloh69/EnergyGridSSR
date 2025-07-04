import Joi from "joi";
import { BuildingStatus } from "@/types/enums";

export const createBuildingValidation = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    "string.min": "Building name must be at least 2 characters long",
    "string.max": "Building name cannot exceed 100 characters",
    "any.required": "Building name is required",
  }),
  code: Joi.string().min(1).max(20).required().messages({
    "string.min": "Building code must be at least 1 character long",
    "string.max": "Building code cannot exceed 20 characters",
    "any.required": "Building code is required",
  }),
  area_sqm: Joi.number().positive().optional().messages({
    "number.positive": "Area must be a positive number",
  }),
  floors: Joi.number().integer().min(1).max(100).optional().messages({
    "number.integer": "Floors must be an integer",
    "number.min": "Building must have at least 1 floor",
    "number.max": "Floors cannot exceed 100",
  }),
  year_built: Joi.number()
    .integer()
    .min(1800)
    .max(new Date().getFullYear())
    .optional()
    .messages({
      "number.integer": "Year built must be an integer",
      "number.min": "Year built cannot be before 1800",
      "number.max": `Year built cannot be in the future`,
    }),
  building_type: Joi.string().max(50).optional(),
  description: Joi.string().max(1000).optional().messages({
    "string.max": "Description cannot exceed 1000 characters",
  }),
  status: Joi.string()
    .valid(...Object.values(BuildingStatus))
    .optional(),
});

export const updateBuildingValidation = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  code: Joi.string().min(1).max(20).optional(),
  area_sqm: Joi.number().positive().optional(),
  floors: Joi.number().integer().min(1).max(100).optional(),
  year_built: Joi.number()
    .integer()
    .min(1800)
    .max(new Date().getFullYear())
    .optional(),
  building_type: Joi.string().max(50).optional(),
  description: Joi.string().max(1000).optional(),
  status: Joi.string()
    .valid(...Object.values(BuildingStatus))
    .optional(),
});

export const getBuildingsValidation = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sortBy: Joi.string()
    .valid("name", "code", "area_sqm", "floors", "year_built", "created_at")
    .optional(),
  sortOrder: Joi.string().valid("ASC", "DESC").optional(),
  search: Joi.string().max(255).optional(),
  status: Joi.string()
    .valid(...Object.values(BuildingStatus))
    .optional(),
});

export const buildingParamsValidation = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    "number.integer": "Building ID must be an integer",
    "number.positive": "Building ID must be positive",
    "any.required": "Building ID is required",
  }),
});
