import { BuildingStatus } from "@/types/enums";
import { DatabaseRow } from "@/types/common";

export interface IBuilding extends DatabaseRow {
  name: string;
  code: string;
  area_sqm?: number;
  floors?: number;
  year_built?: number;
  building_type?: string;
  description?: string;
  status: BuildingStatus;
  // Additional computed fields from joins
  equipment_count?: number;
  audit_count?: number;
  avg_compliance_score?: number;
  last_energy_reading?: Date;
  total_consumption_kwh?: number;
  avg_power_factor?: number;
}

export interface IBuildingCreate {
  name: string;
  code: string;
  area_sqm?: number;
  floors?: number;
  year_built?: number;
  building_type?: string;
  description?: string;
  status?: BuildingStatus;
}

export interface IBuildingUpdate {
  name?: string;
  code?: string;
  area_sqm?: number;
  floors?: number;
  year_built?: number;
  building_type?: string;
  description?: string;
  status?: BuildingStatus;
}

export interface IBuildingDetailed extends IBuilding {
  equipment?: any[];
  recent_audits?: any[];
  energy_consumption?: any[];
  power_quality_data?: any[];
}

export interface IBuildingStats {
  total_buildings: number;
  active_buildings: number;
  inactive_buildings: number;
  maintenance_buildings: number;
  total_area: number;
  average_compliance_score: number;
  buildings_with_issues: number;
}
