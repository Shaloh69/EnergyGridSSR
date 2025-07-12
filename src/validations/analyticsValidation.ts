// src/validations/analyticsValidation.ts
import Joi from "joi";

export const analysisQueryValidation = Joi.object({
  building_id: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
    "any.required": "Building ID is required",
  }),
  equipment_id: Joi.string().optional().pattern(/^\d+$/).messages({
    "string.pattern.base": "Equipment ID must be a valid number",
  }),
  start_date: Joi.string().required().isoDate().messages({
    "any.required": "Start date is required",
    "string.isoDate": "Start date must be a valid ISO date",
  }),
  end_date: Joi.string().required().isoDate().messages({
    "any.required": "End date is required",
    "string.isoDate": "End date must be a valid ISO date",
  }),
  analysis_types: Joi.string().optional().default("energy,anomaly,efficiency"),
});

export const dashboardQueryValidation = Joi.object({
  building_id: Joi.string().optional().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
  }),
});

export const baselineQueryValidation = Joi.object({
  baseline_type: Joi.string()
    .valid("daily", "weekly", "monthly", "seasonal")
    .optional()
    .default("monthly"),
  lookback_days: Joi.string().pattern(/^\d+$/).optional().default("365"),
});

export const forecastQueryValidation = Joi.object({
  forecast_days: Joi.string().pattern(/^\d+$/).optional().default("30"),
  forecast_type: Joi.string()
    .valid("consumption", "demand", "cost")
    .optional()
    .default("consumption"),
});

export const powerQualityAnalysisValidation = Joi.object({
  voltageData: Joi.array().items(Joi.number()).required(),
  currentData: Joi.array().items(Joi.number()).optional(),
  frequencyData: Joi.array().items(Joi.number()).optional(),
});

export const anomalyDetectionValidation = Joi.object({
  building_id: Joi.number().required(),
  equipment_id: Joi.number().optional(),
  start_date: Joi.date().required(),
  end_date: Joi.date().required(),
  analysis_types: Joi.array()
    .items(Joi.string().valid("energy", "power_quality", "equipment"))
    .required(),
  parameters: Joi.object().optional(),
});

export const gapAnalysisValidation = Joi.object({
  target_standards: Joi.array()
    .items(Joi.string().valid("PEC2017", "OSHS", "ISO25010", "RA11285"))
    .optional()
    .default(["PEC2017", "OSHS", "RA11285"]),
});

export const equipmentIdParamsValidation = Joi.object({
  equipmentId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Equipment ID must be a valid number",
    "any.required": "Equipment ID is required",
  }),
});

export const powerQualityParamsValidation = Joi.object({
  buildingId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
    "any.required": "Building ID is required",
  }),
  pqReadingId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Power Quality Reading ID must be a valid number",
    "any.required": "Power Quality Reading ID is required",
  }),
});
