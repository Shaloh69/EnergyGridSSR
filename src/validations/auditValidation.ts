import Joi from "joi";
import { AuditType, AuditStatus, Priority } from "@/types/enums";

export const createAuditValidation = Joi.object({
  building_id: Joi.number().integer().positive().required(),
  auditor_id: Joi.number().integer().positive().required(),
  audit_type: Joi.string()
    .valid(...Object.values(AuditType))
    .required(),
  title: Joi.string().min(5).max(255).required(),
  description: Joi.string().max(1000).optional(),
  priority: Joi.string()
    .valid(...Object.values(Priority))
    .optional(),
  scheduled_date: Joi.date().min("now").optional(),
});

export const updateAuditValidation = Joi.object({
  title: Joi.string().min(5).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  status: Joi.string()
    .valid(...Object.values(AuditStatus))
    .optional(),
  priority: Joi.string()
    .valid(...Object.values(Priority))
    .optional(),
  scheduled_date: Joi.date().optional(),
  started_date: Joi.date().optional(),
  completed_date: Joi.date().optional(),
  findings: Joi.string().max(2000).optional(),
  recommendations: Joi.string().max(2000).optional(),
  compliance_score: Joi.number().integer().min(0).max(100).optional(),
});

export const auditQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sortBy: Joi.string()
    .valid(
      "scheduled_date",
      "created_at",
      "status",
      "priority",
      "compliance_score"
    )
    .optional(),
  sortOrder: Joi.string().valid("ASC", "DESC").optional(),
  buildingId: Joi.number().integer().positive().optional(),
  auditType: Joi.string()
    .valid(...Object.values(AuditType))
    .optional(),
  status: Joi.string()
    .valid(...Object.values(AuditStatus))
    .optional(),
  auditorId: Joi.number().integer().positive().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  search: Joi.string().max(255).optional(),
});

export const auditParamsValidation = Joi.object({
  id: Joi.number().integer().positive().required(),
});
