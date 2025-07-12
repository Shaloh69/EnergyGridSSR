import {
  EquipmentType,
  EquipmentStatus,
  MaintenanceSchedule,
} from "@/types/enums";
import { DatabaseRow } from "@/types/common";

export interface IEquipment extends DatabaseRow {
  building_id: number;
  name: string;
  equipment_type: EquipmentType;
  model?: string;
  manufacturer?: string;
  power_rating_kw?: number;
  voltage_rating?: number;
  installation_date?: Date;
  maintenance_schedule: MaintenanceSchedule;
  status: EquipmentStatus;
  location?: string;
  qr_code?: string;
  notes?: string;
}

// Extended interface for equipment with additional computed fields
export interface IEquipmentDetailed extends IEquipment {
  building_name?: string;
  building_code?: string;
  building_type?: string;
  age_years?: number;
  maintenance_interval_days?: number;
  next_maintenance_date?: Date;
  last_maintenance_date?: Date;
  predicted_maintenance_date?: Date;
  maintenance_risk_level?: string;
  active_alerts?: number; // Fixed: Added missing property
  health_status?: "excellent" | "good" | "fair" | "poor" | "critical";
  maintenance_urgency?: number;
  maintenance_status?: string;
  scheduled_maintenance_date?: Date;
  scheduled_maintenance_status?: string;
  maintenance_history?: any[];
  maintenance_predictions?: any[];
  related_alerts?: any[];
  performance_metrics?: any;
}

export interface IEquipmentCreate {
  building_id: number;
  name: string;
  equipment_type: EquipmentType;
  model?: string;
  manufacturer?: string;
  power_rating_kw?: number;
  voltage_rating?: number;
  installation_date?: Date;
  maintenance_schedule?: MaintenanceSchedule;
  status?: EquipmentStatus;
  location?: string;
  qr_code?: string;
  notes?: string;
}

export interface IEquipmentUpdate {
  name?: string;
  equipment_type?: EquipmentType;
  model?: string;
  manufacturer?: string;
  power_rating_kw?: number;
  voltage_rating?: number;
  installation_date?: Date;
  maintenance_schedule?: MaintenanceSchedule;
  status?: EquipmentStatus;
  location?: string;
  notes?: string;
}
