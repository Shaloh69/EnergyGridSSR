export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ] as const,
};

export const ERROR_MESSAGES = {
  INTERNAL_SERVER_ERROR: "Internal server error",
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "Access forbidden",
  NOT_FOUND: "Resource not found",
  VALIDATION_ERROR: "Validation error",
  DUPLICATE_ENTRY: "Duplicate entry detected",
  INVALID_CREDENTIALS: "Invalid credentials provided",
} as const;

export const SUCCESS_MESSAGES = {
  CREATED: "Resource created successfully",
  UPDATED: "Resource updated successfully",
  DELETED: "Resource deleted successfully",
  FETCHED: "Data fetched successfully",
  LOGIN_SUCCESS: "Login successful",
  LOGOUT_SUCCESS: "Logout successful",
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
  SORT_ORDER: "ASC",
} as const;

export const CACHE_KEYS = {
  USER_SESSION: "user:session:",
  BUILDING_DATA: "building:data:",
  ENERGY_STATS: "energy:stats:",
  COMPLIANCE_REPORT: "compliance:report:",
} as const;

export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

export const ENERGY_THRESHOLDS = {
  POWER_FACTOR_MIN: 0.85,
  POWER_FACTOR_GOOD: 0.95,
  VOLTAGE_MIN: 207, // -10% of 230V
  VOLTAGE_MAX: 253, // +10% of 230V
  THD_VOLTAGE_MAX: 8, // 8% max THD for voltage
  THD_CURRENT_MAX: 15, // 15% max THD for current
  FREQUENCY_MIN: 49.5,
  FREQUENCY_MAX: 50.5,
  VOLTAGE_UNBALANCE_MAX: 3, // 3% max voltage unbalance
  CURRENT_UNBALANCE_MAX: 10, // 10% max current unbalance
} as const;

export const COMPLIANCE_STANDARDS = {
  PEC2017: {
    NAME: "Philippine Electrical Code 2017",
    ILLUMINATION_MIN: 300, // lux for academic spaces
    GROUNDING_RESISTANCE_MAX: 25, // ohms
    CIRCUIT_LOADING_MAX: 0.8, // 80% of rated capacity
  },
  OSHS: {
    NAME: "Occupational Safety and Health Standards",
    EMERGENCY_LIGHTING_REQUIRED: true,
    PROTECTION_DEVICES_REQUIRED: true,
  },
  ISO25010: {
    NAME: "ISO/IEC 25010:2011 Software Quality",
    UPTIME_MIN: 99, // 99% minimum uptime
    RESPONSE_TIME_MAX: 2000, // 2 seconds max response time
  },
  RA11285: {
    NAME: "Energy Efficiency and Conservation Act",
    AUDIT_FREQUENCY_MONTHS: 12,
    ENERGY_MANAGER_REQUIRED: true,
  },
} as const;

export const SOCKET_EVENTS = {
  ENERGY_UPDATE: "energyUpdate",
  NEW_ENERGY_READING: "newEnergyReading",
  NEW_PQ_READING: "newPowerQualityReading",
  AUDIT_STATUS_CHANGED: "auditStatusChanged",
  NEW_AUDIT_ASSIGNED: "newAuditAssigned",
  COMPLIANCE_ALERT: "complianceAlert",
  EQUIPMENT_MAINTENANCE_DUE: "equipmentMaintenanceDue",
} as const;

export const EMAIL_TEMPLATES = {
  AUDIT_ASSIGNED: "audit_assigned",
  AUDIT_COMPLETED: "audit_completed",
  COMPLIANCE_ALERT: "compliance_alert",
  MAINTENANCE_REMINDER: "maintenance_reminder",
  ENERGY_ALERT: "energy_alert",
} as const;

export const REPORT_TYPES = {
  ENERGY_CONSUMPTION: "energy_consumption",
  POWER_QUALITY: "power_quality",
  AUDIT_SUMMARY: "audit_summary",
  COMPLIANCE: "compliance",
  CUSTOM: "custom",
} as const;

export const QR_CODE_CONFIG = {
  PREFIX: "UCLM",
  LENGTH: 16,
  INCLUDE_TIMESTAMP: true,
} as const;
