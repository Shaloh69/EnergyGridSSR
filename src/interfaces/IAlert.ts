import { DatabaseRow } from "@/types/common";

export enum AlertType {
  ENERGY_ANOMALY = "energy_anomaly",
  POWER_QUALITY = "power_quality",
  EQUIPMENT_FAILURE = "equipment_failure",
  COMPLIANCE_VIOLATION = "compliance_violation",
  MAINTENANCE_DUE = "maintenance_due",
  EFFICIENCY_DEGRADATION = "efficiency_degradation",
  THRESHOLD_EXCEEDED = "threshold_exceeded",
}

export enum AlertSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum AlertStatus {
  ACTIVE = "active",
  ACKNOWLEDGED = "acknowledged",
  RESOLVED = "resolved",
  ESCALATED = "escalated",
}

export interface IAlert extends DatabaseRow {
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  building_id?: number;
  equipment_id?: number;
  audit_id?: number;
  energy_reading_id?: number;
  pq_reading_id?: number;
  threshold_config?: Record<string, any>;
  detected_value?: number;
  threshold_value?: number;
  acknowledged_by?: number;
  acknowledged_at?: Date;
  resolved_by?: number;
  resolved_at?: Date;
  escalated_at?: Date;
  escalation_level?: number;
  notification_sent?: boolean;
  metadata?: Record<string, any>;
}

// Raw database result interface for proper type handling
export interface IAlertRaw extends Omit<IAlert, "metadata"> {
  metadata?: string; // Raw JSON string from database
}

export interface IAlertCreate {
  type: AlertType;
  severity: AlertSeverity;
  status?: AlertStatus; // Fixed: Added optional status property
  title: string;
  message: string;
  building_id?: number;
  equipment_id?: number;
  audit_id?: number;
  energy_reading_id?: number;
  pq_reading_id?: number;
  threshold_config?: Record<string, any>;
  detected_value?: number;
  threshold_value?: number;
  metadata?: Record<string, any>;
}

export interface IAlertUpdate {
  status?: AlertStatus;
  acknowledged_by?: number;
  resolved_by?: number;
  escalation_level?: number;
  metadata?: Record<string, any>;
}

export interface IAlertThreshold extends DatabaseRow {
  building_id?: number;
  equipment_id?: number;
  parameter_name: string;
  parameter_type: "energy" | "power_quality" | "equipment";
  min_value?: number;
  max_value?: number;
  threshold_type: "absolute" | "percentage" | "deviation";
  severity: AlertSeverity;
  enabled: boolean;
  escalation_minutes?: number;
  notification_emails?: string[];
  metadata?: Record<string, any>;
}

export interface IAlertThresholdCreate {
  building_id?: number;
  equipment_id?: number;
  parameter_name: string;
  parameter_type: "energy" | "power_quality" | "equipment";
  min_value?: number;
  max_value?: number;
  threshold_type: "absolute" | "percentage" | "deviation";
  severity: AlertSeverity;
  enabled?: boolean;
  escalation_minutes?: number;
  notification_emails?: string[];
  metadata?: Record<string, any>;
}

// 🔧 ENHANCED INTERFACES FOR MONITORING SYSTEM

export interface BackgroundJobInfo {
  type: string;
  job_id: number;
}

export interface PowerQualityEventInfo {
  event_id: number;
  type: string;
  phase?: string;
  estimated_cost?: number;
}

export interface MaintenancePredictionInfo {
  prediction_id: number;
  equipment_id: number;
  equipment_name?: string;
  prediction_type: string;
  predicted_date: string;
  confidence_score: number;
  risk_level: string;
  contributing_factors: Record<string, any>;
  recommended_actions: string[];
  estimated_cost: number;
  days_until_action: number;
}

export interface MonitoringTestResult {
  success: boolean;
  alerts_generated: number;
  processing_time: number;
  test_results: Record<string, any>;
  alerts: any[];
  compliance_status: "compliant" | "non_compliant";
  background_jobs?: BackgroundJobInfo[];
  power_quality_events?: PowerQualityEventInfo[];
  maintenance_predictions?: MaintenancePredictionInfo[];
  error?: string;
}

export interface EnhancedMonitoringTestResult extends MonitoringTestResult {
  // Energy monitoring enhancements
  trends_analysis?: {
    daily_trends?: any[];
    event_summary?: any[];
    trend_analysis?: {
      deteriorating: boolean;
      stable: boolean;
      improving: boolean;
    };
  };
  baseline_info?: {
    baseline_consumption?: number;
    confidence_interval?: number;
    baseline_type?: string;
  };

  // Power quality enhancements
  cost_impact?: number;

  // Equipment monitoring enhancements
  performance_trends?: {
    maintenance_history?: any[];
    alert_trends?: any[];
    performance_score?: number;
    reliability_trend?: string;
  };
  efficiency_impact?: {
    current_efficiency_percentage?: number;
    efficiency_category?: string;
    estimated_energy_waste_percentage?: number;
    annual_cost_impact?: number;
    improvement_potential?: number;
  };
  recommended_actions?: string[];

  // Background processing support
  background_job_id?: number;
  status?: "processing" | "completed" | "failed";
  message?: string;
  estimated_completion?: Date;
}

export interface AlertStatistics {
  total: {
    total_alerts: number;
    alerts_today: number;
    alerts_this_week: number;
  };
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  response_times: {
    avg_acknowledgment_time: number;
    avg_resolution_time: number;
  };
  trends: {
    daily_alerts_last_week: Array<{ date: string; count: number }>;
    escalation_rate: number;
  };
}
