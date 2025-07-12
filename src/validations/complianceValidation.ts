// src/validations/complianceValidation.ts
import Joi from "joi";

export const complianceQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  audit_id: Joi.string().pattern(/^\d+$/).optional(),
  standard_type: Joi.string()
    .valid("PEC2017", "OSHS", "ISO25010", "RA11285")
    .optional(),
  status: Joi.string()
    .valid("compliant", "non_compliant", "needs_review", "not_applicable")
    .optional(),
  severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
  search: Joi.string().max(100).optional(),
});

export const complianceTrendsQueryValidation = Joi.object({
  days: Joi.string().pattern(/^\d+$/).optional().default("90"),
});

export const performComplianceCheckValidation = Joi.object({
  auditId: Joi.number().integer().required(),
  standardType: Joi.string()
    .valid("PEC2017", "OSHS", "ISO25010", "RA11285")
    .required(),
  checkData: Joi.object().required(),
});

export const createComplianceCheckValidation = Joi.object({
  audit_id: Joi.number().integer().required(),
  standard_type: Joi.string()
    .valid("PEC2017", "OSHS", "ISO25010", "RA11285")
    .required(),
  section_code: Joi.string().required(),
  check_description: Joi.string().required(),
  status: Joi.string()
    .valid("compliant", "non_compliant", "needs_review", "not_applicable")
    .required(),
  severity: Joi.string().valid("low", "medium", "high", "critical").required(),
  details: Joi.string().optional(),
  corrective_action: Joi.string().optional(),
  due_date: Joi.date().optional(),
  responsible_person: Joi.string().optional(),
});

export const updateComplianceCheckValidation = Joi.object({
  standard_type: Joi.string()
    .valid("PEC2017", "OSHS", "ISO25010", "RA11285")
    .optional(),
  section_code: Joi.string().optional(),
  check_description: Joi.string().optional(),
  status: Joi.string()
    .valid("compliant", "non_compliant", "needs_review", "not_applicable")
    .optional(),
  severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
  details: Joi.string().optional(),
  corrective_action: Joi.string().optional(),
  due_date: Joi.date().optional(),
  responsible_person: Joi.string().optional(),
});
