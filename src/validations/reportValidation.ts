// src/validations/reportValidation.ts
import Joi from "joi";

export const reportsQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  sortBy: Joi.string()
    .valid(
      "created_at",
      "updated_at",
      "title",
      "report_type",
      "status",
      "file_size"
    )
    .optional()
    .default("created_at"),
  sortOrder: Joi.string().valid("ASC", "DESC").optional().default("DESC"),
  report_type: Joi.string()
    .valid(
      "energy_consumption",
      "power_quality",
      "audit_summary",
      "compliance",
      "monitoring"
    )
    .optional(),
  building_id: Joi.string().pattern(/^\d+$/).optional(),
  audit_id: Joi.string().pattern(/^\d+$/).optional(),
  status: Joi.string().valid("generating", "completed", "failed").optional(),
  generated_by: Joi.string().pattern(/^\d+$/).optional(),
  search: Joi.string().max(100).optional(),
});

export const generateEnergyReportValidation = Joi.object({
  buildingId: Joi.number().integer().optional(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  title: Joi.string().min(3).max(200).required(),
  includeComparison: Joi.boolean().optional().default(false),
  includeTrends: Joi.boolean().optional().default(true),
});

export const generatePowerQualityReportValidation = Joi.object({
  buildingId: Joi.number().integer().required(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  title: Joi.string().min(3).max(200).required(),
  includeEvents: Joi.boolean().optional().default(true),
  includeCompliance: Joi.boolean().optional().default(true),
});

export const generateAuditReportValidation = Joi.object({
  auditId: Joi.number().integer().required(),
  title: Joi.string().min(3).max(200).required(),
  includeCompliance: Joi.boolean().optional().default(true),
  includeRecommendations: Joi.boolean().optional().default(true),
});

export const generateComplianceReportValidation = Joi.object({
  auditId: Joi.number().integer().required(),
  title: Joi.string().min(3).max(200).required(),
  standards: Joi.array()
    .items(Joi.string().valid("PEC2017", "OSHS", "ISO25010", "RA11285"))
    .optional(),
  includeGapAnalysis: Joi.boolean().optional().default(true),
});

export const generateMonitoringReportValidation = Joi.object({
  buildingId: Joi.number().integer().optional(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  title: Joi.string().min(3).max(200).required(),
  reportTypes: Joi.array()
    .items(
      Joi.string().valid(
        "alerts",
        "anomalies",
        "efficiency",
        "maintenance",
        "power_quality"
      )
    )
    .min(1)
    .required(),
});
