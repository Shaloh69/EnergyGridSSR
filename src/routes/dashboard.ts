import { Router } from "express";
import dashboardController from "@/controllers/dashboardController";
import { authenticateToken } from "@/middleware/auth";
import { validateQuery } from "@/middleware/validation";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/dashboard/overview
 * @desc Generate comprehensive executive dashboard with system health and performance KPIs
 * @details Provides high-level executive dashboard including overall system health scoring,
 *          building portfolio statistics with performance ratings, equipment operational
 *          status summaries, energy performance indicators with cost analysis, power quality
 *          health assessment, audit completion metrics, critical alert summaries with
 *          prioritization, financial impact analysis, and environmental sustainability
 *          indicators. Delivers strategic insights for executive decision-making and
 *          operational oversight.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/dashboard/overview
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Dashboard overview retrieved successfully",
 *   "data": {
 *     "system_health": {
 *       "overall_score": 87.5,
 *       "status": "good",
 *       "components": {
 *         "buildings": 92.0,
 *         "equipment": 85.5,
 *         "energy_efficiency": 88.0,
 *         "power_quality": 89.5,
 *         "alerts": 82.0
 *       }
 *     },
 *     "building_portfolio": {
 *       "total_buildings": 8,
 *       "active_buildings": 7,
 *       "maintenance_buildings": 1,
 *       "total_area_sqm": 125000,
 *       "average_efficiency_score": 83.2
 *     },
 *     "equipment_status": {
 *       "total_equipment": 156,
 *       "operational": 142,
 *       "maintenance_required": 12,
 *       "offline": 2,
 *       "efficiency_rating": "good"
 *     },
 *     "energy_performance": {
 *       "monthly_consumption_kwh": 245750.5,
 *       "monthly_cost_php": 2949006.00,
 *       "average_power_factor": 0.94,
 *       "efficiency_vs_baseline": 8.2,
 *       "carbon_footprint_kg_co2": 174026.85,
 *       "cost_per_sqm": 23.59
 *     },
 *     "power_quality": {
 *       "overall_score": 89.5,
 *       "ieee519_compliance_rate": 91.2,
 *       "itic_compliance_rate": 95.8,
 *       "events_this_month": 12,
 *       "critical_violations": 1
 *     },
 *     "audit_metrics": {
 *       "completed_audits": 15,
 *       "pending_audits": 3,
 *       "compliance_score": 86.7,
 *       "critical_findings": 2,
 *       "implementation_rate": 78.5
 *     },
 *     "critical_alerts": {
 *       "active_critical": 2,
 *       "active_high": 5,
 *       "total_active": 18,
 *       "resolution_rate": 85.2,
 *       "average_response_time_hours": 2.3
 *     },
 *     "financial_summary": {
 *       "monthly_energy_cost": 2949006.00,
 *       "potential_savings": 294900.60,
 *       "ytd_cost_reduction": 1475000.00,
 *       "roi_percentage": 15.8
 *     },
 *     "sustainability": {
 *       "carbon_reduction_percentage": 12.5,
 *       "renewable_energy_percentage": 8.2,
 *       "water_conservation_liters": 125000,
 *       "waste_reduction_percentage": 18.7
 *     },
 *     "last_updated": "2024-07-03T14:30:00Z"
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Dashboard data temporarily unavailable",
 *   "error": "SERVICE_UNAVAILABLE"
 * }
 */
router.get("/overview", dashboardController.getDashboardOverview);

/**
 * @route GET /api/dashboard/real-time
 * @desc Provide real-time operational metrics with live system monitoring and alerts
 * @details Delivers live operational dashboard with real-time energy consumption monitoring,
 *          current demand levels across buildings, live power quality indicators with
 *          instant violation detection, active equipment status with operational parameters,
 *          real-time alert monitoring with severity-based prioritization, system performance
 *          metrics, environmental correlation data, grid connection status, and live cost
 *          tracking. Enables immediate response to operational issues and system optimization.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/dashboard/real-time
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Real-time metrics retrieved successfully",
 *   "data": {
 *     "timestamp": "2024-07-03T14:30:15Z",
 *     "current_energy": {
 *       "total_demand_kw": 1847.5,
 *       "total_consumption_today_kwh": 15250.8,
 *       "average_power_factor": 0.94,
 *       "grid_frequency": 59.98,
 *       "load_distribution": {
 *         "hvac_percentage": 45.2,
 *         "lighting_percentage": 28.7,
 *         "equipment_percentage": 18.9,
 *         "other_percentage": 7.2
 *       }
 *     },
 *     "building_status": [
 *       {
 *         "building_id": 1,
 *         "name": "Green Energy Office Complex",
 *         "current_demand_kw": 285.2,
 *         "power_factor": 0.95,
 *         "status": "normal",
 *         "alert_count": 0,
 *         "efficiency_status": "excellent"
 *       },
 *       {
 *         "building_id": 2,
 *         "name": "Manufacturing Plant A",
 *         "current_demand_kw": 1240.8,
 *         "power_factor": 0.87,
 *         "status": "warning",
 *         "alert_count": 2,
 *         "efficiency_status": "needs_attention"
 *       }
 *     ],
 *     "power_quality_live": {
 *       "voltage_stability": "stable",
 *       "harmonic_distortion": 3.2,
 *       "ieee519_compliance": true,
 *       "active_violations": 0,
 *       "quality_score": 89.5
 *     },
 *     "active_alerts": [
 *       {
 *         "id": 158,
 *         "building_id": 2,
 *         "type": "power_quality",
 *         "severity": "medium",
 *         "title": "Power Factor Below Target",
 *         "age_minutes": 15,
 *         "urgency": "medium"
 *       }
 *     ],
 *     "equipment_status": {
 *       "critical_equipment_online": 98.7,
 *       "maintenance_alerts": 3,
 *       "performance_alerts": 1,
 *       "efficiency_average": 87.2
 *     },
 *     "environmental_data": {
 *       "average_temperature_c": 28.5,
 *       "average_humidity_percent": 65.2,
 *       "weather_impact": "minimal",
 *       "cooling_load_factor": 0.78
 *     },
 *     "cost_tracking": {
 *       "current_hourly_rate_php": 1847.50,
 *       "today_cost_php": 183006.00,
 *       "monthly_budget_usage": 67.8,
 *       "projected_monthly_cost": 2856750.00
 *     },
 *     "system_performance": {
 *       "data_collection_rate": 99.8,
 *       "communication_status": "excellent",
 *       "processing_latency_ms": 125,
 *       "active_users": 12
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Real-time data service temporarily unavailable",
 *   "error": "REAL_TIME_SERVICE_ERROR",
 *   "details": {
 *     "last_successful_update": "2024-07-03T14:25:00Z",
 *     "retry_after_seconds": 30
 *   }
 * }
 */
router.get("/real-time", dashboardController.getRealTimeMetrics);

/**
 * @route GET /api/dashboard/energy-summary
 * @desc Deliver comprehensive energy analytics with optimization insights and forecasting
 * @details Provides detailed energy management dashboard including consumption trend analysis
 *          with seasonal adjustments, peak demand profiling, energy cost analysis with
 *          Philippine utility rate optimization, power factor performance assessment,
 *          efficiency benchmarking, conservation opportunity identification, load forecasting,
 *          procurement optimization insights, and carbon footprint tracking. Supports
 *          strategic energy management and sustainability goal achievement.
 * @access Private (All authenticated users)
 */
router.get("/energy-summary", dashboardController.getEnergySummary);

/**
 * @route GET /api/dashboard/power-quality-summary
 * @desc Generate power quality analytics with IEEE 519 compliance and equipment protection insights
 * @details Provides comprehensive power quality management dashboard including system-wide
 *          health indicators, IEEE 519 compliance tracking with violation analysis, ITIC
 *          curve compliance assessment, voltage and current quality metrics, power factor
 *          trending, event frequency analysis, equipment stress evaluation, cost impact
 *          assessment, and prioritized improvement recommendations. Enables proactive
 *          power quality management and equipment protection strategies.
 * @access Private (All authenticated users)
 */
router.get(
  "/power-quality-summary",
  dashboardController.getPowerQualitySummary
);

/**
 * @route GET /api/dashboard/audit-summary
 * @desc Provide audit program analytics with compliance tracking and performance metrics
 * @details Delivers comprehensive audit program dashboard including completion rate tracking,
 *          compliance score distribution across standards, risk assessment summaries,
 *          implementation progress monitoring, cost-benefit analysis of improvements,
 *          auditor performance metrics, building compliance rankings, regulatory deadline
 *          tracking, and continuous improvement program effectiveness. Supports strategic
 *          audit program management and regulatory compliance assurance.
 * @access Private (All authenticated users)
 */
router.get("/audit-summary", dashboardController.getAuditSummary);

/**
 * @route GET /api/dashboard/compliance-summary
 * @desc Generate regulatory compliance analytics with gap analysis and risk assessment
 * @details Provides comprehensive compliance management dashboard including multi-standard
 *          compliance overview (IEEE 519, PEC, OSHS, ISO 25010, RA 11285), gap analysis
 *          with severity scoring, risk assessment matrices, regulatory deadline tracking,
 *          non-compliance cost analysis, corrective action progress monitoring, compliance
 *          trend analysis, regulatory change impact assessment, and documentation readiness
 *          indicators. Enables strategic compliance management and regulatory preparedness.
 * @access Private (All authenticated users)
 */
router.get("/compliance-summary", dashboardController.getComplianceSummary);

/**
 * @route GET /api/dashboard/alerts
 * @desc Deliver prioritized alerts dashboard with intelligent categorization and action recommendations
 * @details Provides comprehensive alert management dashboard including active alert prioritization
 *          with severity-based ranking, intelligent categorization (Energy, Power Quality,
 *          Equipment, Compliance, Maintenance), urgency assessment with age and impact factors,
 *          alert trend analysis, escalation status tracking, impact assessment with financial
 *          implications, root cause correlation, and actionable recommendations. Enables
 *          proactive alert management and rapid response coordination.
 * @access Private (All authenticated users)
 */
router.get("/alerts", dashboardController.getAlerts);

export default router;
