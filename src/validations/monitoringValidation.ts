// src/validations/monitoringValidation.ts
import Joi from "joi";

export const monitoringQueryValidation = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  type: Joi.string()
    .valid(
      "energy_threshold",
      "power_quality",
      "equipment_health",
      "compliance_check",
      "anomaly_detection"
    )
    .optional(),
});

export const createJobValidation = Joi.object({
  jobType: Joi.string()
    .valid(
      "analytics_processing",
      "maintenance_prediction",
      "compliance_analysis",
      "efficiency_analysis",
      "anomaly_detection"
    )
    .required(),
  buildingId: Joi.number().integer().positive().optional(),
  equipmentId: Joi.number().integer().positive().optional(),
  parameters: Joi.object().optional(),
});

export const recentDataQueryValidation = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional().default(10),
});
