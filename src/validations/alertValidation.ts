// src/validations/alertValidation.ts
import Joi from "joi";

export const alertQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  building_id: Joi.string().pattern(/^\d+$/).optional(),
  equipment_id: Joi.string().pattern(/^\d+$/).optional(),
  type: Joi.string()
    .valid(
      "energy_anomaly",
      "power_quality",
      "equipment_failure",
      "compliance_violation",
      "maintenance_due",
      "efficiency_degradation",
      "threshold_exceeded"
    )
    .optional(),
  severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
  status: Joi.string()
    .valid("active", "acknowledged", "resolved", "escalated", "all")
    .optional()
    .default("active"),
  start_date: Joi.string().isoDate().optional(),
  end_date: Joi.string().isoDate().optional(),
});

export const createAlertValidation = Joi.object({
  type: Joi.string()
    .valid(
      "energy_anomaly",
      "power_quality",
      "equipment_failure",
      "compliance_violation",
      "maintenance_due",
      "efficiency_degradation",
      "threshold_exceeded"
    )
    .required(),
  severity: Joi.string().valid("low", "medium", "high", "critical").required(),
  title: Joi.string().min(5).max(200).required(),
  message: Joi.string().min(10).max(1000).required(),
  building_id: Joi.number().integer().optional(),
  equipment_id: Joi.number().integer().optional(),
  audit_id: Joi.number().integer().optional(),
  energy_reading_id: Joi.number().integer().optional(),
  pq_reading_id: Joi.number().integer().optional(),
  detected_value: Joi.number().optional(),
  threshold_value: Joi.number().optional(),
  metadata: Joi.object().optional(),
});

export const updateAlertValidation = Joi.object({
  status: Joi.string()
    .valid("active", "acknowledged", "resolved", "escalated")
    .optional(),
  escalation_level: Joi.number().integer().min(1).max(5).optional(),
  metadata: Joi.object().optional(),
  notification_sent: Joi.boolean().optional(),
});

export const resolveAlertValidation = Joi.object({
  resolution_notes: Joi.string().max(1000).optional(),
});

export const createThresholdValidation = Joi.object({
  building_id: Joi.number().integer().optional(),
  equipment_id: Joi.number().integer().optional(),
  parameter_name: Joi.string().required(),
  parameter_type: Joi.string()
    .valid("energy", "power_quality", "equipment")
    .required(),
  min_value: Joi.number().optional(),
  max_value: Joi.number().optional(),
  threshold_type: Joi.string()
    .valid("absolute", "percentage", "deviation")
    .required(),
  severity: Joi.string().valid("low", "medium", "high", "critical").required(),
  enabled: Joi.boolean().optional().default(true),
  escalation_minutes: Joi.number().integer().min(1).max(1440).optional(),
  notification_emails: Joi.array().items(Joi.string().email()).optional(),
  metadata: Joi.object().optional(),
});

export const thresholdQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  building_id: Joi.string().pattern(/^\d+$/).optional(),
  equipment_id: Joi.string().pattern(/^\d+$/).optional(),
  parameter_type: Joi.string()
    .valid("energy", "power_quality", "equipment")
    .optional(),
  enabled: Joi.string().valid("true", "false").optional(),
});

export const testMonitoringValidation = Joi.object({
  monitoring_type: Joi.string()
    .valid("energy", "power_quality", "equipment")
    .required(),
  test_data: Joi.object().required(),
  async_processing: Joi.boolean().optional().default(false),
});

export const alertStatisticsQueryValidation = Joi.object({
  building_id: Joi.string().pattern(/^\d+$/).optional(),
  days: Joi.string().pattern(/^\d+$/).optional().default("30"),
});
