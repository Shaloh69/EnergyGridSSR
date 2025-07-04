export enum UserRole {
  ADMIN = "admin",
  ENERGY_MANAGER = "energy_manager",
  FACILITY_ENGINEER = "facility_engineer",
  STAFF = "staff",
  STUDENT = "student",
}

export enum BuildingStatus {
  ACTIVE = "active",
  MAINTENANCE = "maintenance",
  INACTIVE = "inactive",
}

export enum EnergyType {
  TOTAL = "total",
  HVAC = "hvac",
  LIGHTING = "lighting",
  PLUGLOAD = "plugload",
  OTHERS = "others",
}

export enum EquipmentType {
  HVAC = "hvac",
  LIGHTING = "lighting",
  MOTOR = "motor",
  TRANSFORMER = "transformer",
  PANEL = "panel",
  UPS = "ups",
  GENERATOR = "generator",
  OTHERS = "others",
}

export enum EquipmentStatus {
  ACTIVE = "active",
  MAINTENANCE = "maintenance",
  FAULTY = "faulty",
  INACTIVE = "inactive",
}

export enum MaintenanceSchedule {
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  ANNUALLY = "annually",
}

export enum AuditType {
  ENERGY_EFFICIENCY = "energy_efficiency",
  POWER_QUALITY = "power_quality",
  SAFETY = "safety",
  COMPREHENSIVE = "comprehensive",
}

export enum AuditStatus {
  SCHEDULED = "scheduled",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum Priority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum StandardType {
  PEC2017 = "PEC2017",
  OSHS = "OSHS",
  ISO25010 = "ISO25010",
  RA11285 = "RA11285",
}

export enum ComplianceStatus {
  COMPLIANT = "compliant",
  NON_COMPLIANT = "non_compliant",
  NEEDS_REVIEW = "needs_review",
  NOT_APPLICABLE = "not_applicable",
}

export enum ReportType {
  ENERGY_CONSUMPTION = "energy_consumption",
  POWER_QUALITY = "power_quality",
  AUDIT_SUMMARY = "audit_summary",
  COMPLIANCE = "compliance",
  CUSTOM = "custom",
}

export enum ReportStatus {
  GENERATING = "generating",
  COMPLETED = "completed",
  FAILED = "failed",
}
