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
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sortBy: Joi.string()
    .valid(
      "recorded_at",
      "voltage_l1",
      "thd_voltage",
      "frequency",
      "power_factor"
    )
    .optional(),
  sortOrder: Joi.string().valid("ASC", "DESC").optional(),
  buildingId: Joi.number().integer().positive().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

export const powerQualityParamsValidation = Joi.object({
  buildingId: Joi.number().integer().positive().required(),
});
