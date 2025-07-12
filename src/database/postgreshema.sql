-- =============================================
-- UCLM Energy Audit Platform - PostgreSQL Schema
-- Version: 3.0 (Converted from MySQL for Render Deployment)
-- PostgreSQL 14+ Compatible
-- =============================================

-- =============================================
-- DATABASE SETUP & EXTENSIONS
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom ENUM types
CREATE TYPE user_role_enum AS ENUM ('admin', 'energy_manager', 'facility_engineer', 'staff', 'student');
CREATE TYPE building_status_enum AS ENUM ('active', 'maintenance', 'inactive');
CREATE TYPE equipment_type_enum AS ENUM ('hvac', 'lighting', 'motor', 'transformer', 'panel', 'ups', 'generator', 'others');
CREATE TYPE equipment_status_enum AS ENUM ('active', 'maintenance', 'faulty', 'inactive');
CREATE TYPE maintenance_schedule_enum AS ENUM ('weekly', 'monthly', 'quarterly', 'annually');
CREATE TYPE audit_type_enum AS ENUM ('energy_efficiency', 'power_quality', 'safety', 'comprehensive');
CREATE TYPE audit_status_enum AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE priority_enum AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE energy_type_enum AS ENUM ('total', 'hvac', 'lighting', 'plugload', 'others');
CREATE TYPE alert_type_enum AS ENUM ('energy_anomaly', 'power_quality', 'equipment_failure', 'compliance_violation', 'maintenance_due', 'efficiency_degradation', 'threshold_exceeded');
CREATE TYPE alert_severity_enum AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE alert_status_enum AS ENUM ('active', 'acknowledged', 'resolved', 'escalated');
CREATE TYPE threshold_type_enum AS ENUM ('absolute', 'percentage', 'deviation');
CREATE TYPE monitoring_type_enum AS ENUM ('energy_threshold', 'power_quality', 'equipment_health', 'compliance_check', 'anomaly_detection');
CREATE TYPE check_result_enum AS ENUM ('passed', 'warning', 'failed', 'error');
CREATE TYPE job_type_enum AS ENUM ('analytics_processing', 'alert_monitoring', 'compliance_check', 'maintenance_prediction', 'forecast_generation');
CREATE TYPE job_status_enum AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE baseline_type_enum AS ENUM ('daily', 'weekly', 'monthly', 'seasonal');
CREATE TYPE calculation_method_enum AS ENUM ('average', 'regression', 'machine_learning');
CREATE TYPE pq_event_type_enum AS ENUM ('sag', 'swell', 'interruption', 'transient', 'harmonic', 'flicker', 'unbalance', 'frequency_deviation');
CREATE TYPE pq_severity_enum AS ENUM ('minor', 'moderate', 'severe', 'critical');
CREATE TYPE prediction_type_enum AS ENUM ('failure', 'maintenance', 'replacement');
CREATE TYPE risk_level_enum AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE detection_type_enum AS ENUM ('energy', 'power_quality', 'equipment');
CREATE TYPE data_point_type_enum AS ENUM ('energy_consumption', 'power_quality', 'equipment_reading');
CREATE TYPE investigation_status_enum AS ENUM ('pending', 'investigating', 'resolved', 'false_positive');
CREATE TYPE forecast_type_enum AS ENUM ('consumption', 'demand', 'cost', 'efficiency');
CREATE TYPE forecast_period_enum AS ENUM ('hourly', 'daily', 'weekly', 'monthly');
CREATE TYPE model_type_enum AS ENUM ('arima', 'neural_network', 'regression', 'ensemble');
CREATE TYPE standard_type_enum AS ENUM ('PEC2017', 'OSHS', 'ISO25010', 'RA11285');
CREATE TYPE compliance_status_enum AS ENUM ('compliant', 'non_compliant', 'needs_review', 'not_applicable');
CREATE TYPE maintenance_type_enum AS ENUM ('preventive', 'corrective', 'predictive', 'emergency');
CREATE TYPE report_type_enum AS ENUM ('energy_consumption', 'power_quality', 'audit_summary', 'compliance', 'monitoring_summary', 'analytics_report');
CREATE TYPE report_status_enum AS ENUM ('generating', 'completed', 'failed');
CREATE TYPE cache_type_enum AS ENUM ('energy_stats', 'pq_stats', 'alert_summary', 'efficiency_summary', 'equipment_health');
CREATE TYPE config_type_enum AS ENUM ('threshold', 'schedule', 'notification', 'analytics');

-- =============================================
-- CORE SYSTEM TABLES
-- =============================================

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role_enum NOT NULL,
    department VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    refresh_token TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_department ON users(department);

-- Buildings table
CREATE TABLE buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    area_sqm DECIMAL(10,2),
    floors INTEGER,
    year_built INTEGER,
    building_type VARCHAR(100),
    description TEXT,
    status building_status_enum DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for buildings
CREATE INDEX idx_buildings_code ON buildings(code);
CREATE INDEX idx_buildings_status ON buildings(status);
CREATE INDEX idx_buildings_type ON buildings(building_type);
CREATE INDEX idx_buildings_name ON buildings(name);

-- Equipment table
CREATE TABLE equipment (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    equipment_type equipment_type_enum NOT NULL,
    model VARCHAR(100),
    manufacturer VARCHAR(100),
    power_rating_kw DECIMAL(10,2),
    voltage_rating DECIMAL(10,2),
    installation_date DATE,
    maintenance_schedule maintenance_schedule_enum DEFAULT 'monthly',
    status equipment_status_enum DEFAULT 'active',
    location VARCHAR(200),
    qr_code VARCHAR(100) UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for equipment
CREATE INDEX idx_equipment_building ON equipment(building_id);
CREATE INDEX idx_equipment_type ON equipment(equipment_type);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_qr ON equipment(qr_code);
CREATE INDEX idx_equipment_name ON equipment(name);
CREATE INDEX idx_equipment_maintenance ON equipment(maintenance_schedule);
CREATE INDEX idx_equipment_building_status ON equipment(building_id, status);

-- Audits table
CREATE TABLE audits (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    auditor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    audit_type audit_type_enum NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    status audit_status_enum DEFAULT 'scheduled',
    priority priority_enum DEFAULT 'medium',
    scheduled_date DATE,
    started_date TIMESTAMPTZ,
    completed_date TIMESTAMPTZ,
    findings TEXT,
    recommendations TEXT,
    compliance_score DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audits
CREATE INDEX idx_audits_building ON audits(building_id);
CREATE INDEX idx_audits_auditor ON audits(auditor_id);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_type ON audits(audit_type);
CREATE INDEX idx_audits_priority ON audits(priority);
CREATE INDEX idx_audits_scheduled ON audits(scheduled_date);
CREATE INDEX idx_audits_completed ON audits(completed_date);
CREATE INDEX idx_audits_building_status ON audits(building_id, status);

-- =============================================
-- ENERGY & MONITORING TABLES
-- =============================================

-- Energy consumption table
CREATE TABLE energy_consumption (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    consumption_kwh DECIMAL(12,4) NOT NULL,
    cost_php DECIMAL(12,2),
    recorded_at TIMESTAMPTZ NOT NULL,
    meter_reading DECIMAL(15,4),
    demand_kw DECIMAL(10,4),
    power_factor DECIMAL(4,3),
    energy_type energy_type_enum DEFAULT 'total',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for energy_consumption
CREATE INDEX idx_energy_building ON energy_consumption(building_id);
CREATE INDEX idx_energy_recorded ON energy_consumption(recorded_at);
CREATE INDEX idx_energy_type ON energy_consumption(energy_type);
CREATE INDEX idx_energy_building_recorded ON energy_consumption(building_id, recorded_at);
CREATE INDEX idx_energy_consumption ON energy_consumption(consumption_kwh);
CREATE INDEX idx_energy_power_factor ON energy_consumption(power_factor);
CREATE INDEX idx_energy_monitoring ON energy_consumption(building_id, recorded_at, power_factor, consumption_kwh);

-- Power quality table
CREATE TABLE power_quality (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    voltage_l1 DECIMAL(8,4),
    voltage_l2 DECIMAL(8,4),
    voltage_l3 DECIMAL(8,4),
    current_l1 DECIMAL(10,4),
    current_l2 DECIMAL(10,4),
    current_l3 DECIMAL(10,4),
    thd_voltage DECIMAL(6,3),
    thd_current DECIMAL(6,3),
    frequency DECIMAL(6,3),
    power_factor DECIMAL(4,3),
    voltage_unbalance DECIMAL(6,3),
    current_unbalance DECIMAL(6,3),
    recorded_at TIMESTAMPTZ NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for power_quality
CREATE INDEX idx_pq_building ON power_quality(building_id);
CREATE INDEX idx_pq_recorded ON power_quality(recorded_at);
CREATE INDEX idx_pq_building_recorded ON power_quality(building_id, recorded_at);
CREATE INDEX idx_pq_thd_voltage ON power_quality(thd_voltage);
CREATE INDEX idx_pq_thd_current ON power_quality(thd_current);
CREATE INDEX idx_pq_frequency ON power_quality(frequency);
CREATE INDEX idx_pq_voltage_unbalance ON power_quality(voltage_unbalance);
CREATE INDEX idx_pq_monitoring ON power_quality(building_id, recorded_at, thd_voltage, voltage_unbalance);

-- =============================================
-- ALERTS & MONITORING SYSTEM
-- =============================================

-- Alert thresholds configuration
CREATE TABLE alert_thresholds (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    parameter_name VARCHAR(100) NOT NULL,
    parameter_type alert_type_enum NOT NULL,
    min_value DECIMAL(15,6),
    max_value DECIMAL(15,6),
    threshold_type threshold_type_enum NOT NULL,
    severity alert_severity_enum NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    escalation_minutes INTEGER DEFAULT 30,
    notification_emails JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for alert_thresholds
CREATE INDEX idx_thresholds_parameter ON alert_thresholds(parameter_name, parameter_type);
CREATE INDEX idx_thresholds_building ON alert_thresholds(building_id);
CREATE INDEX idx_thresholds_equipment ON alert_thresholds(equipment_id);
CREATE INDEX idx_thresholds_enabled ON alert_thresholds(enabled);
CREATE INDEX idx_thresholds_type ON alert_thresholds(parameter_type);

-- Alerts table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    type alert_type_enum NOT NULL,
    severity alert_severity_enum NOT NULL,
    status alert_status_enum DEFAULT 'active',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    audit_id INTEGER REFERENCES audits(id) ON DELETE CASCADE,
    energy_reading_id INTEGER REFERENCES energy_consumption(id) ON DELETE SET NULL,
    pq_reading_id INTEGER REFERENCES power_quality(id) ON DELETE SET NULL,
    threshold_config JSONB,
    detected_value DECIMAL(15,6),
    threshold_value DECIMAL(15,6),
    acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ,
    escalation_level INTEGER DEFAULT 0,
    notification_sent BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for alerts
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_building ON alerts(building_id);
CREATE INDEX idx_alerts_equipment ON alerts(equipment_id);
CREATE INDEX idx_alerts_created ON alerts(created_at);
CREATE INDEX idx_alerts_active ON alerts(status, created_at);
CREATE INDEX idx_alerts_building_status_severity ON alerts(building_id, status, severity);
CREATE INDEX idx_alerts_type_created ON alerts(type, created_at);

-- System monitoring logs
CREATE TABLE system_monitoring_logs (
    id SERIAL PRIMARY KEY,
    monitoring_type monitoring_type_enum NOT NULL,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    check_result check_result_enum NOT NULL,
    details JSONB,
    alerts_generated INTEGER DEFAULT 0,
    processing_time_ms INTEGER NOT NULL,
    checked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for system_monitoring_logs
CREATE INDEX idx_monitoring_type ON system_monitoring_logs(monitoring_type);
CREATE INDEX idx_monitoring_building ON system_monitoring_logs(building_id);
CREATE INDEX idx_monitoring_checked ON system_monitoring_logs(checked_at);
CREATE INDEX idx_monitoring_result ON system_monitoring_logs(check_result);
CREATE INDEX idx_monitoring_building_checked ON system_monitoring_logs(building_id, checked_at);

-- =============================================
-- BACKGROUND PROCESSING & ANALYTICS
-- =============================================

-- Background jobs queue
CREATE TABLE background_jobs (
    id SERIAL PRIMARY KEY,
    job_type job_type_enum NOT NULL,
    status job_status_enum DEFAULT 'pending',
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    job_parameters JSONB,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    result_data JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for background_jobs
CREATE INDEX idx_jobs_type ON background_jobs(job_type);
CREATE INDEX idx_jobs_status ON background_jobs(status);
CREATE INDEX idx_jobs_building ON background_jobs(building_id);
CREATE INDEX idx_jobs_created ON background_jobs(created_at);
CREATE INDEX idx_jobs_status_created ON background_jobs(status, created_at);

-- Energy baselines for anomaly detection
CREATE TABLE energy_baselines (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    baseline_type baseline_type_enum NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    baseline_consumption DECIMAL(15,6) NOT NULL,
    confidence_interval DECIMAL(5,2) NOT NULL,
    weather_normalized BOOLEAN DEFAULT FALSE,
    occupancy_adjusted BOOLEAN DEFAULT FALSE,
    calculation_method calculation_method_enum NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(building_id, baseline_type, period_start, period_end)
);

-- Create indexes for energy_baselines
CREATE INDEX idx_baselines_building ON energy_baselines(building_id);
CREATE INDEX idx_baselines_type ON energy_baselines(baseline_type);
CREATE INDEX idx_baselines_period ON energy_baselines(period_start, period_end);
CREATE INDEX idx_baselines_building_type ON energy_baselines(building_id, baseline_type);

-- Power quality events detection
CREATE TABLE power_quality_events (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    pq_reading_id INTEGER NOT NULL REFERENCES power_quality(id) ON DELETE CASCADE,
    event_type pq_event_type_enum NOT NULL,
    severity pq_severity_enum NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_ms INTEGER,
    magnitude DECIMAL(15,6),
    itic_curve_violation BOOLEAN DEFAULT FALSE,
    ieee519_violation BOOLEAN DEFAULT FALSE,
    affected_equipment JSONB,
    estimated_cost DECIMAL(12,2),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for power_quality_events
CREATE INDEX idx_pq_events_building ON power_quality_events(building_id);
CREATE INDEX idx_pq_events_type ON power_quality_events(event_type);
CREATE INDEX idx_pq_events_severity ON power_quality_events(severity);
CREATE INDEX idx_pq_events_time ON power_quality_events(start_time);
CREATE INDEX idx_pq_events_violations ON power_quality_events(itic_curve_violation, ieee519_violation);
CREATE INDEX idx_pq_events_building_time ON power_quality_events(building_id, start_time);

-- Maintenance predictions
CREATE TABLE maintenance_predictions (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    prediction_type prediction_type_enum NOT NULL,
    predicted_date DATE NOT NULL,
    confidence_score DECIMAL(5,2) NOT NULL,
    risk_level risk_level_enum NOT NULL,
    contributing_factors JSONB NOT NULL,
    recommended_actions JSONB NOT NULL,
    estimated_cost DECIMAL(12,2),
    business_impact TEXT,
    model_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    last_calculated TIMESTAMPTZ NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for maintenance_predictions
CREATE INDEX idx_predictions_equipment ON maintenance_predictions(equipment_id);
CREATE INDEX idx_predictions_date ON maintenance_predictions(predicted_date);
CREATE INDEX idx_predictions_risk ON maintenance_predictions(risk_level);
CREATE INDEX idx_predictions_type ON maintenance_predictions(prediction_type);
CREATE INDEX idx_predictions_equipment_date ON maintenance_predictions(equipment_id, predicted_date);

-- Anomaly detection results
CREATE TABLE anomaly_detections (
    id SERIAL PRIMARY KEY,
    detection_type detection_type_enum NOT NULL,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ NOT NULL,
    anomaly_score DECIMAL(8,4) NOT NULL,
    threshold_score DECIMAL(8,4) NOT NULL,
    data_point_id INTEGER NOT NULL,
    data_point_type data_point_type_enum NOT NULL,
    anomaly_description TEXT NOT NULL,
    expected_value DECIMAL(15,6),
    actual_value DECIMAL(15,6),
    deviation_percentage DECIMAL(8,4),
    investigation_status investigation_status_enum DEFAULT 'pending',
    root_cause TEXT,
    corrective_action TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for anomaly_detections
CREATE INDEX idx_anomalies_type ON anomaly_detections(detection_type);
CREATE INDEX idx_anomalies_building ON anomaly_detections(building_id);
CREATE INDEX idx_anomalies_equipment ON anomaly_detections(equipment_id);
CREATE INDEX idx_anomalies_detected ON anomaly_detections(detected_at);
CREATE INDEX idx_anomalies_score ON anomaly_detections(anomaly_score);
CREATE INDEX idx_anomalies_status ON anomaly_detections(investigation_status);
CREATE INDEX idx_anomalies_building_detected ON anomaly_detections(building_id, detected_at);

-- Efficiency analyses
CREATE TABLE efficiency_analyses (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    efficiency_score DECIMAL(5,2) NOT NULL,
    baseline_consumption DECIMAL(15,6) NOT NULL,
    actual_consumption DECIMAL(15,6) NOT NULL,
    savings_kwh DECIMAL(15,6) NOT NULL,
    savings_percentage DECIMAL(8,4) NOT NULL,
    cost_savings DECIMAL(12,2) NOT NULL,
    carbon_reduction_kg DECIMAL(12,2) NOT NULL,
    efficiency_factors JSONB NOT NULL,
    recommendations JSONB NOT NULL,
    benchmark_comparison JSONB,
    weather_impact DECIMAL(8,4),
    occupancy_impact DECIMAL(8,4),
    equipment_performance JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficiency_analyses
CREATE INDEX idx_efficiency_building ON efficiency_analyses(building_id);
CREATE INDEX idx_efficiency_period ON efficiency_analyses(analysis_period_start, analysis_period_end);
CREATE INDEX idx_efficiency_score ON efficiency_analyses(efficiency_score);
CREATE INDEX idx_efficiency_building_period ON efficiency_analyses(building_id, analysis_period_start, analysis_period_end);

-- Forecast data
CREATE TABLE forecast_data (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    forecast_type forecast_type_enum NOT NULL,
    forecast_period forecast_period_enum NOT NULL,
    forecast_date DATE NOT NULL,
    predicted_value DECIMAL(15,6) NOT NULL,
    confidence_lower DECIMAL(15,6) NOT NULL,
    confidence_upper DECIMAL(15,6) NOT NULL,
    model_type model_type_enum NOT NULL,
    model_accuracy DECIMAL(5,2) NOT NULL,
    influencing_factors JSONB,
    actual_value DECIMAL(15,6),
    forecast_error DECIMAL(8,4),
    created_by_model VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for forecast_data
CREATE INDEX idx_forecast_building ON forecast_data(building_id);
CREATE INDEX idx_forecast_type ON forecast_data(forecast_type);
CREATE INDEX idx_forecast_date ON forecast_data(forecast_date);
CREATE INDEX idx_forecast_period ON forecast_data(forecast_period);
CREATE INDEX idx_forecast_building_date ON forecast_data(building_id, forecast_date);

-- =============================================
-- COMPLIANCE & AUDIT TABLES
-- =============================================

-- Compliance checks
CREATE TABLE compliance_checks (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    standard_type standard_type_enum NOT NULL,
    section_code VARCHAR(50) NOT NULL,
    check_description TEXT NOT NULL,
    status compliance_status_enum NOT NULL,
    severity alert_severity_enum NOT NULL,
    details TEXT,
    corrective_action TEXT,
    due_date DATE,
    responsible_person VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for compliance_checks
CREATE INDEX idx_compliance_audit ON compliance_checks(audit_id);
CREATE INDEX idx_compliance_standard ON compliance_checks(standard_type);
CREATE INDEX idx_compliance_status ON compliance_checks(status);
CREATE INDEX idx_compliance_severity ON compliance_checks(severity);
CREATE INDEX idx_compliance_section ON compliance_checks(section_code);
CREATE INDEX idx_compliance_due_date ON compliance_checks(due_date);
CREATE INDEX idx_compliance_audit_standard ON compliance_checks(audit_id, standard_type);

-- Enhanced compliance analyses
CREATE TABLE compliance_analyses (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    analysis_date TIMESTAMPTZ NOT NULL,
    overall_score DECIMAL(5,2) NOT NULL,
    weighted_score DECIMAL(5,2) NOT NULL,
    critical_violations INTEGER DEFAULT 0,
    high_violations INTEGER DEFAULT 0,
    medium_violations INTEGER DEFAULT 0,
    low_violations INTEGER DEFAULT 0,
    improvement_trend DECIMAL(8,4) DEFAULT 0,
    risk_assessment risk_level_enum NOT NULL,
    priority_actions JSONB,
    compliance_gaps JSONB,
    cost_of_compliance DECIMAL(12,2) DEFAULT 0,
    estimated_penalties DECIMAL(12,2) DEFAULT 0,
    certification_status VARCHAR(100),
    next_review_date DATE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for compliance_analyses
CREATE INDEX idx_compliance_audit ON compliance_analyses(audit_id);
CREATE INDEX idx_compliance_score ON compliance_analyses(overall_score);
CREATE INDEX idx_compliance_risk ON compliance_analyses(risk_assessment);
CREATE INDEX idx_compliance_date ON compliance_analyses(analysis_date);

-- =============================================
-- MAINTENANCE & EQUIPMENT MANAGEMENT
-- =============================================

-- Equipment maintenance records
CREATE TABLE equipment_maintenance (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    maintenance_type maintenance_type_enum NOT NULL,
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    work_performed TEXT,
    parts_used JSONB,
    cost DECIMAL(10,2),
    downtime_minutes INTEGER DEFAULT 0,
    status audit_status_enum DEFAULT 'scheduled',
    priority priority_enum DEFAULT 'medium',
    maintenance_notes TEXT,
    next_maintenance_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for equipment_maintenance
CREATE INDEX idx_maintenance_equipment ON equipment_maintenance(equipment_id);
CREATE INDEX idx_maintenance_scheduled ON equipment_maintenance(scheduled_date);
CREATE INDEX idx_maintenance_status ON equipment_maintenance(status);
CREATE INDEX idx_maintenance_type ON equipment_maintenance(maintenance_type);
CREATE INDEX idx_maintenance_technician ON equipment_maintenance(technician_id);

-- =============================================
-- REPORTING & CACHING
-- =============================================

-- Reports table
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    report_type report_type_enum NOT NULL,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    audit_id INTEGER REFERENCES audits(id) ON DELETE CASCADE,
    generated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_size BIGINT,
    parameters JSONB,
    data JSONB,
    status report_status_enum DEFAULT 'generating',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for reports
CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_building ON reports(building_id);
CREATE INDEX idx_reports_audit ON reports(audit_id);
CREATE INDEX idx_reports_generated_by ON reports(generated_by);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created ON reports(created_at);

-- Monitoring cache for performance
CREATE TABLE monitoring_stats_cache (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    cache_type cache_type_enum NOT NULL,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(building_id, cache_type)
);

-- Create indexes for monitoring_stats_cache
CREATE INDEX idx_monitoring_cache_building_type ON monitoring_stats_cache(building_id, cache_type);
CREATE INDEX idx_monitoring_cache_expires ON monitoring_stats_cache(expires_at);

-- Monitoring configurations
CREATE TABLE monitoring_configurations (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    config_type config_type_enum NOT NULL,
    config_name VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(building_id, equipment_id, config_name)
);

-- Create indexes for monitoring_configurations
CREATE INDEX idx_monitoring_config_building ON monitoring_configurations(building_id);
CREATE INDEX idx_monitoring_config_equipment ON monitoring_configurations(equipment_id);
CREATE INDEX idx_monitoring_config_type ON monitoring_configurations(config_type);
CREATE INDEX idx_monitoring_config_enabled ON monitoring_configurations(enabled);

-- =============================================
-- UPDATE TRIGGERS
-- =============================================

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON buildings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_audits_updated_at BEFORE UPDATE ON audits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_energy_consumption_updated_at BEFORE UPDATE ON energy_consumption FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_power_quality_updated_at BEFORE UPDATE ON power_quality FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alert_thresholds_updated_at BEFORE UPDATE ON alert_thresholds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_background_jobs_updated_at BEFORE UPDATE ON background_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_energy_baselines_updated_at BEFORE UPDATE ON energy_baselines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_power_quality_events_updated_at BEFORE UPDATE ON power_quality_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_maintenance_predictions_updated_at BEFORE UPDATE ON maintenance_predictions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_anomaly_detections_updated_at BEFORE UPDATE ON anomaly_detections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_efficiency_analyses_updated_at BEFORE UPDATE ON efficiency_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forecast_data_updated_at BEFORE UPDATE ON forecast_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_checks_updated_at BEFORE UPDATE ON compliance_checks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_analyses_updated_at BEFORE UPDATE ON compliance_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_maintenance_updated_at BEFORE UPDATE ON equipment_maintenance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monitoring_stats_cache_updated_at BEFORE UPDATE ON monitoring_stats_cache FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monitoring_configurations_updated_at BEFORE UPDATE ON monitoring_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- UTILITY FUNCTIONS (PostgreSQL versions)
-- =============================================

-- Function to calculate power factor
CREATE OR REPLACE FUNCTION calculate_power_factor(real_power DECIMAL, apparent_power DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
    power_factor DECIMAL := 0;
BEGIN
    IF apparent_power > 0 THEN
        power_factor := real_power / apparent_power;
        IF power_factor > 1 THEN
            power_factor := 1;
        END IF;
    END IF;
    
    RETURN power_factor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to determine compliance risk level
CREATE OR REPLACE FUNCTION get_compliance_risk_level(critical_violations INTEGER, high_violations INTEGER, medium_violations INTEGER)
RETURNS risk_level_enum AS $$
DECLARE
    risk_level risk_level_enum := 'low';
BEGIN
    IF critical_violations > 0 THEN
        risk_level := 'critical';
    ELSIF high_violations > 2 THEN
        risk_level := 'high';
    ELSIF high_violations > 0 OR medium_violations > 5 THEN
        risk_level := 'medium';
    END IF;
    
    RETURN risk_level;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate energy cost
CREATE OR REPLACE FUNCTION calculate_energy_cost(consumption_kwh DECIMAL, rate_per_kwh DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
    cost DECIMAL := 0;
BEGIN
    IF consumption_kwh > 0 AND rate_per_kwh > 0 THEN
        cost := consumption_kwh * rate_per_kwh;
    END IF;
    
    RETURN cost;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check THD compliance
CREATE OR REPLACE FUNCTION check_thd_compliance(thd_voltage DECIMAL, thd_current DECIMAL)
RETURNS VARCHAR AS $$
DECLARE
    compliance_status VARCHAR := 'COMPLIANT';
BEGIN
    -- IEEE 519 standards: THD voltage <= 8%, THD current <= 15%
    IF thd_voltage > 8.0 OR thd_current > 15.0 THEN
        compliance_status := 'NON_COMPLIANT';
    ELSIF thd_voltage > 5.0 OR thd_current > 10.0 THEN
        compliance_status := 'WARNING';
    END IF;
    
    RETURN compliance_status;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate carbon footprint
CREATE OR REPLACE FUNCTION calculate_carbon_footprint(consumption_kwh DECIMAL, emission_factor DECIMAL DEFAULT 0.7122)
RETURNS DECIMAL AS $$
DECLARE
    carbon_kg DECIMAL := 0;
BEGIN
    -- Default emission factor for Philippines: 0.7122 kg CO2/kWh
    IF emission_factor IS NULL OR emission_factor <= 0 THEN
        emission_factor := 0.7122;
    END IF;
    
    IF consumption_kwh > 0 THEN
        carbon_kg := consumption_kwh * emission_factor;
    END IF;
    
    RETURN carbon_kg;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- MONITORING STORED PROCEDURES
-- =============================================

-- Procedure to calculate building efficiency with monitoring integration
CREATE OR REPLACE FUNCTION calculate_building_efficiency_with_monitoring(
    p_building_id INTEGER, 
    start_date DATE, 
    end_date DATE
)
RETURNS TABLE(
    building_id INTEGER,
    total_consumption DECIMAL,
    avg_power_factor DECIMAL,
    efficiency_score DECIMAL,
    alert_count INTEGER,
    pq_issues INTEGER
) AS $$
DECLARE
    v_total_consumption DECIMAL := 0;
    v_avg_power_factor DECIMAL := 0;
    v_efficiency_score DECIMAL := 0;
    v_alert_count INTEGER := 0;
    v_pq_issues INTEGER := 0;
BEGIN
    -- Calculate energy metrics
    SELECT 
        COALESCE(SUM(consumption_kwh), 0),
        COALESCE(AVG(power_factor), 0)
    INTO v_total_consumption, v_avg_power_factor
    FROM energy_consumption 
    WHERE building_id = p_building_id 
    AND DATE(recorded_at) BETWEEN start_date AND end_date;
    
    -- Count monitoring alerts
    SELECT COUNT(*) INTO v_alert_count
    FROM alerts 
    WHERE building_id = p_building_id 
    AND DATE(created_at) BETWEEN start_date AND end_date
    AND type IN ('energy_anomaly', 'threshold_exceeded');
    
    -- Count power quality issues
    SELECT COUNT(*) INTO v_pq_issues
    FROM power_quality_events 
    WHERE building_id = p_building_id 
    AND DATE(start_time) BETWEEN start_date AND end_date
    AND severity IN ('severe', 'critical');
    
    -- Calculate efficiency score with monitoring penalties
    v_efficiency_score := CASE 
        WHEN v_avg_power_factor >= 0.95 AND v_alert_count = 0 THEN 100
        WHEN v_avg_power_factor >= 0.90 AND v_alert_count <= 2 THEN 85
        WHEN v_avg_power_factor >= 0.85 AND v_alert_count <= 5 THEN 70
        ELSE 50
    END;
    
    -- Apply penalties for PQ issues
    v_efficiency_score := v_efficiency_score - (v_pq_issues * 5);
    v_efficiency_score := GREATEST(v_efficiency_score, 0);
    
    RETURN QUERY SELECT 
        p_building_id,
        v_total_consumption,
        v_avg_power_factor,
        v_efficiency_score,
        v_alert_count,
        v_pq_issues;
END;
$$ LANGUAGE plpgsql;

-- Procedure to get comprehensive equipment health
CREATE OR REPLACE FUNCTION get_equipment_health_with_predictions(p_building_id INTEGER)
RETURNS TABLE(
    id INTEGER,
    name VARCHAR,
    equipment_type equipment_type_enum,
    status equipment_status_enum,
    maintenance_schedule maintenance_schedule_enum,
    next_maintenance DATE,
    predicted_maintenance DATE,
    risk_level risk_level_enum,
    confidence_score DECIMAL,
    alerts_count BIGINT,
    health_status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.name,
        e.equipment_type,
        e.status,
        e.maintenance_schedule,
        em.scheduled_date as next_maintenance,
        mp.predicted_date as predicted_maintenance,
        mp.risk_level,
        mp.confidence_score,
        COALESCE(alert_count.alerts_count, 0) as alerts_count,
        CASE 
            WHEN em.scheduled_date <= CURRENT_DATE THEN 'OVERDUE'
            WHEN em.scheduled_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'DUE_SOON'
            WHEN mp.risk_level = 'critical' THEN 'HIGH_RISK'
            WHEN alert_count.alerts_count > 0 THEN 'ALERTS_ACTIVE'
            ELSE 'NORMAL'
        END as health_status
    FROM equipment e
    LEFT JOIN equipment_maintenance em ON e.id = em.equipment_id 
        AND em.status = 'scheduled' 
        AND em.scheduled_date = (
            SELECT MIN(scheduled_date) 
            FROM equipment_maintenance 
            WHERE equipment_id = e.id AND status = 'scheduled'
        )
    LEFT JOIN maintenance_predictions mp ON e.id = mp.equipment_id
        AND mp.id = (
            SELECT id FROM maintenance_predictions 
            WHERE equipment_id = e.id 
            ORDER BY created_at DESC 
            LIMIT 1
        )
    LEFT JOIN (
        SELECT 
            equipment_id, 
            COUNT(*) as alerts_count 
        FROM alerts 
        WHERE status = 'active' 
        GROUP BY equipment_id
    ) alert_count ON e.id = alert_count.equipment_id
    WHERE e.building_id = p_building_id
    ORDER BY 
        CASE 
            WHEN em.scheduled_date <= CURRENT_DATE THEN 1
            WHEN em.scheduled_date <= CURRENT_DATE + INTERVAL '7 days' THEN 2
            WHEN mp.risk_level = 'critical' THEN 3
            WHEN alert_count.alerts_count > 0 THEN 4
            ELSE 5
        END;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- MONITORING VIEWS
-- =============================================

-- Active alerts with context
CREATE VIEW active_alerts_view AS
SELECT 
    a.*,
    b.name as building_name,
    b.code as building_code,
    e.name as equipment_name,
    e.equipment_type,
    u1.first_name as acknowledged_by_name,
    u2.first_name as resolved_by_name,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - a.created_at))/60 as age_minutes
FROM alerts a
LEFT JOIN buildings b ON a.building_id = b.id
LEFT JOIN equipment e ON a.equipment_id = e.id
LEFT JOIN users u1 ON a.acknowledged_by = u1.id
LEFT JOIN users u2 ON a.resolved_by = u2.id
WHERE a.status IN ('active', 'acknowledged', 'escalated');

-- Building monitoring summary
CREATE VIEW building_monitoring_summary AS
SELECT 
    b.*,
    ea.efficiency_score,
    ea.savings_kwh,
    ea.cost_savings,
    ea.carbon_reduction_kg,
    ca.overall_score as compliance_score,
    ca.risk_assessment as compliance_risk,
    COALESCE(alert_stats.active_alerts, 0) as active_alerts,
    COALESCE(alert_stats.critical_alerts, 0) as critical_alerts,
    COALESCE(alert_stats.high_alerts, 0) as high_alerts,
    COALESCE(eq_stats.total_equipment, 0) as total_equipment,
    COALESCE(eq_stats.faulty_equipment, 0) as faulty_equipment,
    ec_latest.latest_consumption,
    ec_latest.latest_power_factor,
    pq_latest.latest_thd_voltage,
    pq_latest.latest_voltage_unbalance
FROM buildings b
LEFT JOIN LATERAL (
    SELECT efficiency_score, savings_kwh, cost_savings, carbon_reduction_kg
    FROM efficiency_analyses 
    WHERE building_id = b.id 
    ORDER BY created_at DESC 
    LIMIT 1
) ea ON TRUE
LEFT JOIN LATERAL (
    SELECT ca.overall_score, ca.risk_assessment
    FROM compliance_analyses ca
    JOIN audits a ON ca.audit_id = a.id
    WHERE a.building_id = b.id 
    ORDER BY ca.created_at DESC 
    LIMIT 1
) ca ON TRUE
LEFT JOIN (
    SELECT 
        building_id,
        COUNT(*) as active_alerts,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_alerts,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_alerts
    FROM alerts 
    WHERE status = 'active'
    GROUP BY building_id
) alert_stats ON b.id = alert_stats.building_id
LEFT JOIN (
    SELECT 
        building_id,
        COUNT(*) as total_equipment,
        SUM(CASE WHEN status = 'faulty' THEN 1 ELSE 0 END) as faulty_equipment
    FROM equipment
    GROUP BY building_id
) eq_stats ON b.id = eq_stats.building_id
LEFT JOIN LATERAL (
    SELECT consumption_kwh as latest_consumption, power_factor as latest_power_factor
    FROM energy_consumption
    WHERE building_id = b.id
    ORDER BY recorded_at DESC
    LIMIT 1
) ec_latest ON TRUE
LEFT JOIN LATERAL (
    SELECT thd_voltage as latest_thd_voltage, voltage_unbalance as latest_voltage_unbalance
    FROM power_quality
    WHERE building_id = b.id
    ORDER BY recorded_at DESC
    LIMIT 1
) pq_latest ON TRUE;

-- Monitoring dashboard summary
CREATE VIEW monitoring_dashboard_summary AS
SELECT 
    b.id as building_id,
    b.name as building_name,
    b.code as building_code,
    b.status as building_status,
    COALESCE(alert_stats.active_alerts, 0) as active_alerts,
    COALESCE(alert_stats.critical_alerts, 0) as critical_alerts,
    COALESCE(alert_stats.high_alerts, 0) as high_alerts,
    COALESCE(eq_stats.total_equipment, 0) as total_equipment,
    COALESCE(eq_stats.faulty_equipment, 0) as faulty_equipment,
    COALESCE(mp_stats.critical_maintenance, 0) as critical_maintenance,
    ec_latest.last_energy_reading,
    pq_latest.last_pq_reading,
    mon_stats.last_monitoring_check
FROM buildings b
LEFT JOIN (
    SELECT 
        building_id,
        COUNT(*) as active_alerts,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_alerts,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_alerts
    FROM alerts 
    WHERE status = 'active'
    GROUP BY building_id
) alert_stats ON b.id = alert_stats.building_id
LEFT JOIN (
    SELECT 
        building_id,
        COUNT(*) as total_equipment,
        SUM(CASE WHEN status = 'faulty' THEN 1 ELSE 0 END) as faulty_equipment
    FROM equipment
    GROUP BY building_id
) eq_stats ON b.id = eq_stats.building_id
LEFT JOIN (
    SELECT 
        e.building_id,
        COUNT(CASE WHEN mp.risk_level = 'critical' THEN 1 END) as critical_maintenance
    FROM equipment e
    LEFT JOIN maintenance_predictions mp ON e.id = mp.equipment_id
    GROUP BY e.building_id
) mp_stats ON b.id = mp_stats.building_id
LEFT JOIN (
    SELECT 
        building_id, 
        MAX(recorded_at) as last_energy_reading
    FROM energy_consumption
    GROUP BY building_id
) ec_latest ON b.id = ec_latest.building_id
LEFT JOIN (
    SELECT 
        building_id, 
        MAX(recorded_at) as last_pq_reading
    FROM power_quality
    GROUP BY building_id
) pq_latest ON b.id = pq_latest.building_id
LEFT JOIN (
    SELECT 
        building_id, 
        MAX(checked_at) as last_monitoring_check
    FROM system_monitoring_logs
    GROUP BY building_id
) mon_stats ON b.id = mon_stats.building_id
WHERE b.status = 'active';

-- =============================================
-- MONITORING TRIGGERS
-- =============================================

-- Trigger function for energy consumption monitoring
CREATE OR REPLACE FUNCTION energy_consumption_monitoring_trigger()
RETURNS TRIGGER AS $$
DECLARE
    alert_needed BOOLEAN := FALSE;
    alert_type alert_type_enum;
    alert_message TEXT;
    alert_severity alert_severity_enum;
    alerts_generated INTEGER := 0;
BEGIN
    -- Check power factor threshold
    IF NEW.power_factor IS NOT NULL AND NEW.power_factor < 0.85 THEN
        alert_needed := TRUE;
        alert_type := 'threshold_exceeded';
        alert_severity := CASE 
            WHEN NEW.power_factor < 0.80 THEN 'high'
            ELSE 'medium'
        END;
        alert_message := 'Low power factor detected: ' || NEW.power_factor;
        
        INSERT INTO alerts (type, severity, title, message, building_id, energy_reading_id, detected_value, threshold_value)
        VALUES (alert_type, alert_severity, 'Low Power Factor Alert', alert_message, NEW.building_id, NEW.id, NEW.power_factor, 0.85);
        
        alerts_generated := alerts_generated + 1;
    END IF;
    
    -- Check high consumption (basic threshold - should be configurable)
    IF NEW.consumption_kwh > 1000 THEN
        INSERT INTO alerts (type, severity, title, message, building_id, energy_reading_id, detected_value, threshold_value)
        VALUES ('energy_anomaly', 'medium', 'High Energy Consumption', 
                'High consumption detected: ' || NEW.consumption_kwh || ' kWh', 
                NEW.building_id, NEW.id, NEW.consumption_kwh, 1000);
        
        alerts_generated := alerts_generated + 1;
    END IF;
    
    -- Log monitoring activity
    INSERT INTO system_monitoring_logs (
        monitoring_type, building_id, check_result, details, alerts_generated, processing_time_ms
    ) VALUES (
        'energy_threshold', NEW.building_id, 
        CASE WHEN alerts_generated > 0 THEN 'warning' ELSE 'passed' END,
        jsonb_build_object('reading_id', NEW.id, 'consumption_kwh', NEW.consumption_kwh, 'power_factor', NEW.power_factor),
        alerts_generated,
        0
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for energy consumption monitoring
CREATE TRIGGER energy_consumption_monitoring_trigger
    AFTER INSERT ON energy_consumption
    FOR EACH ROW
    EXECUTE FUNCTION energy_consumption_monitoring_trigger();

-- Trigger function for power quality monitoring
CREATE OR REPLACE FUNCTION power_quality_monitoring_trigger()
RETURNS TRIGGER AS $$
DECLARE
    alerts_generated INTEGER := 0;
BEGIN
    -- Check THD voltage threshold
    IF NEW.thd_voltage IS NOT NULL AND NEW.thd_voltage > 8.0 THEN
        INSERT INTO alerts (type, severity, title, message, building_id, pq_reading_id, detected_value, threshold_value)
        VALUES ('power_quality', 'high', 'High THD Voltage', 
                'THD voltage exceeds IEEE standards: ' || NEW.thd_voltage || '%', 
                NEW.building_id, NEW.id, NEW.thd_voltage, 8.0);
        alerts_generated := alerts_generated + 1;
    END IF;
    
    -- Check voltage unbalance
    IF NEW.voltage_unbalance IS NOT NULL AND NEW.voltage_unbalance > 3.0 THEN
        INSERT INTO alerts (type, severity, title, message, building_id, pq_reading_id, detected_value, threshold_value)
        VALUES ('power_quality', 'medium', 'Voltage Unbalance', 
                'Voltage unbalance exceeds limit: ' || NEW.voltage_unbalance || '%', 
                NEW.building_id, NEW.id, NEW.voltage_unbalance, 3.0);
        alerts_generated := alerts_generated + 1;
        
        -- Create power quality event record
        INSERT INTO power_quality_events (
            building_id, pq_reading_id, event_type, severity, start_time, magnitude
        ) VALUES (
            NEW.building_id, NEW.id, 'unbalance', 'moderate', NEW.recorded_at, NEW.voltage_unbalance
        );
    END IF;
    
    -- Log monitoring activity
    INSERT INTO system_monitoring_logs (
        monitoring_type, building_id, check_result, details, alerts_generated, processing_time_ms
    ) VALUES (
        'power_quality', NEW.building_id,
        CASE WHEN alerts_generated > 0 THEN 'warning' ELSE 'passed' END,
        jsonb_build_object('reading_id', NEW.id, 'thd_voltage', NEW.thd_voltage, 'voltage_unbalance', NEW.voltage_unbalance),
        alerts_generated,
        0
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for power quality monitoring
CREATE TRIGGER power_quality_monitoring_trigger
    AFTER INSERT ON power_quality
    FOR EACH ROW
    EXECUTE FUNCTION power_quality_monitoring_trigger();

-- Trigger function for equipment status monitoring
CREATE OR REPLACE FUNCTION equipment_status_monitoring_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Alert on equipment failure
    IF NEW.status = 'faulty' AND OLD.status != 'faulty' THEN
        INSERT INTO alerts (type, severity, title, message, building_id, equipment_id)
        VALUES ('equipment_failure', 'critical', 'Equipment Failure Alert', 
                'Equipment failure detected: ' || NEW.name, 
                NEW.building_id, NEW.id);
                
        -- Log monitoring activity
        INSERT INTO system_monitoring_logs (
            monitoring_type, building_id, equipment_id, check_result, details, alerts_generated, processing_time_ms
        ) VALUES (
            'equipment_health', NEW.building_id, NEW.id, 'failed',
            jsonb_build_object('equipment_name', NEW.name, 'old_status', OLD.status, 'new_status', NEW.status),
            1, 0
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for equipment status monitoring
CREATE TRIGGER equipment_status_monitoring_trigger
    AFTER UPDATE ON equipment
    FOR EACH ROW
    EXECUTE FUNCTION equipment_status_monitoring_trigger();

-- =============================================
-- SAMPLE DATA INSERTION
-- =============================================

-- Insert default admin user (password: admin123! - CHANGE IN PRODUCTION!)
INSERT INTO users (email, password, first_name, last_name, role, is_active) VALUES 
('admin@uclm.edu.ph', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeF7pLB5Y.d3Y1bQa', 'System', 'Administrator', 'admin', TRUE),
('energy.manager@uclm.edu.ph', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeF7pLB5Y.d3Y1bQa', 'Energy', 'Manager', 'energy_manager', TRUE),
('facility.engineer@uclm.edu.ph', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeF7pLB5Y.d3Y1bQa', 'Facility', 'Engineer', 'facility_engineer', TRUE);

-- Insert sample buildings
INSERT INTO buildings (name, code, area_sqm, floors, year_built, building_type, status) VALUES 
('Main Academic Building', 'MAB', 5000.00, 4, 2010, 'Academic', 'active'),
('Engineering Building', 'ENG', 3500.00, 3, 2015, 'Academic', 'active'),
('Administration Building', 'ADM', 2000.00, 2, 2008, 'Administrative', 'active'),
('Library Building', 'LIB', 2500.00, 3, 2012, 'Academic', 'active'),
('Student Center', 'SC', 1800.00, 2, 2018, 'Student Services', 'active');

-- Insert sample equipment
INSERT INTO equipment (building_id, name, equipment_type, model, manufacturer, power_rating_kw, status, location, qr_code) VALUES 
(1, 'Main HVAC System A1', 'hvac', 'CH-500', 'Carrier', 150.0, 'active', 'Mechanical Room 1', 'UCLM-MAB-HVAC-001'),
(1, 'Emergency Generator G1', 'generator', 'DG-300', 'Caterpillar', 300.0, 'active', 'Generator Room', 'UCLM-MAB-GEN-001'),
(1, 'Main Transformer T1', 'transformer', 'T-500KVA', 'ABB', 500.0, 'active', 'Electrical Room', 'UCLM-MAB-TRANS-001'),
(2, 'Engineering Lab HVAC', 'hvac', 'CH-250', 'Trane', 80.0, 'active', 'Mechanical Room 2', 'UCLM-ENG-HVAC-001'),
(2, 'UPS System U1', 'ups', 'UPS-50KVA', 'APC', 50.0, 'active', 'Server Room', 'UCLM-ENG-UPS-001'),
(3, 'Admin Building Chiller', 'hvac', 'CH-150', 'York', 60.0, 'active', 'Rooftop', 'UCLM-ADM-HVAC-001');

-- Insert sample energy consumption data
INSERT INTO energy_consumption (building_id, consumption_kwh, cost_php, recorded_at, power_factor, energy_type) VALUES 
-- MAB Building (last 7 days)
(1, 1250.5, 15000.60, CURRENT_TIMESTAMP - INTERVAL '6 days', 0.92, 'total'),
(1, 1180.3, 14163.60, CURRENT_TIMESTAMP - INTERVAL '5 days', 0.89, 'total'),
(1, 1350.8, 16209.60, CURRENT_TIMESTAMP - INTERVAL '4 days', 0.91, 'total'),
(1, 1290.2, 15482.40, CURRENT_TIMESTAMP - INTERVAL '3 days', 0.88, 'total'),
(1, 1220.7, 14648.40, CURRENT_TIMESTAMP - INTERVAL '2 days', 0.93, 'total'),
(1, 1380.9, 16570.80, CURRENT_TIMESTAMP - INTERVAL '1 day', 0.87, 'total'),
(1, 1155.4, 13864.80, CURRENT_TIMESTAMP, 0.94, 'total'),
-- Engineering Building (last 7 days)
(2, 890.2, 10682.40, CURRENT_TIMESTAMP - INTERVAL '6 days', 0.88, 'total'),
(2, 920.5, 11046.00, CURRENT_TIMESTAMP - INTERVAL '5 days', 0.86, 'total'),
(2, 875.3, 10503.60, CURRENT_TIMESTAMP - INTERVAL '4 days', 0.90, 'total'),
(2, 940.8, 11289.60, CURRENT_TIMESTAMP - INTERVAL '3 days', 0.85, 'total'),
(2, 905.1, 10861.20, CURRENT_TIMESTAMP - INTERVAL '2 days', 0.89, 'total'),
(2, 960.4, 11524.80, CURRENT_TIMESTAMP - INTERVAL '1 day', 0.84, 'total'),
(2, 885.7, 10628.40, CURRENT_TIMESTAMP, 0.91, 'total');

-- Insert sample power quality data
INSERT INTO power_quality (building_id, voltage_l1, voltage_l2, voltage_l3, thd_voltage, thd_current, frequency, power_factor, voltage_unbalance, recorded_at) VALUES 
(1, 230.2, 229.8, 230.5, 5.2, 8.1, 50.02, 0.92, 1.8, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
(1, 229.9, 230.1, 230.3, 6.8, 9.2, 49.98, 0.89, 2.1, CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
(1, 230.8, 229.5, 230.2, 7.5, 10.5, 50.05, 0.87, 2.8, CURRENT_TIMESTAMP),
(2, 228.9, 229.2, 230.8, 8.5, 12.3, 49.95, 0.85, 3.2, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
(2, 229.1, 230.5, 229.8, 9.2, 14.8, 50.08, 0.84, 3.8, CURRENT_TIMESTAMP);

-- Insert monitoring configurations
INSERT INTO monitoring_configurations (building_id, config_type, config_name, config_value, enabled) VALUES 
(NULL, 'threshold', 'energy_power_factor_warning', '{"threshold": 0.85, "severity": "medium"}', TRUE),
(NULL, 'threshold', 'energy_power_factor_critical', '{"threshold": 0.80, "severity": "high"}', TRUE),
(NULL, 'threshold', 'energy_consumption_high', '{"threshold": 1000, "severity": "medium"}', TRUE),
(NULL, 'threshold', 'pq_thd_voltage_high', '{"threshold": 8.0, "severity": "high"}', TRUE),
(NULL, 'threshold', 'pq_voltage_unbalance_high', '{"threshold": 3.0, "severity": "medium"}', TRUE),
(NULL, 'schedule', 'anomaly_detection_interval', '{"interval_hours": 1, "min_readings": 10}', TRUE),
(NULL, 'schedule', 'efficiency_analysis_interval', '{"interval_hours": 24, "min_readings": 24}', TRUE),
(NULL, 'notification', 'alert_email_admins', '{"emails": ["admin@uclm.edu.ph", "energy.manager@uclm.edu.ph"]}', TRUE),
(NULL, 'analytics', 'baseline_calculation_method', '{"method": "average", "confidence": 0.95}', TRUE);

-- =============================================
-- SCHEMA VERIFICATION
-- =============================================

-- Show table summary
SELECT 
    schemaname,
    tablename,
    tableowner,
    tablespace,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Final status
SELECT 
    'UCLM Energy Audit Platform Database (PostgreSQL)' as system_name,
    'v3.0 - Complete with Real-time Monitoring' as version,
    CURRENT_TIMESTAMP as installation_date,
    'Ready for Render deployment' as status;