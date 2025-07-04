import Joi from "joi";
import {
  EquipmentType,
  EquipmentStatus,
  MaintenanceSchedule,
} from "@/types/enums";

export const createEquipmentValidation = Joi.object({
  building_id: Joi.number().integer().positive().required(),
  name: Joi.string().min(2).max(100).required(),
  equipment_type: Joi.string()
    .valid(...Object.values(EquipmentType))
    .required(),
  model: Joi.string().max(100).optional(),
  manufacturer: Joi.string().max(100).optional(),
  power_rating_kw: Joi.number().positive().optional(),
  voltage_rating: Joi.number().positive().optional(),
  installation_date: Joi.date().optional(),
  maintenance_schedule: Joi.string()
    .valid(...Object.values(MaintenanceSchedule))
    .optional(),
  status: Joi.string()
    .valid(...Object.values(EquipmentStatus))
    .optional(),
  location: Joi.string().max(255).optional(),
  qr_code: Joi.string().max(100).optional(),
  notes: Joi.string().max(1000).optional(),
});

export const updateEquipmentValidation = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  equipment_type: Joi.string()
    .valid(...Object.values(EquipmentType))
    .optional(),
  model: Joi.string().max(100).optional(),
  manufacturer: Joi.string().max(100).optional(),
  power_rating_kw: Joi.number().positive().optional(),
  voltage_rating: Joi.number().positive().optional(),
  installation_date: Joi.date().optional(),
  maintenance_schedule: Joi.string()
    .valid(...Object.values(MaintenanceSchedule))
    .optional(),
  status: Joi.string()
    .valid(...Object.values(EquipmentStatus))
    .optional(),
  location: Joi.string().max(255).optional(),
  notes: Joi.string().max(1000).optional(),
});

export const equipmentQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sortBy: Joi.string()
    .valid(
      "name",
      "equipment_type",
      "status",
      "installation_date",
      "created_at"
    )
    .optional(),
  sortOrder: Joi.string().valid("ASC", "DESC").optional(),
  buildingId: Joi.number().integer().positive().optional(),
  equipmentType: Joi.string()
    .valid(...Object.values(EquipmentType))
    .optional(),
  status: Joi.string()
    .valid(...Object.values(EquipmentStatus))
    .optional(),
  search: Joi.string().max(255).optional(),
});

export const equipmentParamsValidation = Joi.object({
  id: Joi.number().integer().positive().optional(),
  qrCode: Joi.string().max(100).optional(),
});
