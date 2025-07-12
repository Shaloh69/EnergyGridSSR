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
  id: Joi.string().pattern(/^\d+$/).required().messages({
    "string.pattern.base": "Equipment ID must be a valid number",
    "any.required": "Equipment ID is required",
  }),
});

// Additional validations that were missing
export const qrCodeParamsValidation = Joi.object({
  qrCode: Joi.string().required().min(1).messages({
    "any.required": "QR Code is required",
    "string.empty": "QR Code cannot be empty",
  }),
});

export const buildingIdOptionalParamsValidation = Joi.object({
  buildingId: Joi.string().optional().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
  }),
});

export const maintenanceQueryValidation = Joi.object({
  upcoming: Joi.string().valid("true", "false").optional(),
  overdue: Joi.string().valid("true", "false").optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  page: Joi.number().integer().min(1).default(1),
});

// NEW VALIDATIONS - Missing from your current file

/**
 * Validation for logging maintenance activities
 */
export const maintenanceLogValidation = Joi.object({
  maintenance_type: Joi.string()
    .valid("preventive", "corrective", "emergency", "inspection")
    .required()
    .messages({
      "any.required": "Maintenance type is required",
      "any.only":
        "Maintenance type must be one of: preventive, corrective, emergency, inspection",
    }),
  description: Joi.string().trim().min(1).max(1000).required().messages({
    "any.required": "Description is required",
    "string.empty": "Description cannot be empty",
    "string.max": "Description cannot exceed 1000 characters",
  }),
  technician_id: Joi.number().integer().min(1).optional(),
  scheduled_date: Joi.date().iso().optional(),
  completed_date: Joi.date().iso().optional(),
  duration_minutes: Joi.number()
    .integer()
    .min(0)
    .max(86400)
    .optional()
    .messages({
      "number.max": "Duration cannot exceed 24 hours (1440 minutes)",
    }),
  downtime_minutes: Joi.number()
    .integer()
    .min(0)
    .max(86400)
    .optional()
    .messages({
      "number.max": "Downtime cannot exceed 24 hours (1440 minutes)",
    }),
  cost: Joi.number().min(0).max(999999.99).optional().messages({
    "number.max": "Cost cannot exceed 999,999.99",
  }),
  parts_used: Joi.array()
    .items(Joi.string().trim().min(1).max(255))
    .max(50)
    .optional()
    .messages({
      "array.max": "Cannot specify more than 50 parts",
    }),
  notes: Joi.string().trim().max(2000).allow("").optional(),
  status: Joi.string()
    .valid("scheduled", "in_progress", "completed", "cancelled")
    .default("scheduled")
    .optional(),
}).custom((value, helpers) => {
  // Custom validation: completed_date should be provided if status is completed
  if (value.status === "completed" && !value.completed_date) {
    return helpers.error("any.custom", {
      message: "completed_date is required when status is completed",
    });
  }

  // Custom validation: scheduled_date should not be in the past for new schedules
  if (value.status === "scheduled" && value.scheduled_date) {
    const scheduledDate = new Date(value.scheduled_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    if (scheduledDate < now) {
      return helpers.error("any.custom", {
        message: "scheduled_date cannot be in the past",
      });
    }
  }

  // Custom validation: completed_date should not be before scheduled_date
  if (value.scheduled_date && value.completed_date) {
    const scheduledDate = new Date(value.scheduled_date);
    const completedDate = new Date(value.completed_date);
    if (completedDate < scheduledDate) {
      return helpers.error("any.custom", {
        message: "completed_date cannot be before scheduled_date",
      });
    }
  }

  // Custom validation: downtime should not exceed duration
  if (value.duration_minutes && value.downtime_minutes) {
    if (value.downtime_minutes > value.duration_minutes) {
      return helpers.error("any.custom", {
        message: "downtime_minutes cannot exceed duration_minutes",
      });
    }
  }

  return value;
});

/**
 * Validation for performance analytics query parameters
 */
export const performanceQueryValidation = Joi.object({
  period: Joi.string()
    .valid("weekly", "monthly", "quarterly", "yearly")
    .default("monthly")
    .optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
}).custom((value, helpers) => {
  // Custom validation: if start_date is provided, end_date should also be provided
  if (
    (value.start_date && !value.end_date) ||
    (!value.start_date && value.end_date)
  ) {
    return helpers.error("any.custom", {
      message: "Both start_date and end_date must be provided together",
    });
  }

  // Custom validation: end_date should be after start_date
  if (value.start_date && value.end_date) {
    const startDate = new Date(value.start_date);
    const endDate = new Date(value.end_date);
    if (endDate <= startDate) {
      return helpers.error("any.custom", {
        message: "end_date must be after start_date",
      });
    }

    // Custom validation: date range should not exceed 2 years
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays > 730) {
      // 2 years
      return helpers.error("any.custom", {
        message: "Date range cannot exceed 2 years",
      });
    }
  }

  return value;
});

/**
 * Validation for maintenance history query parameters
 */
export const maintenanceHistoryQueryValidation = Joi.object({
  maintenance_type: Joi.string()
    .valid("preventive", "corrective", "emergency", "inspection")
    .optional(),
  status: Joi.string()
    .valid("scheduled", "in_progress", "completed", "cancelled")
    .optional(),
  technician_id: Joi.number().integer().min(1).optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  page: Joi.number().integer().min(1).default(1),
  sortBy: Joi.string()
    .valid(
      "created_at",
      "scheduled_date",
      "completed_date",
      "maintenance_type",
      "cost",
      "duration_minutes"
    )
    .default("created_at")
    .optional(),
  sortOrder: Joi.string().valid("ASC", "DESC").default("DESC").optional(),
}).custom((value, helpers) => {
  // Custom validation for date range
  if (value.start_date && value.end_date) {
    const startDate = new Date(value.start_date);
    const endDate = new Date(value.end_date);
    if (endDate <= startDate) {
      return helpers.error("any.custom", {
        message: "end_date must be after start_date",
      });
    }
  }

  return value;
});

/**
 * Validation for equipment QR code generation/update
 */
export const qrCodeGenerationValidation = Joi.object({
  format: Joi.string().valid("png", "svg", "pdf").default("png").optional(),
  size: Joi.number().integer().min(100).max(1000).default(200).optional(),
  include_text: Joi.boolean().default(true).optional(),
  include_logo: Joi.boolean().default(false).optional(),
});

/**
 * Validation for equipment status update
 */
export const equipmentStatusValidation = Joi.object({
  status: Joi.string()
    .valid(...Object.values(EquipmentStatus))
    .required()
    .messages({
      "any.required": "Status is required",
      "any.only": `Status must be one of: ${Object.values(EquipmentStatus).join(", ")}`,
    }),
  reason: Joi.string().trim().min(1).max(500).optional(),
  expected_resolution_date: Joi.date().iso().optional(),
  notes: Joi.string().trim().max(1000).allow("").optional(),
}).custom((value, helpers) => {
  // Require reason for certain status changes
  if (
    ["maintenance", "faulty", "inactive"].includes(value.status) &&
    !value.reason
  ) {
    return helpers.error("any.custom", {
      message: `Reason is required when setting status to ${value.status}`,
    });
  }

  return value;
});

/**
 * Validation for bulk equipment operations
 */
export const bulkEquipmentOperationValidation = Joi.object({
  equipment_ids: Joi.array()
    .items(Joi.number().integer().min(1))
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one equipment ID is required",
      "array.max": "Cannot process more than 100 equipment at once",
    }),
  operation: Joi.string()
    .valid(
      "update_status",
      "schedule_maintenance",
      "generate_qr_codes",
      "export_data"
    )
    .required()
    .messages({
      "any.required": "Operation type is required",
      "any.only":
        "Operation must be one of: update_status, schedule_maintenance, generate_qr_codes, export_data",
    }),
  parameters: Joi.object()
    .when("operation", {
      switch: [
        {
          is: "update_status",
          then: Joi.object({
            status: Joi.string()
              .valid(...Object.values(EquipmentStatus))
              .required(),
            reason: Joi.string().trim().max(500).optional(),
          }),
        },
        {
          is: "schedule_maintenance",
          then: Joi.object({
            maintenance_type: Joi.string()
              .valid("preventive", "corrective", "inspection")
              .required(),
            scheduled_date: Joi.date().iso().required(),
            description: Joi.string().trim().min(1).max(500).required(),
          }),
        },
        {
          is: "generate_qr_codes",
          then: qrCodeGenerationValidation,
        },
        {
          is: "export_data",
          then: Joi.object({
            format: Joi.string().valid("csv", "excel", "pdf").default("csv"),
            include_maintenance_history: Joi.boolean().default(false),
            include_performance_data: Joi.boolean().default(false),
          }),
        },
      ],
    })
    .required()
    .messages({
      "any.required": "Parameters are required for the selected operation",
    }),
});

// Export all validations for easy importing
export const equipmentValidations = {
  equipmentQuery: equipmentQueryValidation,
  createEquipment: createEquipmentValidation,
  updateEquipment: updateEquipmentValidation,
  equipmentParams: equipmentParamsValidation,
  qrCodeParams: qrCodeParamsValidation,
  buildingIdOptionalParams: buildingIdOptionalParamsValidation,
  maintenanceQuery: maintenanceQueryValidation,
  maintenanceLog: maintenanceLogValidation,
  performanceQuery: performanceQueryValidation,
  maintenanceHistoryQuery: maintenanceHistoryQueryValidation,
  qrCodeGeneration: qrCodeGenerationValidation,
  equipmentStatus: equipmentStatusValidation,
  bulkOperation: bulkEquipmentOperationValidation,
};
