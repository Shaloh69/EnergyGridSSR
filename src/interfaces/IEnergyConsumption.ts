import { EnergyType } from "@/types/enums";
import { DatabaseRow } from "@/types/common";

export interface IEnergyConsumption extends DatabaseRow {
  building_id: number;
  consumption_kwh: number;
  cost_php?: number;
  recorded_at: Date;
  meter_reading?: number;
  demand_kw?: number;
  power_factor?: number;
  energy_type: EnergyType;
  created_by?: number;
}

export interface IEnergyConsumptionCreate {
  building_id: number;
  consumption_kwh: number;
  cost_php?: number;
  recorded_at: Date;
  meter_reading?: number;
  demand_kw?: number;
  power_factor?: number;
  energy_type?: EnergyType;
}

export interface IEnergyConsumptionUpdate {
  consumption_kwh?: number;
  cost_php?: number;
  recorded_at?: Date;
  meter_reading?: number;
  demand_kw?: number;
  power_factor?: number;
  energy_type?: EnergyType;
}

export interface IEnergyStats {
  total_consumption: number;
  average_consumption: number;
  peak_demand: number;
  total_cost: number;
  average_power_factor: number;
  efficiency_score: number;
}

export interface IEnergyTrend {
  date: string;
  consumption: number;
  cost: number;
  demand: number;
}
