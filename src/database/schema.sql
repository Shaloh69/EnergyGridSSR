-- =============================================
-- UCLM Energy Audit Platform - Complete Database Schema
-- Version: 3.0 (With Integrated Real-time Monitoring & Analytics)
-- MySQL 8.0+ Compatible
-- =============================================

-- =============================================
-- DATABASE SETUP
-- =============================================

-- Create database
CREATE DATABASE IF NOT EXISTS uclm_energy_audit 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE uclm_energy_audit;

-- Set SQL mode for compatibility
SET SQL_MODE = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- Enable event scheduler for automated tasks
SET GLOBAL event_scheduler = ON;

-- =============================================
-- CORE SYSTEM TABLES
-- =============================================

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'energy_manager', 'facility_engineer', 'staff', 'student') NOT NULL,
    department VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    refresh_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active),
    INDEX idx_users_department (department)
);

-- Buildings table
CREATE TABLE buildings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    area_sqm DECIMAL(10,2),
    floors INT,
    year_built YEAR,
    building_type VARCHAR(100),
    description TEXT,
    status ENUM('active', 'maintenance', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_buildings_code (code),
    INDEX idx_buildings_status (status),
    INDEX idx_buildings_type (building_type),
    INDEX idx_buildings_name (name)
);

-- Equipment table
CREATE TABLE equipment (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    equipment_type ENUM('hvac', 'lighting', 'motor', 'transformer', 'panel', 'ups', 'generator', 'others') NOT NULL,
    model VARCHAR(100),
    manufacturer VARCHAR(100),
    power_rating_kw DECIMAL(10,2),
    voltage_rating DECIMAL(10,2),
    installation_date DATE,
    maintenance_schedule ENUM('weekly', 'monthly', 'quarterly', 'annually') DEFAULT 'monthly',
    status ENUM('active', 'maintenance', 'faulty', 'inactive') DEFAULT 'active',
    location VARCHAR(200),
    qr_code VARCHAR(100) UNIQUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    
    INDEX idx_equipment_building (building_id),
    INDEX idx_equipment_type (equipment_type),
    INDEX idx_equipment_status (status),
    INDEX idx_equipment_qr (qr_code),
    INDEX idx_equipment_name (name),
    INDEX idx_equipment_maintenance (maintenance_schedule),
    INDEX idx_equipment_building_status (building_id, status)
);

-- Audits table
CREATE TABLE audits (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT NOT NULL,
    auditor_id INT NOT NULL,
    audit_type ENUM('energy_efficiency', 'power_quality', 'safety', 'comprehensive') NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    scheduled_date DATE,
    started_date TIMESTAMP NULL,
    completed_date TIMESTAMP NULL,
    findings TEXT,
    recommendations TEXT,
    compliance_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (auditor_id) REFERENCES users(id) ON DELETE RESTRICT,
    
    INDEX idx_audits_building (building_id),
    INDEX idx_audits_auditor (auditor_id),
    INDEX idx_audits_status (status),
    INDEX idx_audits_type (audit_type),
    INDEX idx_audits_priority (priority),
    INDEX idx_audits_scheduled (scheduled_date),
    INDEX idx_audits_completed (completed_date),
    INDEX idx_audits_building_status (building_id, status)
);

-- =============================================
-- ENERGY & MONITORING TABLES
-- =============================================

-- Energy consumption table
CREATE TABLE energy_consumption (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT NOT NULL,
    consumption_kwh DECIMAL(12,4) NOT NULL,
    cost_php DECIMAL(12,2),
    recorded_at TIMESTAMP NOT NULL,
    meter_reading DECIMAL(15,4),
    demand_kw DECIMAL(10,4),
    power_factor DECIMAL(4,3),
    energy_type ENUM('total', 'hvac', 'lighting', 'plugload', 'others') DEFAULT 'total',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_energy_building (building_id),
    INDEX idx_energy_recorded (recorded_at),
    INDEX idx_energy_type (energy_type),
    INDEX idx_energy_building_recorded (building_id, recorded_at),
    INDEX idx_energy_consumption (consumption_kwh),
    INDEX idx_energy_power_factor (power_factor),
    INDEX idx_energy_monitoring (building_id, recorded_at, power_factor, consumption_kwh)
);

-- Power quality table
CREATE TABLE power_quality (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT NOT NULL,
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
    recorded_at TIMESTAMP NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_pq_building (building_id),
    INDEX idx_pq_recorded (recorded_at),
    INDEX idx_pq_building_recorded (building_id, recorded_at),
    INDEX idx_pq_thd_voltage (thd_voltage),
    INDEX idx_pq_thd_current (thd_current),
    INDEX idx_pq_frequency (frequency),
    INDEX idx_pq_voltage_unbalance (voltage_unbalance),
    INDEX idx_pq_monitoring (building_id, recorded_at, thd_voltage, voltage_unbalance)
);

-- =============================================
-- ALERTS & MONITORING SYSTEM
-- =============================================

-- Alert thresholds configuration
CREATE TABLE alert_thresholds (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT,
    equipment_id INT,
    parameter_name VARCHAR(100) NOT NULL,
    parameter_type ENUM('energy', 'power_quality', 'equipment') NOT NULL,
    min_value DECIMAL(15,6),
    max_value DECIMAL(15,6),
    threshold_type ENUM('absolute', 'percentage', 'deviation') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    escalation_minutes INT DEFAULT 30,
    notification_emails JSON,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    
    INDEX idx_thresholds_parameter (parameter_name, parameter_type),
    INDEX idx_thresholds_building (building_id),
    INDEX idx_thresholds_equipment (equipment_id),
    INDEX idx_thresholds_enabled (enabled),
    INDEX idx_thresholds_type (parameter_type)
);

-- Alerts table
CREATE TABLE alerts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type ENUM('energy_anomaly', 'power_quality', 'equipment_failure', 'compliance_violation', 'maintenance_due', 'efficiency_degradation', 'threshold_exceeded') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    status ENUM('active', 'acknowledged', 'resolved', 'escalated') DEFAULT 'active',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    building_id INT,
    equipment_id INT,
    audit_id INT,
    energy_reading_id INT,
    pq_reading_id INT,
    threshold_config JSON,
    detected_value DECIMAL(15,6),
    threshold_value DECIMAL(15,6),
    acknowledged_by INT,
    acknowledged_at TIMESTAMP NULL,
    resolved_by INT,
    resolved_at TIMESTAMP NULL,
    escalated_at TIMESTAMP NULL,
    escalation_level INT DEFAULT 0,
    notification_sent BOOLEAN DEFAULT FALSE,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE,
    FOREIGN KEY (energy_reading_id) REFERENCES energy_consumption(id) ON DELETE SET NULL,
    FOREIGN KEY (pq_reading_id) REFERENCES power_quality(id) ON DELETE SET NULL,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_alerts_status (status),
    INDEX idx_alerts_severity (severity),
    INDEX idx_alerts_type (type),
    INDEX idx_alerts_building (building_id),
    INDEX idx_alerts_equipment (equipment_id),
    INDEX idx_alerts_created (created_at),
    INDEX idx_alerts_active (status, created_at),
    INDEX idx_alerts_building_status_severity (building_id, status, severity),
    INDEX idx_alerts_type_created (type, created_at)
);

-- System monitoring logs
CREATE TABLE system_monitoring_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    monitoring_type ENUM('energy_threshold', 'power_quality', 'equipment_health', 'compliance_check', 'anomaly_detection') NOT NULL,
    building_id INT,
    equipment_id INT,
    check_result ENUM('passed', 'warning', 'failed', 'error') NOT NULL,
    details JSON,
    alerts_generated INT DEFAULT 0,
    processing_time_ms INT NOT NULL,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    
    INDEX idx_monitoring_type (monitoring_type),
    INDEX idx_monitoring_building (building_id),
    INDEX idx_monitoring_checked (checked_at),
    INDEX idx_monitoring_result (check_result),
    INDEX idx_monitoring_building_checked (building_id, checked_at)
);

-- =============================================
-- BACKGROUND PROCESSING & ANALYTICS
-- =============================================

-- Background jobs queue
CREATE TABLE background_jobs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_type ENUM('analytics_processing', 'alert_monitoring', 'compliance_check', 'maintenance_prediction', 'forecast_generation') NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    building_id INT,
    equipment_id INT,
    job_parameters JSON,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    result_data JSON,
    error_message TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    
    INDEX idx_jobs_type (job_type),
    INDEX idx_jobs_status (status),
    INDEX idx_jobs_building (building_id),
    INDEX idx_jobs_created (created_at),
    INDEX idx_jobs_status_created (status, created_at)
);

-- Energy baselines for anomaly detection
CREATE TABLE energy_baselines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT NOT NULL,
    baseline_type ENUM('daily', 'weekly', 'monthly', 'seasonal') NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    baseline_consumption DECIMAL(15,6) NOT NULL,
    confidence_interval DECIMAL(5,2) NOT NULL,
    weather_normalized BOOLEAN DEFAULT FALSE,
    occupancy_adjusted BOOLEAN DEFAULT FALSE,
    calculation_method ENUM('average', 'regression', 'machine_learning') NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    
    INDEX idx_baselines_building (building_id),
    INDEX idx_baselines_type (baseline_type),
    INDEX idx_baselines_period (period_start, period_end),
    INDEX idx_baselines_building_type (building_id, baseline_type),
    UNIQUE KEY unique_baseline (building_id, baseline_type, period_start, period_end)
);

-- Power quality events detection
CREATE TABLE power_quality_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT NOT NULL,
    pq_reading_id INT NOT NULL,
    event_type ENUM('sag', 'swell', 'interruption', 'transient', 'harmonic', 'flicker', 'unbalance', 'frequency_deviation') NOT NULL,
    severity ENUM('minor', 'moderate', 'severe', 'critical') NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_ms INT,
    magnitude DECIMAL(15,6),
    itic_curve_violation BOOLEAN DEFAULT FALSE,
    ieee519_violation BOOLEAN DEFAULT FALSE,
    affected_equipment JSON,
    estimated_cost DECIMAL(12,2),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (pq_reading_id) REFERENCES power_quality(id) ON DELETE CASCADE,
    
    INDEX idx_pq_events_building (building_id),
    INDEX idx_pq_events_type (event_type),
    INDEX idx_pq_events_severity (severity),
    INDEX idx_pq_events_time (start_time),
    INDEX idx_pq_events_violations (itic_curve_violation, ieee519_violation),
    INDEX idx_pq_events_building_time (building_id, start_time)
);

-- Maintenance predictions
CREATE TABLE maintenance_predictions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    equipment_id INT NOT NULL,
    prediction_type ENUM('failure', 'maintenance', 'replacement') NOT NULL,
    predicted_date DATE NOT NULL,
    confidence_score DECIMAL(5,2) NOT NULL,
    risk_level ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    contributing_factors JSON NOT NULL,
    recommended_actions JSON NOT NULL,
    estimated_cost DECIMAL(12,2),
    business_impact TEXT,
    model_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    last_calculated TIMESTAMP NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    
    INDEX idx_predictions_equipment (equipment_id),
    INDEX idx_predictions_date (predicted_date),
    INDEX idx_predictions_risk (risk_level),
    INDEX idx_predictions_type (prediction_type),
    INDEX idx_predictions_equipment_date (equipment_id, predicted_date)
);

-- Anomaly detection results
CREATE TABLE anomaly_detections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    detection_type ENUM('energy', 'power_quality', 'equipment') NOT NULL,
    building_id INT,
    equipment_id INT,
    detected_at TIMESTAMP NOT NULL,
    anomaly_score DECIMAL(8,4) NOT NULL,
    threshold_score DECIMAL(8,4) NOT NULL,
    data_point_id INT NOT NULL,
    data_point_type ENUM('energy_consumption', 'power_quality', 'equipment_reading') NOT NULL,
    anomaly_description TEXT NOT NULL,
    expected_value DECIMAL(15,6),
    actual_value DECIMAL(15,6),
    deviation_percentage DECIMAL(8,4),
    investigation_status ENUM('pending', 'investigating', 'resolved', 'false_positive') DEFAULT 'pending',
    root_cause TEXT,
    corrective_action TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    
    INDEX idx_anomalies_type (detection_type),
    INDEX idx_anomalies_building (building_id),
    INDEX idx_anomalies_equipment (equipment_id),
    INDEX idx_anomalies_detected (detected_at),
    INDEX idx_anomalies_score (anomaly_score),
    INDEX idx_anomalies_status (investigation_status),
    INDEX idx_anomalies_building_detected (building_id, detected_at)
);

-- Efficiency analyses
CREATE TABLE efficiency_analyses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT NOT NULL,
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    efficiency_score DECIMAL(5,2) NOT NULL,
    baseline_consumption DECIMAL(15,6) NOT NULL,
    actual_consumption DECIMAL(15,6) NOT NULL,
    savings_kwh DECIMAL(15,6) NOT NULL,
    savings_percentage DECIMAL(8,4) NOT NULL,
    cost_savings DECIMAL(12,2) NOT NULL,
    carbon_reduction_kg DECIMAL(12,2) NOT NULL,
    efficiency_factors JSON NOT NULL,
    recommendations JSON NOT NULL,
    benchmark_comparison JSON,
    weather_impact DECIMAL(8,4),
    occupancy_impact DECIMAL(8,4),
    equipment_performance JSON,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    
    INDEX idx_efficiency_building (building_id),
    INDEX idx_efficiency_period (analysis_period_start, analysis_period_end),
    INDEX idx_efficiency_score (efficiency_score),
    INDEX idx_efficiency_building_period (building_id, analysis_period_start, analysis_period_end)
);

-- Forecast data
CREATE TABLE forecast_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT NOT NULL,
    forecast_type ENUM('consumption', 'demand', 'cost', 'efficiency') NOT NULL,
    forecast_period ENUM('hourly', 'daily', 'weekly', 'monthly') NOT NULL,
    forecast_date DATE NOT NULL,
    predicted_value DECIMAL(15,6) NOT NULL,
    confidence_lower DECIMAL(15,6) NOT NULL,
    confidence_upper DECIMAL(15,6) NOT NULL,
    model_type ENUM('arima', 'neural_network', 'regression', 'ensemble') NOT NULL,
    model_accuracy DECIMAL(5,2) NOT NULL,
    influencing_factors JSON,
    actual_value DECIMAL(15,6),
    forecast_error DECIMAL(8,4),
    created_by_model VARCHAR(100) NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    
    INDEX idx_forecast_building (building_id),
    INDEX idx_forecast_type (forecast_type),
    INDEX idx_forecast_date (forecast_date),
    INDEX idx_forecast_period (forecast_period),
    INDEX idx_forecast_building_date (building_id, forecast_date)
);

-- =============================================
-- COMPLIANCE & AUDIT TABLES
-- =============================================

-- Compliance checks
CREATE TABLE compliance_checks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    audit_id INT NOT NULL,
    standard_type ENUM('PEC2017', 'OSHS', 'ISO25010', 'RA11285') NOT NULL,
    section_code VARCHAR(50) NOT NULL,
    check_description TEXT NOT NULL,
    status ENUM('compliant', 'non_compliant', 'needs_review', 'not_applicable') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    details TEXT,
    corrective_action TEXT,
    due_date DATE,
    responsible_person VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE,
    
    INDEX idx_compliance_audit (audit_id),
    INDEX idx_compliance_standard (standard_type),
    INDEX idx_compliance_status (status),
    INDEX idx_compliance_severity (severity),
    INDEX idx_compliance_section (section_code),
    INDEX idx_compliance_due_date (due_date),
    INDEX idx_compliance_audit_standard (audit_id, standard_type)
);

-- Enhanced compliance analyses
CREATE TABLE compliance_analyses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    audit_id INT NOT NULL,
    analysis_date TIMESTAMP NOT NULL,
    overall_score DECIMAL(5,2) NOT NULL,
    weighted_score DECIMAL(5,2) NOT NULL,
    critical_violations INT DEFAULT 0,
    high_violations INT DEFAULT 0,
    medium_violations INT DEFAULT 0,
    low_violations INT DEFAULT 0,
    improvement_trend DECIMAL(8,4) DEFAULT 0,
    risk_assessment ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    priority_actions JSON,
    compliance_gaps JSON,
    cost_of_compliance DECIMAL(12,2) DEFAULT 0,
    estimated_penalties DECIMAL(12,2) DEFAULT 0,
    certification_status VARCHAR(100),
    next_review_date DATE,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE,
    
    INDEX idx_compliance_audit (audit_id),
    INDEX idx_compliance_score (overall_score),
    INDEX idx_compliance_risk (risk_assessment),
    INDEX idx_compliance_date (analysis_date)
);

-- =============================================
-- MAINTENANCE & EQUIPMENT MANAGEMENT
-- =============================================

-- Equipment maintenance records
CREATE TABLE equipment_maintenance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    equipment_id INT NOT NULL,
    maintenance_type ENUM('preventive', 'corrective', 'predictive', 'emergency') NOT NULL,
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    technician_id INT,
    description TEXT NOT NULL,
    work_performed TEXT,
    parts_used JSON,
    cost DECIMAL(10,2),
    downtime_minutes INT DEFAULT 0,
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    maintenance_notes TEXT,
    next_maintenance_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_maintenance_equipment (equipment_id),
    INDEX idx_maintenance_scheduled (scheduled_date),
    INDEX idx_maintenance_status (status),
    INDEX idx_maintenance_type (maintenance_type),
    INDEX idx_maintenance_technician (technician_id)
);

-- =============================================
-- REPORTING & CACHING
-- =============================================

-- Reports table
CREATE TABLE reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(300) NOT NULL,
    report_type ENUM('energy_consumption', 'power_quality', 'audit_summary', 'compliance', 'monitoring_summary', 'analytics_report') NOT NULL,
    building_id INT,
    audit_id INT,
    generated_by INT NOT NULL,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_size BIGINT,
    parameters JSON,
    data JSON,
    status ENUM('generating', 'completed', 'failed') DEFAULT 'generating',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE RESTRICT,
    
    INDEX idx_reports_type (report_type),
    INDEX idx_reports_building (building_id),
    INDEX idx_reports_audit (audit_id),
    INDEX idx_reports_generated_by (generated_by),
    INDEX idx_reports_status (status),
    INDEX idx_reports_created (created_at)
);

-- Monitoring cache for performance
CREATE TABLE monitoring_stats_cache (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT NOT NULL,
    cache_type ENUM('energy_stats', 'pq_stats', 'alert_summary', 'efficiency_summary', 'equipment_health') NOT NULL,
    cache_data JSON NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    
    INDEX idx_monitoring_cache_building_type (building_id, cache_type),
    INDEX idx_monitoring_cache_expires (expires_at),
    UNIQUE KEY unique_building_cache_type (building_id, cache_type)
);

-- Monitoring configurations
CREATE TABLE monitoring_configurations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building_id INT,
    equipment_id INT,
    config_type ENUM('threshold', 'schedule', 'notification', 'analytics') NOT NULL,
    config_name VARCHAR(100) NOT NULL,
    config_value JSON NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_monitoring_config_building (building_id),
    INDEX idx_monitoring_config_equipment (equipment_id),
    INDEX idx_monitoring_config_type (config_type),
    INDEX idx_monitoring_config_enabled (enabled),
    UNIQUE KEY unique_config (building_id, equipment_id, config_name)
);

-- =============================================
-- VIEWS FOR MONITORING DASHBOARD
-- =============================================

-- Active alerts with context
CREATE OR REPLACE VIEW active_alerts_view AS
SELECT 
    a.*,
    b.name as building_name,
    b.code as building_code,
    e.name as equipment_name,
    e.equipment_type,
    u1.first_name as acknowledged_by_name,
    u2.first_name as resolved_by_name,
    TIMESTAMPDIFF(MINUTE, a.created_at, NOW()) as age_minutes
FROM alerts a
LEFT JOIN buildings b ON a.building_id = b.id
LEFT JOIN equipment e ON a.equipment_id = e.id
LEFT JOIN users u1 ON a.acknowledged_by = u1.id
LEFT JOIN users u2 ON a.resolved_by = u2.id
WHERE a.status IN ('active', 'acknowledged', 'escalated');

-- Equipment with maintenance predictions
CREATE OR REPLACE VIEW equipment_maintenance_view AS
SELECT 
    e.*,
    b.name as building_name,
    mp.prediction_type,
    mp.predicted_date,
    mp.risk_level,
    mp.confidence_score,
    DATEDIFF(mp.predicted_date, CURDATE()) as days_to_maintenance,
    em.scheduled_date as next_scheduled_maintenance
FROM equipment e
LEFT JOIN buildings b ON e.building_id = b.id
LEFT JOIN maintenance_predictions mp ON e.id = mp.equipment_id
    AND mp.id = (
        SELECT id FROM maintenance_predictions mp2 
        WHERE mp2.equipment_id = e.id 
        ORDER BY mp2.created_at DESC 
        LIMIT 1
    )
LEFT JOIN equipment_maintenance em ON e.id = em.equipment_id 
    AND em.status = 'scheduled'
    AND em.scheduled_date = (
        SELECT MIN(scheduled_date) 
        FROM equipment_maintenance 
        WHERE equipment_id = e.id AND status = 'scheduled'
    );

-- Building efficiency with monitoring summary
CREATE OR REPLACE VIEW building_monitoring_summary AS
SELECT 
    b.*,
    ea.efficiency_score,
    ea.savings_kwh,
    ea.cost_savings,
    ea.carbon_reduction_kg,
    ca.overall_score as compliance_score,
    ca.risk_assessment as compliance_risk,
    alert_stats.active_alerts,
    alert_stats.critical_alerts,
    alert_stats.high_alerts,
    eq_stats.total_equipment,
    eq_stats.faulty_equipment,
    ec_latest.latest_consumption,
    ec_latest.latest_power_factor,
    pq_latest.latest_thd_voltage,
    pq_latest.latest_voltage_unbalance
FROM buildings b
LEFT JOIN efficiency_analyses ea ON b.id = ea.building_id 
    AND ea.id = (
        SELECT id FROM efficiency_analyses ea2 
        WHERE ea2.building_id = b.id 
        ORDER BY ea2.created_at DESC 
        LIMIT 1
    )
LEFT JOIN compliance_analyses ca ON ca.audit_id = (
    SELECT a.id FROM audits a 
    WHERE a.building_id = b.id 
    ORDER BY a.created_at DESC 
    LIMIT 1
)
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
        building_id, 
        consumption_kwh as latest_consumption,
        power_factor as latest_power_factor,
        ROW_NUMBER() OVER (PARTITION BY building_id ORDER BY recorded_at DESC) as rn
    FROM energy_consumption
) ec_latest ON b.id = ec_latest.building_id AND ec_latest.rn = 1
LEFT JOIN (
    SELECT 
        building_id, 
        thd_voltage as latest_thd_voltage,
        voltage_unbalance as latest_voltage_unbalance,
        ROW_NUMBER() OVER (PARTITION BY building_id ORDER BY recorded_at DESC) as rn
    FROM power_quality
) pq_latest ON b.id = pq_latest.building_id AND pq_latest.rn = 1;

-- Monitoring dashboard summary
CREATE OR REPLACE VIEW monitoring_dashboard_summary AS
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

-- Recent monitoring activities
CREATE OR REPLACE VIEW recent_monitoring_activities AS
SELECT 
    sml.id,
    sml.monitoring_type,
    sml.building_id,
    b.name as building_name,
    sml.equipment_id,
    e.name as equipment_name,
    sml.check_result,
    sml.alerts_generated,
    sml.processing_time_ms,
    sml.checked_at,
    sml.details
FROM system_monitoring_logs sml
LEFT JOIN buildings b ON sml.building_id = b.id
LEFT JOIN equipment e ON sml.equipment_id = e.id
WHERE sml.checked_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY sml.checked_at DESC
LIMIT 100;

-- =============================================
-- STORED PROCEDURES FOR MONITORING
-- =============================================

DELIMITER $$

-- Calculate building efficiency with monitoring integration
CREATE PROCEDURE CalculateBuildingEfficiencyWithMonitoring(
    IN p_building_id INT, 
    IN start_date DATE, 
    IN end_date DATE
)
BEGIN
    DECLARE total_consumption DECIMAL(15,6) DEFAULT 0;
    DECLARE avg_power_factor DECIMAL(4,3) DEFAULT 0;
    DECLARE efficiency_score DECIMAL(5,2) DEFAULT 0;
    DECLARE alert_count INT DEFAULT 0;
    DECLARE pq_issues INT DEFAULT 0;
    
    -- Calculate energy metrics
    SELECT 
        COALESCE(SUM(consumption_kwh), 0),
        COALESCE(AVG(power_factor), 0)
    INTO total_consumption, avg_power_factor
    FROM energy_consumption 
    WHERE building_id = p_building_id 
    AND DATE(recorded_at) BETWEEN start_date AND end_date;
    
    -- Count monitoring alerts
    SELECT COUNT(*) INTO alert_count
    FROM alerts 
    WHERE building_id = p_building_id 
    AND DATE(created_at) BETWEEN start_date AND end_date
    AND type IN ('energy_anomaly', 'threshold_exceeded');
    
    -- Count power quality issues
    SELECT COUNT(*) INTO pq_issues
    FROM power_quality_events 
    WHERE building_id = p_building_id 
    AND DATE(start_time) BETWEEN start_date AND end_date
    AND severity IN ('severe', 'critical');
    
    -- Calculate efficiency score with monitoring penalties
    SET efficiency_score = CASE 
        WHEN avg_power_factor >= 0.95 AND alert_count = 0 THEN 100
        WHEN avg_power_factor >= 0.90 AND alert_count <= 2 THEN 85
        WHEN avg_power_factor >= 0.85 AND alert_count <= 5 THEN 70
        ELSE 50
    END;
    
    -- Apply penalties for PQ issues
    SET efficiency_score = efficiency_score - (pq_issues * 5);
    SET efficiency_score = GREATEST(efficiency_score, 0);
    
    SELECT 
        p_building_id as building_id,
        total_consumption,
        avg_power_factor,
        efficiency_score,
        alert_count,
        pq_issues;
END$$

-- Get comprehensive equipment health
CREATE PROCEDURE GetEquipmentHealthWithPredictions(IN p_building_id INT)
BEGIN
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
        alert_count.alerts_count,
        CASE 
            WHEN em.scheduled_date <= CURDATE() THEN 'OVERDUE'
            WHEN em.scheduled_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'DUE_SOON'
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
        CASE health_status
            WHEN 'OVERDUE' THEN 1
            WHEN 'DUE_SOON' THEN 2
            WHEN 'HIGH_RISK' THEN 3
            WHEN 'ALERTS_ACTIVE' THEN 4
            ELSE 5
        END;
END$$

DELIMITER ;

-- =============================================
-- TRIGGERS FOR REAL-TIME MONITORING
-- =============================================

DELIMITER $$

-- Trigger for energy consumption monitoring
CREATE TRIGGER after_energy_reading_insert
AFTER INSERT ON energy_consumption
FOR EACH ROW
BEGIN
    DECLARE alert_needed BOOLEAN DEFAULT FALSE;
    DECLARE alert_type VARCHAR(50);
    DECLARE alert_message TEXT;
    DECLARE alert_severity VARCHAR(20);
    
    -- Check power factor threshold
    IF NEW.power_factor IS NOT NULL AND NEW.power_factor < 0.85 THEN
        SET alert_needed = TRUE;
        SET alert_type = 'threshold_exceeded';
        SET alert_severity = CASE 
            WHEN NEW.power_factor < 0.80 THEN 'high'
            ELSE 'medium'
        END;
        SET alert_message = CONCAT('Low power factor detected: ', NEW.power_factor);
        
        INSERT INTO alerts (type, severity, title, message, building_id, energy_reading_id, detected_value, threshold_value)
        VALUES (alert_type, alert_severity, 'Low Power Factor Alert', alert_message, NEW.building_id, NEW.id, NEW.power_factor, 0.85);
    END IF;
    
    -- Check high consumption (basic threshold - should be configurable)
    IF NEW.consumption_kwh > 1000 THEN
        INSERT INTO alerts (type, severity, title, message, building_id, energy_reading_id, detected_value, threshold_value)
        VALUES ('energy_anomaly', 'medium', 'High Energy Consumption', 
                CONCAT('High consumption detected: ', NEW.consumption_kwh, ' kWh'), 
                NEW.building_id, NEW.id, NEW.consumption_kwh, 1000);
    END IF;
    
    -- Log monitoring activity
    INSERT INTO system_monitoring_logs (
        monitoring_type, building_id, check_result, details, alerts_generated, processing_time_ms
    ) VALUES (
        'energy_threshold', NEW.building_id, 
        CASE WHEN alert_needed THEN 'warning' ELSE 'passed' END,
        JSON_OBJECT('reading_id', NEW.id, 'consumption_kwh', NEW.consumption_kwh, 'power_factor', NEW.power_factor),
        CASE WHEN alert_needed THEN 1 ELSE 0 END,
        0
    );
END$$

-- Trigger for power quality monitoring
CREATE TRIGGER after_power_quality_insert
AFTER INSERT ON power_quality
FOR EACH ROW
BEGIN
    DECLARE alerts_generated INT DEFAULT 0;
    
    -- Check THD voltage threshold
    IF NEW.thd_voltage IS NOT NULL AND NEW.thd_voltage > 8.0 THEN
        INSERT INTO alerts (type, severity, title, message, building_id, pq_reading_id, detected_value, threshold_value)
        VALUES ('power_quality', 'high', 'High THD Voltage', 
                CONCAT('THD voltage exceeds IEEE standards: ', NEW.thd_voltage, '%'), 
                NEW.building_id, NEW.id, NEW.thd_voltage, 8.0);
        SET alerts_generated = alerts_generated + 1;
    END IF;
    
    -- Check voltage unbalance
    IF NEW.voltage_unbalance IS NOT NULL AND NEW.voltage_unbalance > 3.0 THEN
        INSERT INTO alerts (type, severity, title, message, building_id, pq_reading_id, detected_value, threshold_value)
        VALUES ('power_quality', 'medium', 'Voltage Unbalance', 
                CONCAT('Voltage unbalance exceeds limit: ', NEW.voltage_unbalance, '%'), 
                NEW.building_id, NEW.id, NEW.voltage_unbalance, 3.0);
        SET alerts_generated = alerts_generated + 1;
        
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
        JSON_OBJECT('reading_id', NEW.id, 'thd_voltage', NEW.thd_voltage, 'voltage_unbalance', NEW.voltage_unbalance),
        alerts_generated,
        0
    );
END$$

-- Trigger for equipment status monitoring
CREATE TRIGGER after_equipment_status_update
AFTER UPDATE ON equipment
FOR EACH ROW
BEGIN
    -- Alert on equipment failure
    IF NEW.status = 'faulty' AND OLD.status != 'faulty' THEN
        INSERT INTO alerts (type, severity, title, message, building_id, equipment_id)
        VALUES ('equipment_failure', 'critical', 'Equipment Failure Alert', 
                CONCAT('Equipment failure detected: ', NEW.name), 
                NEW.building_id, NEW.id);
                
        -- Log monitoring activity
        INSERT INTO system_monitoring_logs (
            monitoring_type, building_id, equipment_id, check_result, details, alerts_generated, processing_time_ms
        ) VALUES (
            'equipment_health', NEW.building_id, NEW.id, 'failed',
            JSON_OBJECT('equipment_name', NEW.name, 'old_status', OLD.status, 'new_status', NEW.status),
            1, 0
        );
    END IF;
END$$

DELIMITER ;

-- =============================================
-- AUTOMATED MAINTENANCE EVENTS
-- =============================================

DELIMITER $$

-- Cleanup old monitoring data
CREATE EVENT cleanup_monitoring_data
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
ON COMPLETION PRESERVE
ENABLE
DO
BEGIN
    -- Clean old monitoring logs (keep 30 days)
    DELETE FROM system_monitoring_logs 
    WHERE checked_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Clean completed background jobs (keep 30 days)
    DELETE FROM background_jobs 
    WHERE status = 'completed' 
    AND completed_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Clean resolved alerts (keep 180 days)
    DELETE FROM alerts 
    WHERE status = 'resolved' 
    AND resolved_at < DATE_SUB(NOW(), INTERVAL 180 DAY);
    
    -- Clean expired cache entries
    DELETE FROM monitoring_stats_cache 
    WHERE expires_at < NOW();
    
    -- Clean old power quality events (keep 1 year)
    DELETE FROM power_quality_events 
    WHERE start_time < DATE_SUB(NOW(), INTERVAL 1 YEAR);
    
    -- Clean old anomaly detections (keep 6 months)
    DELETE FROM anomaly_detections 
    WHERE detected_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)
    AND investigation_status = 'resolved';
END$$

-- Process alert escalations
CREATE EVENT process_alert_escalations
ON SCHEDULE EVERY 5 MINUTE
STARTS CURRENT_TIMESTAMP
ON COMPLETION PRESERVE
ENABLE
DO
BEGIN
    -- Escalate unacknowledged alerts
    UPDATE alerts 
    SET status = 'escalated', 
        escalated_at = CURRENT_TIMESTAMP,
        escalation_level = COALESCE(escalation_level, 0) + 1
    WHERE status = 'active' 
    AND acknowledged_at IS NULL 
    AND created_at <= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
    AND escalation_level < 3;
    
    -- Auto-resolve low severity alerts after 24 hours if no action
    UPDATE alerts 
    SET status = 'resolved',
        resolved_at = CURRENT_TIMESTAMP
    WHERE status = 'active'
    AND severity = 'low'
    AND acknowledged_at IS NULL
    AND created_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR);
END$$

-- Generate maintenance predictions periodically
CREATE EVENT generate_maintenance_predictions
ON SCHEDULE EVERY 6 HOUR
STARTS CURRENT_TIMESTAMP
ON COMPLETION PRESERVE
ENABLE
DO
BEGIN
    -- Insert background job for maintenance prediction
    INSERT INTO background_jobs (job_type, job_parameters)
    VALUES ('maintenance_prediction', JSON_OBJECT('schedule', 'automatic'));
END$$

DELIMITER ;

-- =============================================
-- INITIAL DATA SETUP
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

-- Insert default alert thresholds
INSERT INTO alert_thresholds (
    parameter_name, parameter_type, max_value, threshold_type, severity, enabled
) VALUES 
('power_factor', 'energy', 0.85, 'absolute', 'medium', TRUE),
('power_factor_critical', 'energy', 0.80, 'absolute', 'high', TRUE),
('consumption_high', 'energy', 1000, 'absolute', 'medium', TRUE),
('thd_voltage', 'power_quality', 8.0, 'absolute', 'high', TRUE),
('thd_current', 'power_quality', 15.0, 'absolute', 'medium', TRUE),
('voltage_unbalance', 'power_quality', 3.0, 'absolute', 'medium', TRUE),
('current_unbalance', 'power_quality', 10.0, 'absolute', 'medium', TRUE),
('frequency_high', 'power_quality', 50.5, 'absolute', 'high', TRUE),
('frequency_low', 'power_quality', 49.5, 'absolute', 'high', TRUE);

-- Insert monitoring configurations
INSERT INTO monitoring_configurations (building_id, config_type, config_name, config_value, enabled) VALUES 
(NULL, 'threshold', 'energy_power_factor_warning', JSON_OBJECT('threshold', 0.85, 'severity', 'medium'), TRUE),
(NULL, 'threshold', 'energy_power_factor_critical', JSON_OBJECT('threshold', 0.80, 'severity', 'high'), TRUE),
(NULL, 'threshold', 'energy_consumption_high', JSON_OBJECT('threshold', 1000, 'severity', 'medium'), TRUE),
(NULL, 'threshold', 'pq_thd_voltage_high', JSON_OBJECT('threshold', 8.0, 'severity', 'high'), TRUE),
(NULL, 'threshold', 'pq_voltage_unbalance_high', JSON_OBJECT('threshold', 3.0, 'severity', 'medium'), TRUE),
(NULL, 'schedule', 'anomaly_detection_interval', JSON_OBJECT('interval_hours', 1, 'min_readings', 10), TRUE),
(NULL, 'schedule', 'efficiency_analysis_interval', JSON_OBJECT('interval_hours', 24, 'min_readings', 24), TRUE),
(NULL, 'notification', 'alert_email_admins', JSON_OBJECT('emails', JSON_ARRAY('admin@uclm.edu.ph', 'energy.manager@uclm.edu.ph')), TRUE),
(NULL, 'analytics', 'baseline_calculation_method', JSON_OBJECT('method', 'average', 'confidence', 0.95), TRUE);

-- Insert sample audits
INSERT INTO audits (building_id, auditor_id, audit_type, title, status, priority, scheduled_date) VALUES 
(1, 1, 'comprehensive', 'Q1 2024 Comprehensive Energy Audit - MAB', 'completed', 'high', '2024-01-15'),
(2, 2, 'energy_efficiency', 'Engineering Building Energy Efficiency Assessment', 'in_progress', 'medium', '2024-02-01'),
(3, 1, 'power_quality', 'Administration Building Power Quality Analysis', 'scheduled', 'medium', '2024-02-15');

-- Insert sample compliance checks for the completed audit
INSERT INTO compliance_checks (audit_id, standard_type, section_code, check_description, status, severity) VALUES 
(1, 'PEC2017', 'SEC-220-1', 'Grounding system integrity check', 'compliant', 'high'),
(1, 'PEC2017', 'SEC-220-2', 'Circuit protection verification', 'compliant', 'medium'),
(1, 'OSHS', 'ELEC-001', 'Electrical safety signage', 'non_compliant', 'medium'),
(1, 'RA11285', 'ENERGY-001', 'Energy manager designation', 'compliant', 'high'),
(1, 'ISO25010', 'SOFT-001', 'System uptime monitoring', 'needs_review', 'low');

-- Insert sample energy consumption data (last 7 days)
INSERT INTO energy_consumption (building_id, consumption_kwh, cost_php, recorded_at, power_factor, energy_type) VALUES 
-- MAB Building
(1, 1250.5, 15000.60, DATE_SUB(NOW(), INTERVAL 6 DAY), 0.92, 'total'),
(1, 1180.3, 14163.60, DATE_SUB(NOW(), INTERVAL 5 DAY), 0.89, 'total'),
(1, 1350.8, 16209.60, DATE_SUB(NOW(), INTERVAL 4 DAY), 0.91, 'total'),
(1, 1290.2, 15482.40, DATE_SUB(NOW(), INTERVAL 3 DAY), 0.88, 'total'),
(1, 1220.7, 14648.40, DATE_SUB(NOW(), INTERVAL 2 DAY), 0.93, 'total'),
(1, 1380.9, 16570.80, DATE_SUB(NOW(), INTERVAL 1 DAY), 0.87, 'total'),
(1, 1155.4, 13864.80, NOW(), 0.94, 'total'),
-- Engineering Building
(2, 890.2, 10682.40, DATE_SUB(NOW(), INTERVAL 6 DAY), 0.88, 'total'),
(2, 920.5, 11046.00, DATE_SUB(NOW(), INTERVAL 5 DAY), 0.86, 'total'),
(2, 875.3, 10503.60, DATE_SUB(NOW(), INTERVAL 4 DAY), 0.90, 'total'),
(2, 940.8, 11289.60, DATE_SUB(NOW(), INTERVAL 3 DAY), 0.85, 'total'),
(2, 905.1, 10861.20, DATE_SUB(NOW(), INTERVAL 2 DAY), 0.89, 'total'),
(2, 960.4, 11524.80, DATE_SUB(NOW(), INTERVAL 1 DAY), 0.84, 'total'),
(2, 885.7, 10628.40, NOW(), 0.91, 'total');

-- Insert sample power quality data
INSERT INTO power_quality (building_id, voltage_l1, voltage_l2, voltage_l3, thd_voltage, thd_current, frequency, power_factor, voltage_unbalance, recorded_at) VALUES 
(1, 230.2, 229.8, 230.5, 5.2, 8.1, 50.02, 0.92, 1.8, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(1, 229.9, 230.1, 230.3, 6.8, 9.2, 49.98, 0.89, 2.1, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(1, 230.8, 229.5, 230.2, 7.5, 10.5, 50.05, 0.87, 2.8, NOW()),
(2, 228.9, 229.2, 230.8, 8.5, 12.3, 49.95, 0.85, 3.2, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(2, 229.1, 230.5, 229.8, 9.2, 14.8, 50.08, 0.84, 3.8, NOW());

-- =============================================
-- VERIFICATION & FINAL SETUP
-- =============================================

-- Verify installation
SELECT 'Database schema installation completed successfully!' as status;

-- Show table summary
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size (MB)',
    TABLE_COMMENT
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'uclm_energy_audit'
AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Show monitoring system components
SELECT 'Monitoring System Components:' as info;
SELECT 
    'Core Tables' as component_type,
    COUNT(*) as count
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'uclm_energy_audit'
AND TABLE_NAME IN ('users', 'buildings', 'equipment', 'energy_consumption', 'power_quality')

UNION ALL

SELECT 
    'Monitoring Tables' as component_type,
    COUNT(*) as count
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'uclm_energy_audit'
AND TABLE_NAME IN ('alerts', 'alert_thresholds', 'system_monitoring_logs', 'monitoring_configurations')

UNION ALL

SELECT 
    'Analytics Tables' as component_type,
    COUNT(*) as count
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'uclm_energy_audit'
AND TABLE_NAME IN ('background_jobs', 'anomaly_detections', 'efficiency_analyses', 'forecast_data', 'maintenance_predictions')

UNION ALL

SELECT 
    'Views' as component_type,
    COUNT(*) as count
FROM information_schema.VIEWS 
WHERE TABLE_SCHEMA = 'uclm_energy_audit'

UNION ALL

SELECT 
    'Triggers' as component_type,
    COUNT(*) as count
FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = 'uclm_energy_audit'

UNION ALL

SELECT 
    'Events' as component_type,
    COUNT(*) as count
FROM information_schema.EVENTS 
WHERE EVENT_SCHEMA = 'uclm_energy_audit'

UNION ALL

SELECT 
    'Procedures' as component_type,
    COUNT(*) as count
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = 'uclm_energy_audit'
AND ROUTINE_TYPE = 'PROCEDURE';

-- Show sample data counts
SELECT 'Sample Data Summary:' as info;
SELECT 'Buildings' as table_name, COUNT(*) as records FROM buildings
UNION ALL SELECT 'Users', COUNT(*) FROM users
UNION ALL SELECT 'Equipment', COUNT(*) FROM equipment
UNION ALL SELECT 'Energy Readings', COUNT(*) FROM energy_consumption
UNION ALL SELECT 'Power Quality Readings', COUNT(*) FROM power_quality
UNION ALL SELECT 'Alert Thresholds', COUNT(*) FROM alert_thresholds
UNION ALL SELECT 'Monitoring Configs', COUNT(*) FROM monitoring_configurations
UNION ALL SELECT 'Audits', COUNT(*) FROM audits
UNION ALL SELECT 'Compliance Checks', COUNT(*) FROM compliance_checks;

-- Final status
SELECT 
    'UCLM Energy Audit Platform Database' as system_name,
    'v3.0 - Complete with Real-time Monitoring' as version,
    NOW() as installation_date,
    'Ready for production use' as status;
    
-- =============================================
-- MISSING FUNCTIONS AND PROCEDURES FROM ORIGINAL SCHEMA
-- Add these to the complete schema to maintain compatibility
-- =============================================

USE uclm_energy_audit;

-- =============================================
-- ORIGINAL FUNCTIONS (RESTORED)
-- =============================================

DELIMITER $$

-- Function to calculate power factor from energy data (ORIGINAL)
CREATE FUNCTION CalculatePowerFactor(real_power DECIMAL(10,4), apparent_power DECIMAL(10,4))
RETURNS DECIMAL(4,3)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE power_factor DECIMAL(4,3) DEFAULT 0;
    
    IF apparent_power > 0 THEN
        SET power_factor = real_power / apparent_power;
        IF power_factor > 1 THEN
            SET power_factor = 1;
        END IF;
    END IF;
    
    RETURN power_factor;
END$$

-- Function to determine compliance risk level (ORIGINAL)
CREATE FUNCTION GetComplianceRiskLevel(critical_violations INT, high_violations INT, medium_violations INT)
RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE risk_level VARCHAR(20) DEFAULT 'low';
    
    IF critical_violations > 0 THEN
        SET risk_level = 'critical';
    ELSEIF high_violations > 2 THEN
        SET risk_level = 'high';
    ELSEIF high_violations > 0 OR medium_violations > 5 THEN
        SET risk_level = 'medium';
    END IF;
    
    RETURN risk_level;
END$$

-- =============================================
-- ORIGINAL STORED PROCEDURES (RESTORED)
-- =============================================

-- Original building efficiency calculation (RESTORED)
CREATE PROCEDURE CalculateBuildingEfficiency(IN p_building_id INT, IN start_date DATE, IN end_date DATE)
BEGIN
    DECLARE total_consumption DECIMAL(15,6) DEFAULT 0;
    DECLARE avg_power_factor DECIMAL(4,3) DEFAULT 0;
    DECLARE efficiency_score DECIMAL(5,2) DEFAULT 0;
    
    -- Calculate total consumption and average power factor
    SELECT 
        COALESCE(SUM(consumption_kwh), 0),
        COALESCE(AVG(power_factor), 0)
    INTO total_consumption, avg_power_factor
    FROM energy_consumption 
    WHERE building_id = p_building_id 
    AND DATE(recorded_at) BETWEEN start_date AND end_date;
    
    -- Calculate efficiency score
    SET efficiency_score = CASE 
        WHEN avg_power_factor >= 0.95 THEN 100
        WHEN avg_power_factor >= 0.90 THEN 85
        WHEN avg_power_factor >= 0.85 THEN 70
        ELSE 50
    END;
    
    SELECT 
        p_building_id as building_id,
        total_consumption,
        avg_power_factor,
        efficiency_score;
END$$

-- Original equipment maintenance summary (RESTORED)
CREATE PROCEDURE GetEquipmentMaintenanceSummary(IN p_building_id INT)
BEGIN
    SELECT 
        e.id,
        e.name,
        e.equipment_type,
        e.status,
        e.maintenance_schedule,
        em.scheduled_date as next_maintenance,
        mp.predicted_date as predicted_maintenance,
        mp.risk_level,
        CASE 
            WHEN em.scheduled_date <= CURDATE() THEN 'OVERDUE'
            WHEN em.scheduled_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'DUE_SOON'
            WHEN mp.risk_level = 'critical' THEN 'HIGH_RISK'
            ELSE 'NORMAL'
        END as maintenance_status
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
    WHERE e.building_id = p_building_id
    ORDER BY 
        CASE maintenance_status
            WHEN 'OVERDUE' THEN 1
            WHEN 'DUE_SOON' THEN 2
            WHEN 'HIGH_RISK' THEN 3
            ELSE 4
        END;
END$$

-- =============================================
-- ADDITIONAL MISSING VIEWS FROM ORIGINAL
-- =============================================

-- Building efficiency view (ENHANCED from original)
CREATE OR REPLACE VIEW building_efficiency_view AS
SELECT 
    b.*,
    ea.efficiency_score,
    ea.savings_kwh,
    ea.cost_savings,
    ea.carbon_reduction_kg,
    ca.overall_score as compliance_score,
    ca.risk_assessment as compliance_risk,
    -- Add monitoring data
    alert_stats.active_alerts,
    alert_stats.critical_alerts,
    ec_stats.avg_consumption,
    ec_stats.avg_power_factor,
    pq_stats.avg_thd_voltage,
    pq_stats.voltage_unbalance_events
FROM buildings b
LEFT JOIN efficiency_analyses ea ON b.id = ea.building_id 
    AND ea.id = (
        SELECT id FROM efficiency_analyses ea2 
        WHERE ea2.building_id = b.id 
        ORDER BY ea2.created_at DESC 
        LIMIT 1
    )
LEFT JOIN compliance_analyses ca ON ca.audit_id = (
    SELECT a.id FROM audits a 
    WHERE a.building_id = b.id 
    ORDER BY a.created_at DESC 
    LIMIT 1
)
LEFT JOIN (
    SELECT 
        building_id,
        COUNT(*) as active_alerts,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_alerts
    FROM alerts 
    WHERE status = 'active'
    GROUP BY building_id
) alert_stats ON b.id = alert_stats.building_id
LEFT JOIN (
    SELECT 
        building_id,
        AVG(consumption_kwh) as avg_consumption,
        AVG(power_factor) as avg_power_factor
    FROM energy_consumption 
    WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY building_id
) ec_stats ON b.id = ec_stats.building_id
LEFT JOIN (
    SELECT 
        building_id,
        AVG(thd_voltage) as avg_thd_voltage,
        COUNT(CASE WHEN voltage_unbalance > 3.0 THEN 1 END) as voltage_unbalance_events
    FROM power_quality 
    WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY building_id
) pq_stats ON b.id = pq_stats.building_id;

-- Current energy summary view (ENHANCED from original)
CREATE OR REPLACE VIEW current_energy_summary AS
SELECT 
    b.id as building_id,
    b.name as building_name,
    b.code as building_code,
    b.status as building_status,
    ec_latest.consumption_kwh as latest_consumption,
    ec_latest.recorded_at as latest_reading_time,
    ec_latest.power_factor as latest_power_factor,
    ec_daily.daily_consumption,
    ec_monthly.monthly_consumption,
    ec_avg.avg_consumption_30d,
    pq_latest.power_factor as latest_pq_power_factor,
    pq_latest.thd_voltage as latest_thd_voltage,
    pq_latest.voltage_unbalance as latest_voltage_unbalance,
    -- Add alert information
    alert_summary.active_alerts,
    alert_summary.critical_alerts,
    -- Add efficiency information
    eff_latest.efficiency_score as latest_efficiency_score
FROM buildings b
LEFT JOIN (
    SELECT building_id, consumption_kwh, recorded_at, power_factor,
           ROW_NUMBER() OVER (PARTITION BY building_id ORDER BY recorded_at DESC) as rn
    FROM energy_consumption
) ec_latest ON b.id = ec_latest.building_id AND ec_latest.rn = 1
LEFT JOIN (
    SELECT building_id, SUM(consumption_kwh) as daily_consumption
    FROM energy_consumption 
    WHERE DATE(recorded_at) = CURDATE()
    GROUP BY building_id
) ec_daily ON b.id = ec_daily.building_id
LEFT JOIN (
    SELECT building_id, SUM(consumption_kwh) as monthly_consumption
    FROM energy_consumption 
    WHERE YEAR(recorded_at) = YEAR(CURDATE()) 
    AND MONTH(recorded_at) = MONTH(CURDATE())
    GROUP BY building_id
) ec_monthly ON b.id = ec_monthly.building_id
LEFT JOIN (
    SELECT building_id, AVG(consumption_kwh) as avg_consumption_30d
    FROM energy_consumption 
    WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY building_id
) ec_avg ON b.id = ec_avg.building_id
LEFT JOIN (
    SELECT building_id, power_factor, thd_voltage, voltage_unbalance,
           ROW_NUMBER() OVER (PARTITION BY building_id ORDER BY recorded_at DESC) as rn
    FROM power_quality
) pq_latest ON b.id = pq_latest.building_id AND pq_latest.rn = 1
LEFT JOIN (
    SELECT 
        building_id,
        COUNT(*) as active_alerts,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_alerts
    FROM alerts 
    WHERE status = 'active'
    GROUP BY building_id
) alert_summary ON b.id = alert_summary.building_id
LEFT JOIN (
    SELECT building_id, efficiency_score,
           ROW_NUMBER() OVER (PARTITION BY building_id ORDER BY created_at DESC) as rn
    FROM efficiency_analyses
) eff_latest ON b.id = eff_latest.building_id AND eff_latest.rn = 1;

-- =============================================
-- ADDITIONAL UTILITY FUNCTIONS
-- =============================================

-- Function to calculate energy cost (NEW - utility function)
CREATE FUNCTION CalculateEnergyCost(consumption_kwh DECIMAL(12,4), rate_per_kwh DECIMAL(8,4))
RETURNS DECIMAL(12,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE cost DECIMAL(12,2) DEFAULT 0;
    
    IF consumption_kwh > 0 AND rate_per_kwh > 0 THEN
        SET cost = consumption_kwh * rate_per_kwh;
    END IF;
    
    RETURN cost;
END$$

-- Function to determine equipment health status (NEW)
CREATE FUNCTION GetEquipmentHealthStatus(
    equipment_status VARCHAR(20), 
    maintenance_overdue_days INT, 
    active_alerts INT
)
RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE health_status VARCHAR(20) DEFAULT 'NORMAL';
    
    IF equipment_status = 'faulty' THEN
        SET health_status = 'CRITICAL';
    ELSEIF equipment_status = 'maintenance' THEN
        SET health_status = 'MAINTENANCE';
    ELSEIF active_alerts > 0 THEN
        SET health_status = 'ALERTS';
    ELSEIF maintenance_overdue_days > 0 THEN
        SET health_status = 'OVERDUE';
    ELSEIF maintenance_overdue_days BETWEEN -7 AND 0 THEN
        SET health_status = 'DUE_SOON';
    END IF;
    
    RETURN health_status;
END$$

-- Function to calculate THD compliance (NEW)
CREATE FUNCTION CheckTHDCompliance(thd_voltage DECIMAL(6,3), thd_current DECIMAL(6,3))
RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE compliance_status VARCHAR(20) DEFAULT 'COMPLIANT';
    
    -- IEEE 519 standards: THD voltage <= 8%, THD current <= 15%
    IF thd_voltage > 8.0 OR thd_current > 15.0 THEN
        SET compliance_status = 'NON_COMPLIANT';
    ELSEIF thd_voltage > 5.0 OR thd_current > 10.0 THEN
        SET compliance_status = 'WARNING';
    END IF;
    
    RETURN compliance_status;
END$$

-- Function to calculate carbon footprint (NEW)
CREATE FUNCTION CalculateCarbonFootprint(consumption_kwh DECIMAL(12,4), emission_factor DECIMAL(8,6))
RETURNS DECIMAL(12,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE carbon_kg DECIMAL(12,2) DEFAULT 0;
    
    -- Default emission factor for Philippines: 0.7122 kg CO2/kWh (if not provided)
    IF emission_factor IS NULL OR emission_factor <= 0 THEN
        SET emission_factor = 0.7122;
    END IF;
    
    IF consumption_kwh > 0 THEN
        SET carbon_kg = consumption_kwh * emission_factor;
    END IF;
    
    RETURN carbon_kg;
END$$

DELIMITER ;

-- =============================================
-- ADDITIONAL STORED PROCEDURES FOR COMPATIBILITY
-- =============================================

DELIMITER $$

-- Procedure to get building statistics (ENHANCED)
CREATE PROCEDURE GetBuildingStatistics(IN p_building_id INT)
BEGIN
    SELECT 
        b.id,
        b.name,
        b.code,
        b.area_sqm,
        b.status,
        -- Energy statistics
        ec_stats.total_consumption_30d,
        ec_stats.avg_consumption_30d,
        ec_stats.avg_power_factor_30d,
        ec_stats.peak_demand_30d,
        -- Power quality statistics
        pq_stats.avg_thd_voltage_30d,
        pq_stats.avg_voltage_unbalance_30d,
        pq_stats.pq_events_count_30d,
        -- Equipment statistics
        eq_stats.total_equipment,
        eq_stats.active_equipment,
        eq_stats.faulty_equipment,
        eq_stats.maintenance_due,
        -- Alert statistics
        alert_stats.active_alerts,
        alert_stats.critical_alerts,
        alert_stats.alerts_30d,
        -- Efficiency metrics
        eff_stats.latest_efficiency_score,
        eff_stats.carbon_footprint_30d,
        -- Compliance information
        comp_stats.latest_compliance_score,
        comp_stats.compliance_risk
    FROM buildings b
    LEFT JOIN (
        SELECT 
            building_id,
            SUM(consumption_kwh) as total_consumption_30d,
            AVG(consumption_kwh) as avg_consumption_30d,
            AVG(power_factor) as avg_power_factor_30d,
            MAX(demand_kw) as peak_demand_30d
        FROM energy_consumption 
        WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY building_id
    ) ec_stats ON b.id = ec_stats.building_id
    LEFT JOIN (
        SELECT 
            building_id,
            AVG(thd_voltage) as avg_thd_voltage_30d,
            AVG(voltage_unbalance) as avg_voltage_unbalance_30d,
            (SELECT COUNT(*) FROM power_quality_events WHERE building_id = pq.building_id AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as pq_events_count_30d
        FROM power_quality pq
        WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY building_id
    ) pq_stats ON b.id = pq_stats.building_id
    LEFT JOIN (
        SELECT 
            building_id,
            COUNT(*) as total_equipment,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_equipment,
            SUM(CASE WHEN status = 'faulty' THEN 1 ELSE 0 END) as faulty_equipment,
            (SELECT COUNT(*) FROM equipment_maintenance em WHERE em.equipment_id IN (SELECT id FROM equipment WHERE building_id = e.building_id) AND em.scheduled_date <= CURDATE() AND em.status = 'scheduled') as maintenance_due
        FROM equipment e
        GROUP BY building_id
    ) eq_stats ON b.id = eq_stats.building_id
    LEFT JOIN (
        SELECT 
            building_id,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_alerts,
            SUM(CASE WHEN status = 'active' AND severity = 'critical' THEN 1 ELSE 0 END) as critical_alerts,
            COUNT(*) as alerts_30d
        FROM alerts 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY building_id
    ) alert_stats ON b.id = alert_stats.building_id
    LEFT JOIN (
        SELECT 
            building_id,
            efficiency_score as latest_efficiency_score,
            carbon_reduction_kg as carbon_footprint_30d
        FROM efficiency_analyses ea
        WHERE ea.id = (SELECT id FROM efficiency_analyses WHERE building_id = ea.building_id ORDER BY created_at DESC LIMIT 1)
    ) eff_stats ON b.id = eff_stats.building_id
    LEFT JOIN (
        SELECT 
            a.building_id,
            ca.overall_score as latest_compliance_score,
            ca.risk_assessment as compliance_risk
        FROM compliance_analyses ca
        JOIN audits a ON ca.audit_id = a.id
        WHERE ca.id = (SELECT id FROM compliance_analyses ca2 JOIN audits a2 ON ca2.audit_id = a2.id WHERE a2.building_id = a.building_id ORDER BY ca2.created_at DESC LIMIT 1)
    ) comp_stats ON b.id = comp_stats.building_id
    WHERE b.id = p_building_id OR p_building_id IS NULL;
END$$

-- Procedure to get system health overview (NEW)
CREATE PROCEDURE GetSystemHealthOverview()
BEGIN
    SELECT 
        'Buildings' as component,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN status != 'active' THEN 1 ELSE 0 END) as issues
    FROM buildings
    
    UNION ALL
    
    SELECT 
        'Equipment' as component,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN status IN ('faulty', 'maintenance') THEN 1 ELSE 0 END) as issues
    FROM equipment
    
    UNION ALL
    
    SELECT 
        'Active Alerts' as component,
        COUNT(*) as total,
        SUM(CASE WHEN severity IN ('low', 'medium') THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN severity IN ('high', 'critical') THEN 1 ELSE 0 END) as issues
    FROM alerts 
    WHERE status = 'active'
    
    UNION ALL
    
    SELECT 
        'Background Jobs' as component,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as issues
    FROM background_jobs 
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
END$$

DELIMITER ;

-- =============================================
-- VERIFICATION OF ALL FUNCTIONS AND PROCEDURES
-- =============================================

-- Show all functions
SELECT 'FUNCTIONS:' as component_type;
SELECT 
    ROUTINE_NAME as name,
    ROUTINE_TYPE as type,
    DATA_TYPE as return_type,
    ROUTINE_COMMENT as description
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = 'uclm_energy_audit'
AND ROUTINE_TYPE = 'FUNCTION'
ORDER BY ROUTINE_NAME;

-- Show all procedures  
SELECT 'STORED PROCEDURES:' as component_type;
SELECT 
    ROUTINE_NAME as name,
    ROUTINE_TYPE as type,
    PARAMETER_STYLE as style,
    ROUTINE_COMMENT as description
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = 'uclm_energy_audit'
AND ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_NAME;

-- Test the original functions
SELECT 'TESTING ORIGINAL FUNCTIONS:' as test_type;
SELECT 
    'CalculatePowerFactor(100, 120) =' as test,
    CalculatePowerFactor(100, 120) as result
UNION ALL
SELECT 
    'GetComplianceRiskLevel(1, 0, 0) =' as test,
    GetComplianceRiskLevel(1, 0, 0) as result
UNION ALL
SELECT 
    'CheckTHDCompliance(5.2, 8.1) =' as test,
    CheckTHDCompliance(5.2, 8.1) as result
UNION ALL
SELECT 
    'CalculateCarbonFootprint(1000, NULL) =' as test,
    CalculateCarbonFootprint(1000, NULL) as result;

SELECT 'All original functions and procedures have been restored and enhanced!' as status;