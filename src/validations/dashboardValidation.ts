// src/validations/dashboardValidation.ts
import Joi from "joi";

export const alertsQueryValidation = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional().default(20),
  severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
  building_id: Joi.string().pattern(/^\d+$/).optional(),
});
