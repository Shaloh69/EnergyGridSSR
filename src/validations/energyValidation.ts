// src/validations/energyValidation.ts
import Joi from "joi";

export const createEnergyReadingValidation = Joi.object({
  building_id: Joi.number().integer().required(),
  consumption_kwh: Joi.number().positive().required(),
  cost_php: Joi.number().positive().optional(),
  recorded_at: Joi.date().required(),
  meter_reading: Joi.number().positive().optional(),
  demand_kw: Joi.number().positive().optional(),
  power_factor: Joi.number().min(0).max(1).optional(),
  energy_type: Joi.string()
    .valid("total", "hvac", "lighting", "plugload", "others")
    .optional()
    .default("total"),
});

export const updateEnergyReadingValidation = Joi.object({
  consumption_kwh: Joi.number().positive().optional(),
  cost_php: Joi.number().positive().optional(),
  recorded_at: Joi.date().optional(),
  meter_reading: Joi.number().positive().optional(),
  demand_kw: Joi.number().positive().optional(),
  power_factor: Joi.number().min(0).max(1).optional(),
  energy_type: Joi.string()
    .valid("total", "hvac", "lighting", "plugload", "others")
    .optional(),
});

export const energyQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  sortBy: Joi.string()
    .valid("recorded_at", "consumption_kwh", "demand_kw", "cost_php")
    .optional()
    .default("recorded_at"),
  sortOrder: Joi.string().valid("ASC", "DESC").optional().default("DESC"),
  buildingId: Joi.string().pattern(/^\d+$/).optional(),
  energyType: Joi.string()
    .valid("total", "hvac", "lighting", "plugload", "others")
    .optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
});

export const dateRangeValidation = Joi.object({
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  interval: Joi.string()
    .valid("hourly", "daily", "weekly", "monthly")
    .optional()
    .default("daily"),
});

// src/validations/powerQualityValidation.ts
export const createPowerQualityValidation = Joi.object({
  building_id: Joi.number().integer().required(),
  voltage_l1: Joi.number().positive().optional(),
  voltage_l2: Joi.number().positive().optional(),
  voltage_l3: Joi.number().positive().optional(),
  current_l1: Joi.number().positive().optional(),
  current_l2: Joi.number().positive().optional(),
  current_l3: Joi.number().positive().optional(),
  thd_voltage: Joi.number().min(0).max(100).optional(),
  thd_current: Joi.number().min(0).max(100).optional(),
  frequency: Joi.number().min(40).max(60).optional(),
  power_factor: Joi.number().min(0).max(1).optional(),
  voltage_unbalance: Joi.number().min(0).max(100).optional(),
  current_unbalance: Joi.number().min(0).max(100).optional(),
  recorded_at: Joi.date().required(),
});

export const powerQualityQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  sortBy: Joi.string()
    .valid("recorded_at", "thd_voltage", "thd_current", "frequency")
    .optional()
    .default("recorded_at"),
  sortOrder: Joi.string().valid("ASC", "DESC").optional().default("DESC"),
  buildingId: Joi.string().pattern(/^\d+$/).optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
});

// src/validations/equipmentValidation.ts
export const createEquipmentValidation = Joi.object({
  building_id: Joi.number().integer().required(),
  name: Joi.string().min(2).max(100).required(),
  equipment_type: Joi.string()
    .valid(
      "hvac",
      "lighting",
      "motor",
      "transformer",
      "panel",
      "ups",
      "generator",
      "others"
    )
    .required(),
  model: Joi.string().max(100).optional(),
  manufacturer: Joi.string().max(100).optional(),
  power_rating_kw: Joi.number().positive().optional(),
  voltage_rating: Joi.number().positive().optional(),
  installation_date: Joi.date().optional(),
  maintenance_schedule: Joi.string()
    .valid("weekly", "monthly", "quarterly", "annually")
    .optional()
    .default("monthly"),
  status: Joi.string()
    .valid("active", "maintenance", "faulty", "inactive")
    .optional()
    .default("active"),
  location: Joi.string().max(200).optional(),
  qr_code: Joi.string().max(50).optional(),
  notes: Joi.string().max(1000).optional(),
});

export const updateEquipmentValidation = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  equipment_type: Joi.string()
    .valid(
      "hvac",
      "lighting",
      "motor",
      "transformer",
      "panel",
      "ups",
      "generator",
      "others"
    )
    .optional(),
  model: Joi.string().max(100).optional(),
  manufacturer: Joi.string().max(100).optional(),
  power_rating_kw: Joi.number().positive().optional(),
  voltage_rating: Joi.number().positive().optional(),
  installation_date: Joi.date().optional(),
  maintenance_schedule: Joi.string()
    .valid("weekly", "monthly", "quarterly", "annually")
    .optional(),
  status: Joi.string()
    .valid("active", "maintenance", "faulty", "inactive")
    .optional(),
  location: Joi.string().max(200).optional(),
  notes: Joi.string().max(1000).optional(),
});

export const equipmentQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  sortBy: Joi.string()
    .valid("name", "equipment_type", "status", "installation_date")
    .optional()
    .default("name"),
  sortOrder: Joi.string().valid("ASC", "DESC").optional().default("ASC"),
  buildingId: Joi.string().pattern(/^\d+$/).optional(),
  equipmentType: Joi.string()
    .valid(
      "hvac",
      "lighting",
      "motor",
      "transformer",
      "panel",
      "ups",
      "generator",
      "others"
    )
    .optional(),
  status: Joi.string()
    .valid("active", "maintenance", "faulty", "inactive")
    .optional(),
  search: Joi.string().max(100).optional(),
});

// src/validations/auditValidation.ts
export const createAuditValidation = Joi.object({
  building_id: Joi.number().integer().required(),
  auditor_id: Joi.number().integer().required(),
  audit_type: Joi.string()
    .valid("energy_efficiency", "power_quality", "safety", "comprehensive")
    .required(),
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().max(1000).optional(),
  priority: Joi.string()
    .valid("low", "medium", "high", "critical")
    .optional()
    .default("medium"),
  scheduled_date: Joi.date().optional(),
});

export const updateAuditValidation = Joi.object({
  title: Joi.string().min(5).max(200).optional(),
  description: Joi.string().max(1000).optional(),
  status: Joi.string()
    .valid("scheduled", "in_progress", "completed", "cancelled")
    .optional(),
  priority: Joi.string().valid("low", "medium", "high", "critical").optional(),
  scheduled_date: Joi.date().optional(),
  started_date: Joi.date().optional(),
  completed_date: Joi.date().optional(),
  findings: Joi.string().max(5000).optional(),
  recommendations: Joi.string().max(5000).optional(),
  compliance_score: Joi.number().min(0).max(100).optional(),
});

export const auditQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  sortBy: Joi.string()
    .valid("scheduled_date", "status", "priority", "created_at")
    .optional()
    .default("scheduled_date"),
  sortOrder: Joi.string().valid("ASC", "DESC").optional().default("DESC"),
  buildingId: Joi.string().pattern(/^\d+$/).optional(),
  auditType: Joi.string()
    .valid("energy_efficiency", "power_quality", "safety", "comprehensive")
    .optional(),
  status: Joi.string()
    .valid("scheduled", "in_progress", "completed", "cancelled")
    .optional(),
  auditorId: Joi.string().pattern(/^\d+$/).optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  search: Joi.string().max(100).optional(),
});

// src/validations/buildingValidation.ts
export const createBuildingValidation = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(20).required(),
  area_sqm: Joi.number().positive().optional(),
  floors: Joi.number().integer().min(1).optional(),
  year_built: Joi.number()
    .integer()
    .min(1900)
    .max(new Date().getFullYear())
    .optional(),
  building_type: Joi.string().max(50).optional(),
  description: Joi.string().max(1000).optional(),
  status: Joi.string()
    .valid("active", "maintenance", "inactive")
    .optional()
    .default("active"),
});

export const updateBuildingValidation = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  code: Joi.string().min(2).max(20).optional(),
  area_sqm: Joi.number().positive().optional(),
  floors: Joi.number().integer().min(1).optional(),
  year_built: Joi.number()
    .integer()
    .min(1900)
    .max(new Date().getFullYear())
    .optional(),
  building_type: Joi.string().max(50).optional(),
  description: Joi.string().max(1000).optional(),
  status: Joi.string().valid("active", "maintenance", "inactive").optional(),
});

export const getBuildingsValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  sortBy: Joi.string()
    .valid("name", "code", "status", "created_at")
    .optional()
    .default("name"),
  sortOrder: Joi.string().valid("ASC", "DESC").optional().default("ASC"),
  search: Joi.string().max(100).optional(),
  status: Joi.string().valid("active", "maintenance", "inactive").optional(),
});

// src/validations/authValidation.ts
export const loginValidation = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const registerValidation = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  first_name: Joi.string().min(2).max(50).required(),
  last_name: Joi.string().min(2).max(50).required(),
  role: Joi.string()
    .valid("admin", "energy_manager", "facility_engineer", "staff", "student")
    .required(),
  department: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional(),
});

export const refreshTokenValidation = Joi.object({
  refreshToken: Joi.string().required(),
});

// src/validations/commonValidations.ts
export const idParamsValidation = Joi.object({
  id: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "ID must be a valid number",
    "any.required": "ID is required",
  }),
});

export const buildingIdParamsValidation = Joi.object({
  buildingId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
    "any.required": "Building ID is required",
  }),
});
