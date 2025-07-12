import { DatabaseRow } from "@/types/common";

export interface IEnergyBaseline extends DatabaseRow {
  building_id: number;
  baseline_type: "daily" | "weekly" | "monthly" | "seasonal";
  period_start: Date;
  period_end: Date;
  baseline_consumption: number;
  confidence_interval: number;
  weather_normalized: boolean;
  occupancy_adjusted: boolean;
  calculation_method: "average" | "regression" | "machine_learning";
  metadata?: Record<string, any>;
}

export interface IPowerQualityEvent extends DatabaseRow {
  building_id: number;
  pq_reading_id: number;
  event_type:
    | "sag"
    | "swell"
    | "interruption"
    | "transient"
    | "harmonic"
    | "flicker"
    | "unbalance";
  severity: "minor" | "moderate" | "severe" | "critical";
  start_time: Date;
  end_time?: Date;
  duration_ms?: number;
  magnitude?: number;
  itic_curve_violation: boolean;
  ieee519_violation: boolean;
  affected_equipment?: string[];
  estimated_cost?: number;
  metadata?: Record<string, any>;
}

export interface IMaintenancePrediction extends DatabaseRow {
  equipment_id: number;
  prediction_type: "failure" | "maintenance" | "replacement";
  predicted_date: Date;
  confidence_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  contributing_factors: string[];
  recommended_actions: string[];
  estimated_cost?: number;
  business_impact?: string;
  model_version: string;
  last_calculated: Date;
  metadata?: Record<string, any>;
}

export interface IAnomalyDetection extends DatabaseRow {
  detection_type: "energy" | "power_quality" | "equipment";
  building_id?: number;
  equipment_id?: number;
  detected_at: Date;
  anomaly_score: number;
  threshold_score: number;
  data_point_id: number;
  data_point_type: "energy_consumption" | "power_quality" | "equipment_reading";
  anomaly_description: string;
  expected_value?: number;
  actual_value?: number;
  deviation_percentage?: number;
  investigation_status:
    | "pending"
    | "investigating"
    | "resolved"
    | "false_positive";
  root_cause?: string;
  corrective_action?: string;
  metadata?: Record<string, any>;
}

export interface IEfficiencyAnalysis extends DatabaseRow {
  building_id: number;
  analysis_period_start: Date;
  analysis_period_end: Date;
  efficiency_score: number;
  baseline_consumption: number;
  actual_consumption: number;
  savings_kwh: number;
  savings_percentage: number;
  cost_savings: number;
  carbon_reduction_kg: number;
  efficiency_factors: Record<string, number>;
  recommendations: string[];
  benchmark_comparison?: Record<string, number>;
  weather_impact?: number;
  occupancy_impact?: number;
  equipment_performance?: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface IForecastData extends DatabaseRow {
  building_id: number;
  forecast_type: "consumption" | "demand" | "cost" | "efficiency";
  forecast_period: "hourly" | "daily" | "weekly" | "monthly";
  forecast_date: Date;
  predicted_value: number;
  confidence_lower: number;
  confidence_upper: number;
  model_type: "arima" | "neural_network" | "regression" | "ensemble";
  model_accuracy: number;
  influencing_factors?: Record<string, number>;
  actual_value?: number;
  forecast_error?: number;
  created_by_model: string;
  metadata?: Record<string, any>;
}

export interface IComplianceAnalysis extends DatabaseRow {
  audit_id: number;
  standard_type: string;
  analysis_date: Date;
  overall_score: number;
  weighted_score: number;
  critical_violations: number;
  high_violations: number;
  medium_violations: number;
  low_violations: number;
  improvement_trend: number;
  risk_assessment: "low" | "medium" | "high" | "critical";
  priority_actions: string[];
  compliance_gaps: Record<string, any>;
  cost_of_compliance: number;
  estimated_penalties?: number;
  certification_status?: string;
  next_review_date?: Date;
  metadata?: Record<string, any>;
}

// Analysis Request/Response Types
export interface IAnalysisRequest {
  building_id?: number;
  equipment_id?: number;
  start_date: Date;
  end_date: Date;
  analysis_types: string[];
  parameters?: Record<string, any>;
}

export interface IAnalysisResult {
  analysis_type: string;
  building_id?: number;
  equipment_id?: number;
  results: Record<string, any>;
  confidence_score?: number;
  recommendations?: string[];
  alerts_generated?: number;
  processing_time_ms: number;
  metadata?: Record<string, any>;
}
