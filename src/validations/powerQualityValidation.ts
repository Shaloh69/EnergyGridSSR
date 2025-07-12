import Joi from "joi";

export const createPowerQualityValidation = Joi.object({
  building_id: Joi.number().integer().positive().required(),
  voltage_l1: Joi.number().min(0).max(500).optional(),
  voltage_l2: Joi.number().min(0).max(500).optional(),
  voltage_l3: Joi.number().min(0).max(500).optional(),
  current_l1: Joi.number().min(0).optional(),
  current_l2: Joi.number().min(0).optional(),
  current_l3: Joi.number().min(0).optional(),
  thd_voltage: Joi.number().min(0).max(100).optional(),
  thd_current: Joi.number().min(0).max(100).optional(),
  frequency: Joi.number().min(45).max(65).optional(),
  power_factor: Joi.number().min(0).max(1).optional(),
  voltage_unbalance: Joi.number().min(0).max(100).optional(),
  current_unbalance: Joi.number().min(0).max(100).optional(),
  recorded_at: Joi.date().iso().required(),
});

export const powerQualityQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  sortBy: Joi.string()
    .valid(
      "recorded_at",
      "thd_voltage",
      "thd_current",
      "voltage_unbalance",
      "current_unbalance",
      "frequency",
      "power_factor",
      "created_at"
    )
    .optional()
    .default("recorded_at"),
  sortOrder: Joi.string().valid("ASC", "DESC").optional().default("DESC"),
  buildingId: Joi.string().pattern(/^\d+$/).optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
});

export const powerQualityParamsValidation = Joi.object({
  buildingId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
    "any.required": "Building ID is required",
  }),
});

// Additional validations that were missing
export const powerQualityEventsQueryValidation = Joi.object({
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  eventType: Joi.string()
    .valid(
      "Voltage Sag",
      "Voltage Swell",
      "Voltage Out of Range",
      "High Voltage THD",
      "High Current THD",
      "Frequency Deviation",
      "Low Power Factor",
      "Voltage Unbalance"
    )
    .optional(),
  severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
});

export const powerQualityTrendsQueryValidation = Joi.object({
  days: Joi.string().pattern(/^\d+$/).optional().default("30"),
});
