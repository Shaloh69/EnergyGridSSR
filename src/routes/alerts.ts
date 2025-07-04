import { Router } from "express";
import alertController from "@/controllers/alertController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import Joi from "joi";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const alertQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  building_id: Joi.string().pattern(/^\d+$/).optional(),
  equipment_id: Joi.string().pattern(/^\d+$/).optional(),
  type: Joi.string()
    .valid(
      "energy_anomaly",
      "power_quality",
      "equipment_failure",
      "compliance_violation",
      "maintenance_due",
      "efficiency_degradation",
      "threshold_exceeded"
    )
    .optional(),
  severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
  status: Joi.string()
    .valid("active", "acknowledged", "resolved", "escalated", "all")
    .optional()
    .default("active"),
  start_date: Joi.string().isoDate().optional(),
  end_date: Joi.string().isoDate().optional(),
});

const createAlertValidation = Joi.object({
  type: Joi.string()
    .valid(
      "energy_anomaly",
      "power_quality",
      "equipment_failure",
      "compliance_violation",
      "maintenance_due",
      "efficiency_degradation",
      "threshold_exceeded"
    )
    .required(),
  severity: Joi.string().valid("low", "medium", "high", "critical").required(),
  title: Joi.string().min(5).max(200).required(),
  message: Joi.string().min(10).max(1000).required(),
  building_id: Joi.number().integer().optional(),
  equipment_id: Joi.number().integer().optional(),
  audit_id: Joi.number().integer().optional(),
  energy_reading_id: Joi.number().integer().optional(),
  pq_reading_id: Joi.number().integer().optional(),
  threshold_config: Joi.object().optional(),
  detected_value: Joi.number().optional(),
  threshold_value: Joi.number().optional(),
  metadata: Joi.object().optional(),
});

const updateAlertValidation = Joi.object({
  status: Joi.string()
    .valid("active", "acknowledged", "resolved", "escalated")
    .optional(),
  acknowledged_by: Joi.number().integer().optional(),
  resolved_by: Joi.number().integer().optional(),
  escalation_level: Joi.number().integer().min(1).max(5).optional(),
  metadata: Joi.object().optional(),
});

const resolveAlertValidation = Joi.object({
  resolution_notes: Joi.string().max(1000).optional(),
});

const createThresholdValidation = Joi.object({
  building_id: Joi.number().integer().optional(),
  equipment_id: Joi.number().integer().optional(),
  parameter_name: Joi.string().required(),
  parameter_type: Joi.string()
    .valid("energy", "power_quality", "equipment")
    .required(),
  min_value: Joi.number().optional(),
  max_value: Joi.number().optional(),
  threshold_type: Joi.string()
    .valid("absolute", "percentage", "deviation")
    .required(),
  severity: Joi.string().valid("low", "medium", "high", "critical").required(),
  enabled: Joi.boolean().optional().default(true),
  escalation_minutes: Joi.number().integer().min(1).max(1440).optional(),
  notification_emails: Joi.array().items(Joi.string().email()).optional(),
  metadata: Joi.object().optional(),
});

const thresholdQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  building_id: Joi.string().pattern(/^\d+$/).optional(),
  equipment_id: Joi.string().pattern(/^\d+$/).optional(),
  parameter_type: Joi.string()
    .valid("energy", "power_quality", "equipment")
    .optional(),
  enabled: Joi.string().valid("true", "false").optional(),
});

const testMonitoringValidation = Joi.object({
  monitoring_type: Joi.string()
    .valid("energy", "power_quality", "equipment")
    .required(),
  test_data: Joi.object().required(),
});

const alertStatisticsQueryValidation = Joi.object({
  building_id: Joi.string().pattern(/^\d+$/).optional(),
  days: Joi.string().pattern(/^\d+$/).optional().default("30"),
});

const idParamsValidation = Joi.object({
  id: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "ID must be a valid number",
    "any.required": "ID is required",
  }),
});

const buildingIdParamsValidation = Joi.object({
  buildingId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
    "any.required": "Building ID is required",
  }),
});

// Alert management endpoints

/**
 * @route GET /api/alerts
 * @desc Retrieve comprehensive alert data with intelligent filtering and prioritization
 * @details Fetches alerts with advanced filtering capabilities including severity-based priority ranking,
 *          status-based filtering (active, acknowledged, resolved, escalated), building/equipment correlation,
 *          date range filtering, and alert type classification. Supports pagination for large datasets.
 *          Includes alert enhancement with calculated urgency levels, impact assessments, and intelligent
 *          categorization for improved alert management and response coordination.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/alerts?severity=critical&status=active&building_id=1&page=1&limit=10
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Alerts retrieved successfully",
 *   "data": {
 *     "alerts": [
 *       {
 *         "id": 1,
 *         "type": "energy_anomaly",
 *         "severity": "critical",
 *         "status": "active",
 *         "title": "Excessive Energy Consumption Detected",
 *         "message": "Building energy consumption exceeded threshold by 45%",
 *         "building_id": 1,
 *         "building_name": "Main Office Complex",
 *         "equipment_id": 12,
 *         "equipment_name": "Central Chiller Unit #1",
 *         "detected_value": 2450.5,
 *         "threshold_value": 1680.0,
 *         "urgency": "critical",
 *         "category": "Energy",
 *         "estimated_cost_impact": 15750.25,
 *         "created_at": "2024-07-03T10:30:00Z",
 *         "age_minutes": 45
 *       }
 *     ],
 *     "pagination": {
 *       "current_page": 1,
 *       "per_page": 10,
 *       "total_pages": 3,
 *       "total_count": 28
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Invalid severity level specified",
 *   "error": "VALIDATION_ERROR"
 * }
 */
router.get("/", validateQuery(alertQueryValidation), alertController.getAlerts);

/**
 * @route GET /api/alerts/statistics
 * @desc Generate comprehensive alert analytics and performance metrics for management insights
 * @details Provides detailed alert statistics including frequency analysis, severity distribution,
 *          response time analytics, escalation rate tracking, building/equipment-specific patterns,
 *          resolution effectiveness metrics, and trend analysis. Calculates performance indicators
 *          for system reliability monitoring and identifies areas requiring preventive action.
 * @access Private (Energy Manager, Admin)
 * @example_request
 * GET /api/alerts/statistics?building_id=1&days=30
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Alert statistics retrieved successfully",
 *   "data": {
 *     "summary": {
 *       "total_alerts": 127,
 *       "active_alerts": 8,
 *       "resolved_alerts": 115,
 *       "escalated_alerts": 4,
 *       "average_resolution_time_hours": 4.2
 *     },
 *     "severity_distribution": {
 *       "critical": 5,
 *       "high": 18,
 *       "medium": 67,
 *       "low": 37
 *     },
 *     "type_breakdown": {
 *       "energy_anomaly": 45,
 *       "power_quality": 28,
 *       "equipment_failure": 23,
 *       "maintenance_due": 18,
 *       "compliance_violation": 13
 *     },
 *     "trends": {
 *       "alert_frequency_trend": "decreasing",
 *       "resolution_efficiency_trend": "improving",
 *       "escalation_rate": 3.1
 *     },
 *     "cost_impact": {
 *       "total_estimated_cost": 245750.50,
 *       "average_cost_per_alert": 1935.04,
 *       "cost_avoided_through_resolution": 189250.25
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Building not found",
 *   "error": "RESOURCE_NOT_FOUND"
 * }
 */
router.get(
  "/statistics",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateQuery(alertStatisticsQueryValidation),
  alertController.getAlertStatistics
);

/**
 * @route GET /api/alerts/:id
 * @desc Retrieve detailed alert information with complete context and resolution tracking
 * @details Fetches comprehensive alert details including triggering conditions, threshold analysis,
 *          historical data context, impact assessment on affected systems, related alerts correlation,
 *          resolution history, stakeholder communication log, and cost impact calculation. Provides
 *          complete audit trail for accountability and knowledge management.
 * @access Private (All authenticated users)
 */
router.get(
  "/:id",
  validateParams(idParamsValidation),
  alertController.getAlertById
);

/**
 * @route POST /api/alerts
 * @desc Create new alert with intelligent routing and impact assessment
 * @details Creates comprehensive alert record with automatic severity assessment, intelligent routing
 *          to appropriate stakeholders, impact analysis on affected equipment and operations,
 *          cost implication calculation, correlation with historical patterns, automatic escalation
 *          setup, and real-time notification delivery. Integrates with maintenance systems for
 *          work order generation when applicable.
 * @access Private (Energy Manager, Facility Engineer, Admin)
 * @example_request
 * POST /api/alerts
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "Content-Type": "application/json" }
 * Body: {
 *   "type": "power_quality",
 *   "severity": "high",
 *   "title": "Voltage THD Compliance Violation",
 *   "message": "Voltage THD exceeded IEEE 519 limits (8.2% > 5.0%) on Phase A",
 *   "building_id": 1,
 *   "equipment_id": 8,
 *   "detected_value": 8.2,
 *   "threshold_value": 5.0,
 *   "threshold_config": {
 *     "standard": "IEEE519",
 *     "parameter": "voltage_thd",
 *     "limit": 5.0
 *   },
 *   "metadata": {
 *     "phase": "A",
 *     "measurement_location": "Main Distribution Panel",
 *     "duration_minutes": 15
 *   }
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Alert created successfully",
 *   "data": {
 *     "id": 156,
 *     "type": "power_quality",
 *     "severity": "high",
 *     "status": "active",
 *     "title": "Voltage THD Compliance Violation",
 *     "urgency": "high",
 *     "category": "Power Quality",
 *     "estimated_cost_impact": 8500.0,
 *     "escalation_level": 1,
 *     "notifications_sent": [
 *       "energymanager@company.com",
 *       "maintenance@company.com"
 *     ],
 *     "created_at": "2024-07-03T14:30:00Z",
 *     "escalation_timer": 60
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Validation failed",
 *   "error": "VALIDATION_ERROR",
 *   "details": {
 *     "severity": "Invalid severity level. Must be one of: low, medium, high, critical"
 *   }
 * }
 */
router.post(
  "/",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(createAlertValidation),
  alertController.createAlert
);

/**
 * @route PUT /api/alerts/:id
 * @desc Update alert information with comprehensive audit trail and escalation management
 * @details Updates alert details while maintaining complete audit trail including status changes,
 *          escalation level adjustments, stakeholder assignments, progress tracking, and resolution
 *          documentation. Handles intelligent re-prioritization based on updated information and
 *          manages notification workflows for stakeholder communication.
 * @access Private (Energy Manager, Facility Engineer, Admin)
 */
router.put(
  "/:id",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(idParamsValidation),
  validateBody(updateAlertValidation),
  alertController.updateAlert
);

/**
 * @route POST /api/alerts/:id/acknowledge
 * @desc Acknowledge alert receipt and initiate structured response workflow
 * @details Records alert acknowledgment with timestamp and responsible party, initiates response
 *          workflow with defined procedures, notifies stakeholders of acknowledgment, resets
 *          escalation timers, assigns response resources, and begins performance tracking for
 *          response time metrics and accountability.
 * @access Private (All authenticated users)
 */
router.post(
  "/:id/acknowledge",
  validateParams(idParamsValidation),
  alertController.acknowledgeAlert
);

/**
 * @route POST /api/alerts/:id/resolve
 * @desc Resolve alert with comprehensive documentation and lessons learned capture
 * @details Completes alert resolution with detailed root cause analysis, corrective actions taken,
 *          cost impact finalization, lessons learned documentation, preventive action recommendations,
 *          performance metrics completion, stakeholder notification, and quality assurance validation.
 *          Updates knowledge base for future reference and continuous improvement.
 * @access Private (Energy Manager, Facility Engineer, Admin)
 */
router.post(
  "/:id/resolve",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(idParamsValidation),
  validateBody(resolveAlertValidation),
  alertController.resolveAlert
);

// Alert threshold management endpoints

/**
 * @route GET /api/alerts/thresholds
 * @desc Retrieve alert threshold configurations with performance analytics and optimization insights
 * @details Fetches current threshold configurations with effectiveness analysis, false positive tracking,
 *          threshold tuning recommendations, industry benchmark comparisons, seasonal adjustment data,
 *          and parameter-specific calibration status. Provides optimization opportunities for improved
 *          alert accuracy and reduced noise.
 * @access Private (Energy Manager, Admin)
 */
router.get(
  "/thresholds",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateQuery(thresholdQueryValidation),
  alertController.getThresholds
);

/**
 * @route POST /api/alerts/thresholds
 * @desc Create optimized alert threshold with intelligent calibration and validation
 * @details Creates new alert threshold with historical data analysis for optimal calibration,
 *          industry benchmark integration, equipment-specific customization, seasonal adjustment
 *          configuration, false positive minimization algorithms, compliance requirement integration,
 *          and performance tracking setup for continuous optimization.
 * @access Private (Energy Manager, Admin)
 */
router.post(
  "/thresholds",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateBody(createThresholdValidation),
  alertController.createThreshold
);

// Monitoring and testing endpoints

/**
 * @route POST /api/alerts/test-monitoring/:buildingId
 * @desc Execute comprehensive monitoring system test with detailed validation and analysis
 * @details Performs extensive monitoring system testing including data acquisition validation,
 *          alert generation testing, power quality compliance verification, equipment monitoring
 *          validation, communication system testing, escalation workflow verification, and
 *          performance benchmarking. Provides comprehensive test results with system health
 *          assessment and improvement recommendations.
 * @access Private (Energy Manager, Admin)
 * @example_request
 * POST /api/alerts/test-monitoring/1
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "Content-Type": "application/json" }
 * Body: {
 *   "monitoring_type": "power_quality",
 *   "test_data": {
 *     "voltage_l1": 235.2,
 *     "voltage_l2": 230.8,
 *     "voltage_l3": 229.5,
 *     "thd_voltage": 6.8,
 *     "thd_current": 4.2,
 *     "power_factor": 0.89,
 *     "frequency": 59.95,
 *     "test_duration_minutes": 30
 *   }
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Monitoring test completed successfully",
 *   "data": {
 *     "test_id": "TEST-2024-07-03-001",
 *     "building_id": 1,
 *     "monitoring_type": "power_quality",
 *     "test_results": {
 *       "alerts_generated": 2,
 *       "compliance_violations": 1,
 *       "system_performance": "good",
 *       "data_accuracy": 98.5,
 *       "response_time_ms": 245
 *     },
 *     "alerts_created": [
 *       {
 *         "id": 158,
 *         "type": "power_quality",
 *         "severity": "medium",
 *         "title": "Voltage THD Approaching Limit",
 *         "detected_value": 6.8,
 *         "threshold_value": 5.0
 *       }
 *     ],
 *     "compliance_status": {
 *       "IEEE519": "non_compliant",
 *       "recommendations": [
 *         "Install harmonic filters on main distribution panel",
 *         "Review load balancing across phases"
 *       ]
 *     },
 *     "performance_metrics": {
 *       "processing_time_ms": 125,
 *       "notification_delivery_success": 100,
 *       "data_validation_passed": true
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Invalid test data provided",
 *   "error": "VALIDATION_ERROR",
 *   "details": {
 *     "test_data": "Required field missing: voltage_l1"
 *   }
 * }
 */
router.post(
  "/test-monitoring/:buildingId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  validateBody(testMonitoringValidation),
  alertController.testMonitoring
);

/**
 * @route POST /api/alerts/process-escalations
 * @desc Execute manual escalation processing with comprehensive stakeholder management
 * @details Performs manual escalation processing including critical alert identification,
 *          stakeholder notification escalation, management reporting, resource allocation assessment,
 *          response time analysis, system performance impact evaluation, compliance verification,
 *          and emergency response coordination when necessary.
 * @access Private (Admin only)
 */
router.post(
  "/process-escalations",
  authorizeRoles(UserRole.ADMIN),
  alertController.processEscalations
);

export default router;
