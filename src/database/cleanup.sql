-- =============================================
-- SAFE MODE COMPATIBLE DATA CLEANUP
-- Works with MySQL Safe Update Mode enabled
-- =============================================

USE uclm_energy_audit;

-- Use TRUNCATE instead of DELETE (bypasses safe mode)
-- TRUNCATE removes all rows and resets auto-increment automatically

SET FOREIGN_KEY_CHECKS = 0;

-- Clean all analytics and calculated data
TRUNCATE TABLE forecast_data;
TRUNCATE TABLE efficiency_analyses;
TRUNCATE TABLE anomaly_detections;
TRUNCATE TABLE maintenance_predictions;
TRUNCATE TABLE power_quality_events;
TRUNCATE TABLE energy_baselines;

-- Clean all monitoring and background processing data
TRUNCATE TABLE background_jobs;
TRUNCATE TABLE system_monitoring_logs;
TRUNCATE TABLE monitoring_stats_cache;

-- Clean all alerts and notifications
TRUNCATE TABLE alerts;

-- Clean all compliance and audit data
TRUNCATE TABLE compliance_analyses;
TRUNCATE TABLE compliance_checks;
TRUNCATE TABLE audits;

-- Clean all maintenance records
TRUNCATE TABLE equipment_maintenance;

-- Clean all energy and power quality readings
TRUNCATE TABLE power_quality;
TRUNCATE TABLE energy_consumption;

-- Clean all reports
TRUNCATE TABLE reports;

-- Clean all equipment
TRUNCATE TABLE equipment;

-- Clean all buildings
TRUNCATE TABLE buildings;

-- For users table, use DELETE with WHERE to keep admin
DELETE FROM users WHERE id > 1;

SET FOREIGN_KEY_CHECKS = 1;

-- Verification
SELECT 'SAFE MODE CLEANUP COMPLETED!' as status;

SELECT 'CLEANED DATA VERIFICATION:' as info;
SELECT 'Buildings' as table_name, COUNT(*) as records FROM buildings
UNION ALL SELECT 'Equipment', COUNT(*) FROM equipment
UNION ALL SELECT 'Energy Consumption', COUNT(*) FROM energy_consumption
UNION ALL SELECT 'Power Quality', COUNT(*) FROM power_quality
UNION ALL SELECT 'Audits', COUNT(*) FROM audits
UNION ALL SELECT 'Users (Admin Preserved)', COUNT(*) FROM users;