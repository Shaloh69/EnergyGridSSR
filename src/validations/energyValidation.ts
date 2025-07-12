// src/validations/energyValidation.ts
import Joi from "joi";

export const createEnergyReadingValidation = Joi.object({
  building_id: Joi.number().integer().required(),
  consumption_kwh: Joi.number().min(0).required(),
  cost_php: Joi.number().min(0).optional(),
  recorded_at: Joi.date().required(),
  meter_reading: Joi.number().min(0).optional(),
  demand_kw: Joi.number().min(0).optional(),
  power_factor: Joi.number().min(0).max(1).optional(),
  energy_type: Joi.string()
    .valid("electrical", "solar", "generator", "others")
    .optional()
    .default("electrical"),
});

export const updateEnergyReadingValidation = Joi.object({
  consumption_kwh: Joi.number().min(0).optional(),
  cost_php: Joi.number().min(0).optional(),
  recorded_at: Joi.date().optional(),
  meter_reading: Joi.number().min(0).optional(),
  demand_kw: Joi.number().min(0).optional(),
  power_factor: Joi.number().min(0).max(1).optional(),
  energy_type: Joi.string()
    .valid("electrical", "solar", "generator", "others")
    .optional(),
});

export const energyQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  sortBy: Joi.string()
    .valid(
      "recorded_at",
      "consumption_kwh",
      "cost_php",
      "demand_kw",
      "power_factor",
      "energy_type",
      "created_at"
    )
    .optional()
    .default("recorded_at"),
  sortOrder: Joi.string().valid("ASC", "DESC").optional().default("DESC"),
  buildingId: Joi.string().pattern(/^\d+$/).optional(),
  energyType: Joi.string()
    .valid("electrical", "solar", "generator", "others")
    .optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
});

export const dateRangeValidation = Joi.object({
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
});

export const energyTrendsQueryValidation = Joi.object({
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  interval: Joi.string()
    .valid("hourly", "daily", "weekly", "monthly")
    .optional()
    .default("daily"),
});
