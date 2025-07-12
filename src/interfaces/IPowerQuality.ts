import { DatabaseRow } from "@/types/common";

export interface IPowerQuality extends DatabaseRow {
  building_id: number;
  voltage_l1?: number;
  voltage_l2?: number;
  voltage_l3?: number;
  current_l1?: number;
  current_l2?: number;
  current_l3?: number;
  thd_voltage?: number;
  thd_current?: number;
  frequency?: number;
  power_factor?: number;
  voltage_unbalance?: number;
  current_unbalance?: number;
  recorded_at: Date;
  created_by?: number;
}

export interface IPowerQualityCreate {
  building_id: number;
  voltage_l1?: number;
  voltage_l2?: number;
  voltage_l3?: number;
  current_l1?: number;
  current_l2?: number;
  current_l3?: number;
  thd_voltage?: number;
  thd_current?: number;
  frequency?: number;
  power_factor?: number;
  voltage_unbalance?: number;
  current_unbalance?: number;
  recorded_at: Date;
}

export interface IPowerQualityStats {
  average_voltage: number;
  voltage_stability: number;
  average_thd_voltage: number;
  average_thd_current: number;
  average_frequency: number;
  power_factor_average: number;
  quality_score: number;
}
