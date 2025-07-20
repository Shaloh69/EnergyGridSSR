-- =============================================
-- UCLM Energy Audit Platform - Realistic Demo Data
-- Based on research paper findings
-- =============================================

USE uclm_energy_audit;

-- First, ensure we have the required users for audits
-- Insert additional users if needed (check if they exist first)
INSERT IGNORE INTO users (id, email, password, first_name, last_name, role, is_active) VALUES 
(1, 'admin@uclm.edu.ph', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeF7pLB5Y.d3Y1bQa', 'System', 'Administrator', 'admin', TRUE),
(2, 'energy.manager@uclm.edu.ph', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeF7pLB5Y.d3Y1bQa', 'Energy', 'Manager', 'energy_manager', TRUE),
(3, 'facility.engineer@uclm.edu.ph', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeF7pLB5Y.d3Y1bQa', 'Facility', 'Engineer', 'facility_engineer', TRUE);

-- Insert UCLM buildings based on research paper (6 buildings mentioned)
INSERT INTO buildings (name, code, area_sqm, floors, year_built, building_type, status) VALUES 
('Old Building', 'OLD', 5200.00, 4, 1995, 'Academic', 'active'),
('Annex 1', 'ANX1', 3800.00, 3, 2005, 'Academic', 'active'),
('Annex 2', 'ANX2', 3600.00, 3, 2008, 'Academic', 'active'),
('Basic Education Building', 'BEB', 2800.00, 4, 2012, 'Academic', 'active'),
('Maritime Building', 'MAR', 4200.00, 2, 2010, 'Specialized', 'active'),
('NSA Building', 'NSA', 3100.00, 3, 2015, 'Administrative', 'active');

-- Insert equipment based on research findings
-- Old Building (Non-inverter split-type AC units, over 10 years old)
INSERT INTO equipment (building_id, name, equipment_type, model, manufacturer, power_rating_kw, installation_date, maintenance_schedule, status, location, qr_code) VALUES 
(1, 'Old Building Central HVAC', 'hvac', 'Split-Type Non-Inverter', 'Carrier', 45.0, '2010-01-15', 'monthly', 'active', 'Mechanical Room', 'UCLM-OLD-HVAC-001'),
(1, 'Lecture Hall AC Unit 1', 'hvac', 'Split-Type Non-Inverter', 'Daikin', 5.5, '2012-03-20', 'monthly', 'active', 'Lecture Hall A', 'UCLM-OLD-AC-001'),
(1, 'Lecture Hall AC Unit 2', 'hvac', 'Split-Type Non-Inverter', 'Mitsubishi', 5.5, '2012-03-20', 'monthly', 'active', 'Lecture Hall B', 'UCLM-OLD-AC-002'),
(1, 'Computer Lab Equipment', 'others', 'Desktop Computers', 'Various', 8.0, '2015-06-01', 'quarterly', 'active', 'Computer Lab', 'UCLM-OLD-COMP-001'),
(1, 'Fluorescent Lighting System', 'lighting', 'T8 Fluorescent', 'Philips', 12.0, '2010-01-15', 'quarterly', 'active', 'All Floors', 'UCLM-OLD-LIGHT-001'),

-- Annex 1 
(2, 'Annex 1 Central HVAC', 'hvac', 'Split-Type Non-Inverter', 'York', 35.0, '2005-08-10', 'monthly', 'active', 'Mechanical Room', 'UCLM-ANX1-HVAC-001'),
(2, 'Laboratory HVAC System', 'hvac', 'Split-Type', 'Carrier', 25.0, '2010-05-15', 'monthly', 'active', 'Engineering Lab', 'UCLM-ANX1-LAB-001'),
(2, 'Electrical Panel 1A', 'panel', 'Main Distribution', 'Schneider', 200.0, '2005-08-10', 'annually', 'active', 'Electrical Room', 'UCLM-ANX1-PANEL-001'),

-- Annex 2
(3, 'Annex 2 HVAC System', 'hvac', 'Split-Type Non-Inverter', 'Trane', 30.0, '2008-12-01', 'monthly', 'active', 'Mechanical Room', 'UCLM-ANX2-HVAC-001'),
(3, 'Classroom AC Units', 'hvac', 'Split-Type Non-Inverter', 'Daikin', 18.0, '2012-01-15', 'monthly', 'active', 'Multiple Classrooms', 'UCLM-ANX2-AC-001'),

-- Basic Education Building
(4, 'BEB Central HVAC', 'hvac', 'Split-Type Semi-Inverter', 'Mitsubishi', 28.0, '2012-09-20', 'monthly', 'active', 'Mechanical Room', 'UCLM-BEB-HVAC-001'),
(4, 'LED Lighting System', 'lighting', 'LED Panel', 'Philips', 8.0, '2018-01-10', 'quarterly', 'active', 'All Floors', 'UCLM-BEB-LIGHT-001'),

-- Maritime Building
(5, 'Maritime HVAC System', 'hvac', 'Central Chilled Water', 'Carrier', 55.0, '2010-05-01', 'monthly', 'active', 'Mechanical Room', 'UCLM-MAR-HVAC-001'),
(5, 'Marine Simulator Equipment', 'others', 'Navigation Simulator', 'Kongsberg', 15.0, '2015-08-20', 'monthly', 'active', 'Simulation Room', 'UCLM-MAR-SIM-001'),

-- NSA Building  
(6, 'NSA Central HVAC', 'hvac', 'VRF System', 'Daikin', 32.0, '2015-03-15', 'monthly', 'active', 'Mechanical Room', 'UCLM-NSA-HVAC-001'),
(6, 'Administrative Equipment', 'others', 'Office Equipment', 'Various', 6.0, '2015-03-15', 'quarterly', 'active', 'Offices', 'UCLM-NSA-OFFICE-001');

-- Insert energy consumption data reflecting research findings
-- HVAC consuming ~63% of total energy, high plug loads ~35%
-- Average illuminance ~250 lux (below 300 lux target)

-- Old Building - Higher consumption due to old non-inverter AC
INSERT INTO energy_consumption (building_id, consumption_kwh, cost_php, recorded_at, power_factor, energy_type, created_by) VALUES 
-- Last 30 days with realistic patterns
(1, 1850.5, 22206.00, DATE_SUB(NOW(), INTERVAL 30 DAY), 0.82, 'total', 1),
(1, 1920.3, 23043.60, DATE_SUB(NOW(), INTERVAL 29 DAY), 0.81, 'total', 1),
(1, 1780.8, 21369.60, DATE_SUB(NOW(), INTERVAL 28 DAY), 0.83, 'total', 1),
(1, 1890.2, 22682.40, DATE_SUB(NOW(), INTERVAL 27 DAY), 0.80, 'total', 1),
(1, 1950.7, 23408.40, DATE_SUB(NOW(), INTERVAL 26 DAY), 0.79, 'total', 1),

-- Continue with more recent data for Old Building
(1, 1825.4, 21904.80, DATE_SUB(NOW(), INTERVAL 7 DAY), 0.84, 'total', 1),
(1, 1860.9, 22330.80, DATE_SUB(NOW(), INTERVAL 6 DAY), 0.83, 'total', 1),
(1, 1795.2, 21542.40, DATE_SUB(NOW(), INTERVAL 5 DAY), 0.85, 'total', 1),
(1, 1875.6, 22507.20, DATE_SUB(NOW(), INTERVAL 4 DAY), 0.82, 'total', 1),
(1, 1840.3, 22083.60, DATE_SUB(NOW(), INTERVAL 3 DAY), 0.84, 'total', 1),
(1, 1890.7, 22688.40, DATE_SUB(NOW(), INTERVAL 2 DAY), 0.81, 'total', 1),
(1, 1820.5, 21846.00, DATE_SUB(NOW(), INTERVAL 1 DAY), 0.86, 'total', 1),
(1, 1755.8, 21069.60, NOW(), 0.87, 'total', 1),

-- Annex 1 - Moderate consumption
(2, 1320.4, 15844.80, DATE_SUB(NOW(), INTERVAL 7 DAY), 0.86, 'total', 1),
(2, 1285.7, 15428.40, DATE_SUB(NOW(), INTERVAL 6 DAY), 0.88, 'total', 1),
(2, 1340.2, 16082.40, DATE_SUB(NOW(), INTERVAL 5 DAY), 0.85, 'total', 1),
(2, 1295.8, 15549.60, DATE_SUB(NOW(), INTERVAL 4 DAY), 0.87, 'total', 1),
(2, 1355.1, 16261.20, DATE_SUB(NOW(), INTERVAL 3 DAY), 0.84, 'total', 1),
(2, 1310.6, 15727.20, DATE_SUB(NOW(), INTERVAL 2 DAY), 0.86, 'total', 1),
(2, 1275.3, 15303.60, DATE_SUB(NOW(), INTERVAL 1 DAY), 0.89, 'total', 1),
(2, 1245.9, 14950.80, NOW(), 0.90, 'total', 1),

-- Annex 2 - Moderate consumption with older equipment  
(3, 1240.8, 14889.60, DATE_SUB(NOW(), INTERVAL 7 DAY), 0.85, 'total', 1),
(3, 1205.3, 14463.60, DATE_SUB(NOW(), INTERVAL 6 DAY), 0.84, 'total', 1),
(3, 1270.5, 15246.00, DATE_SUB(NOW(), INTERVAL 5 DAY), 0.86, 'total', 1),
(3, 1225.7, 14708.40, DATE_SUB(NOW(), INTERVAL 4 DAY), 0.83, 'total', 1),
(3, 1290.2, 15482.40, DATE_SUB(NOW(), INTERVAL 3 DAY), 0.85, 'total', 1),
(3, 1255.4, 15064.80, DATE_SUB(NOW(), INTERVAL 2 DAY), 0.86, 'total', 1),
(3, 1210.6, 14527.20, DATE_SUB(NOW(), INTERVAL 1 DAY), 0.88, 'total', 1),
(3, 1185.3, 14223.60, NOW(), 0.89, 'total', 1),

-- Basic Education Building - Better efficiency with LED lighting
(4, 980.2, 11762.40, DATE_SUB(NOW(), INTERVAL 7 DAY), 0.91, 'total', 1),
(4, 945.8, 11349.60, DATE_SUB(NOW(), INTERVAL 6 DAY), 0.92, 'total', 1),
(4, 1025.4, 12304.80, DATE_SUB(NOW(), INTERVAL 5 DAY), 0.89, 'total', 1),
(4, 965.7, 11588.40, DATE_SUB(NOW(), INTERVAL 4 DAY), 0.93, 'total', 1),
(4, 1010.3, 12123.60, DATE_SUB(NOW(), INTERVAL 3 DAY), 0.90, 'total', 1),
(4, 985.6, 11827.20, DATE_SUB(NOW(), INTERVAL 2 DAY), 0.91, 'total', 1),
(4, 920.4, 11044.80, DATE_SUB(NOW(), INTERVAL 1 DAY), 0.94, 'total', 1),
(4, 895.2, 10742.40, NOW(), 0.95, 'total', 1),

-- Maritime Building - High consumption due to specialized equipment
(5, 1650.7, 19808.40, DATE_SUB(NOW(), INTERVAL 7 DAY), 0.83, 'total', 1),
(5, 1720.3, 20643.60, DATE_SUB(NOW(), INTERVAL 6 DAY), 0.81, 'total', 1),
(5, 1595.8, 19149.60, DATE_SUB(NOW(), INTERVAL 5 DAY), 0.85, 'total', 1),
(5, 1680.4, 20164.80, DATE_SUB(NOW(), INTERVAL 4 DAY), 0.82, 'total', 1),
(5, 1745.2, 20942.40, DATE_SUB(NOW(), INTERVAL 3 DAY), 0.80, 'total', 1),
(5, 1625.6, 19507.20, DATE_SUB(NOW(), INTERVAL 2 DAY), 0.84, 'total', 1),
(5, 1590.3, 19083.60, DATE_SUB(NOW(), INTERVAL 1 DAY), 0.86, 'total', 1),
(5, 1555.9, 18670.80, NOW(), 0.87, 'total', 1),

-- NSA Building - Best efficiency with newer VRF system
(6, 1150.4, 13804.80, DATE_SUB(NOW(), INTERVAL 7 DAY), 0.89, 'total', 1),
(6, 1125.7, 13508.40, DATE_SUB(NOW(), INTERVAL 6 DAY), 0.91, 'total', 1),
(6, 1180.2, 14162.40, DATE_SUB(NOW(), INTERVAL 5 DAY), 0.88, 'total', 1),
(6, 1095.8, 13149.60, DATE_SUB(NOW(), INTERVAL 4 DAY), 0.92, 'total', 1),
(6, 1205.3, 14463.60, DATE_SUB(NOW(), INTERVAL 3 DAY), 0.87, 'total', 1),
(6, 1140.6, 13687.20, DATE_SUB(NOW(), INTERVAL 2 DAY), 0.90, 'total', 1),
(6, 1085.4, 13024.80, DATE_SUB(NOW(), INTERVAL 1 DAY), 0.93, 'total', 1),
(6, 1055.2, 12662.40, NOW(), 0.94, 'total', 1);

-- Insert power quality data reflecting research findings
-- Poor power factor in older buildings, voltage stability issues
INSERT INTO power_quality (building_id, voltage_l1, voltage_l2, voltage_l3, thd_voltage, thd_current, frequency, power_factor, voltage_unbalance, recorded_at, created_by) VALUES 
-- Old Building - Poor power quality due to old equipment
(1, 228.5, 227.8, 229.2, 9.2, 18.5, 49.95, 0.82, 3.8, DATE_SUB(NOW(), INTERVAL 2 HOUR), 1),
(1, 229.1, 228.3, 230.1, 8.7, 17.2, 50.02, 0.84, 3.5, DATE_SUB(NOW(), INTERVAL 1 HOUR), 1),
(1, 227.9, 228.9, 229.5, 9.5, 19.1, 49.98, 0.81, 4.1, NOW(), 1),

-- Annex 1 - Moderate power quality
(2, 229.8, 230.2, 229.5, 7.2, 14.8, 50.01, 0.86, 2.8, DATE_SUB(NOW(), INTERVAL 2 HOUR), 1),
(2, 230.1, 229.7, 230.3, 6.9, 13.5, 50.03, 0.88, 2.5, DATE_SUB(NOW(), INTERVAL 1 HOUR), 1),
(2, 229.6, 230.0, 229.8, 7.5, 15.2, 49.99, 0.85, 2.9, NOW(), 1),

-- Basic Education Building - Better power quality with newer equipment
(4, 230.2, 230.8, 230.1, 5.2, 8.9, 50.02, 0.91, 1.8, DATE_SUB(NOW(), INTERVAL 2 HOUR), 1),
(4, 230.5, 230.3, 230.7, 4.8, 8.1, 50.01, 0.93, 1.5, DATE_SUB(NOW(), INTERVAL 1 HOUR), 1),
(4, 230.1, 230.6, 230.4, 5.5, 9.2, 50.00, 0.90, 2.0, NOW(), 1),

-- Maritime Building - Variable power quality due to specialized loads
(5, 228.8, 229.5, 230.2, 8.8, 16.7, 49.97, 0.83, 3.2, DATE_SUB(NOW(), INTERVAL 2 HOUR), 1),
(5, 229.2, 230.1, 229.7, 8.2, 15.9, 50.04, 0.85, 2.9, DATE_SUB(NOW(), INTERVAL 1 HOUR), 1),
(5, 228.9, 229.8, 230.0, 9.1, 17.3, 49.96, 0.82, 3.5, NOW(), 1),

-- NSA Building - Good power quality with VRF system
(6, 230.3, 230.7, 230.2, 4.5, 7.2, 50.01, 0.92, 1.2, DATE_SUB(NOW(), INTERVAL 2 HOUR), 1),
(6, 230.6, 230.4, 230.8, 4.1, 6.8, 50.02, 0.94, 1.0, DATE_SUB(NOW(), INTERVAL 1 HOUR), 1),
(6, 230.2, 230.5, 230.3, 4.8, 7.5, 50.00, 0.91, 1.4, NOW(), 1);

-- Insert sample audits based on research objectives
INSERT INTO audits (building_id, auditor_id, audit_type, title, status, priority, scheduled_date, findings, recommendations, compliance_score) VALUES 
(1, 1, 'comprehensive', 'Old Building Energy Efficiency Assessment 2024', 'completed', 'high', DATE_SUB(NOW(), INTERVAL 15 DAY), 
'Low illuminance levels averaging 250 lux in lecture halls and corridors, well below 300 lux target. Non-inverter AC units consuming 63% of total energy. High plug loads from uncontrolled computer equipment.', 
'Upgrade to LED lighting systems, replace non-inverter AC units with inverter type, implement smart plug load management systems.', 
65.5),

(4, 2, 'energy_efficiency', 'Basic Education Building LED Lighting Performance Review', 'completed', 'medium', DATE_SUB(NOW(), INTERVAL 30 DAY),
'LED lighting system performing well with improved illuminance levels. Power factor improved to 0.91 average.',
'Continue monitoring LED performance, consider expansion to other buildings.',
88.2),

(5, 1, 'power_quality', 'Maritime Building Power Quality Analysis', 'in_progress', 'high', DATE_SUB(NOW(), INTERVAL 5 DAY),
'High THD levels detected during marine simulator operation. Voltage unbalance issues during peak loads.',
'Install power factor correction equipment, implement load scheduling for marine simulators.',
72.3);

-- Insert compliance checks for completed audits
INSERT INTO compliance_checks (audit_id, standard_type, section_code, check_description, status, severity, details, corrective_action) VALUES 
(1, 'PEC2017', 'SEC-215', 'Illumination levels in academic spaces', 'non_compliant', 'medium', 'Average 250 lux measured, requires 300 lux minimum for academic spaces', 'Upgrade to higher efficiency LED lighting'),
(1, 'PEC2017', 'SEC-220', 'Power factor requirements', 'non_compliant', 'high', 'Power factor averaging 0.82, below 0.85 minimum requirement', 'Install power factor correction capacitors'),
(1, 'OSHS', 'ELEC-002', 'Electrical safety in computer laboratories', 'needs_review', 'medium', 'Uncontrolled plug loads in computer lab areas', 'Implement proper load management and safety protocols'),

(2, 'PEC2017', 'SEC-215', 'LED lighting performance', 'compliant', 'low', 'LED system achieving target illuminance levels', 'Continue monitoring'),
(2, 'RA11285', 'ENERGY-002', 'Energy efficiency targets', 'compliant', 'low', 'Building meeting energy efficiency benchmarks with LED upgrades', 'Maintain current practices'),

(3, 'PEC2017', 'SEC-220', 'Power quality standards', 'non_compliant', 'high', 'THD voltage exceeding 8% limit during marine simulator operation', 'Install harmonic filters and improve power distribution'),
(3, 'OSHS', 'ELEC-001', 'Electrical safety during specialized equipment operation', 'needs_review', 'medium', 'Safety protocols for marine simulator electrical systems', 'Develop specialized safety procedures');

-- Insert some realistic alerts based on the data
INSERT INTO alerts (type, severity, status, title, message, building_id, equipment_id, detected_value, threshold_value) VALUES 
('power_quality', 'high', 'active', 'High THD Voltage in Old Building', 'THD voltage level of 9.5% exceeds IEEE standard of 8%', 1, 1, 9.5, 8.0),
('energy_anomaly', 'medium', 'active', 'Power Factor Below Target - Old Building', 'Power factor of 0.81 is below required 0.85 minimum', 1, 1, 0.81, 0.85),
('power_quality', 'medium', 'acknowledged', 'Voltage Unbalance - Maritime Building', 'Voltage unbalance of 3.5% detected during simulator operation', 5, 12, 3.5, 3.0),
('compliance_violation', 'high', 'resolved', 'Illumination Below Standard - Old Building', 'Average illuminance of 250 lux below 300 lux requirement', 1, 5, 250, 300);

-- Verification queries
SELECT 'Demo data inserted successfully for UCLM Energy Audit Platform!' as status;

-- Show summary of inserted data
SELECT 'UCLM DEMO DATA SUMMARY:' as info;
SELECT 'Buildings (UCLM Campus)' as table_name, COUNT(*) as records FROM buildings
UNION ALL SELECT 'Equipment', COUNT(*) FROM equipment  
UNION ALL SELECT 'Energy Readings (7 days)', COUNT(*) FROM energy_consumption
UNION ALL SELECT 'Power Quality Readings', COUNT(*) FROM power_quality
UNION ALL SELECT 'Audits', COUNT(*) FROM audits
UNION ALL SELECT 'Compliance Checks', COUNT(*) FROM compliance_checks
UNION ALL SELECT 'Active Alerts', COUNT(*) FROM alerts WHERE status = 'active';

-- Show building summary with actual data
SELECT 
    'BUILDING ENERGY SUMMARY:' as report_type;
    
SELECT 
    b.name as building_name,
    b.code,
    ROUND(AVG(ec.consumption_kwh), 2) as avg_daily_kwh,
    ROUND(AVG(ec.power_factor), 3) as avg_power_factor,
    COUNT(e.id) as equipment_count,
    CASE 
        WHEN AVG(ec.power_factor) >= 0.90 THEN 'Good'
        WHEN AVG(ec.power_factor) >= 0.85 THEN 'Fair' 
        ELSE 'Poor'
    END as efficiency_rating
FROM buildings b
LEFT JOIN energy_consumption ec ON b.id = ec.building_id 
LEFT JOIN equipment e ON b.id = e.building_id
WHERE b.id <= 6
GROUP BY b.id, b.name, b.code
ORDER BY avg_power_factor DESC;