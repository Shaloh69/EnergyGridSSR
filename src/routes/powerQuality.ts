import { Router } from "express";
import powerQualityController from "@/controllers/powerQualityController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import {
  createPowerQualityValidation,
  powerQualityQueryValidation,
} from "@/validations/powerQualityValidation";
import {
  buildingIdParamsValidation,
  dateRangeValidation,
} from "@/validations/commonValidations";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/power-quality
 * @desc Retrieve comprehensive power quality data with IEEE 519 compliance analysis and event classification
 * @details Provides detailed power quality monitoring including voltage quality parameters (RMS, THD,
 *          unbalance, sags, swells), current quality metrics (THD, harmonic distortion), power factor
 *          analysis, frequency stability assessment, IEEE 519 compliance verification, ITIC curve
 *          analysis, power quality event detection and classification, equipment impact assessment,
 *          and grid synchronization indicators. Includes cost impact analysis and improvement
 *          recommendations for optimal power system performance.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/power-quality?building_id=1&start_date=2024-07-01&end_date=2024-07-03&include_events=true
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Power quality data retrieved successfully",
 *   "data": {
 *     "building_id": 1,
 *     "building_name": "Green Energy Office Complex",
 *     "period": {
 *       "start_date": "2024-07-01",
 *       "end_date": "2024-07-03",
 *       "duration_hours": 72
 *     },
 *     "summary": {
 *       "total_readings": 288,
 *       "ieee519_compliance_rate": 89.2,
 *       "itic_compliance_rate": 94.8,
 *       "power_quality_score": 87.5,
 *       "events_detected": 5
 *     },
 *     "latest_reading": {
 *       "id": 15847,
 *       "recorded_at": "2024-07-03T14:30:00Z",
 *       "voltage_quality": {
 *         "voltage_l1": 230.5,
 *         "voltage_l2": 229.8,
 *         "voltage_l3": 230.2,
 *         "voltage_unbalance": 0.15,
 *         "thd_voltage": 3.2,
 *         "ieee519_voltage_limit": 5.0,
 *         "compliance_status": "compliant"
 *       },
 *       "current_quality": {
 *         "current_l1": 8.1,
 *         "current_l2": 8.3,
 *         "current_l3": 8.0,
 *         "thd_current": 4.8,
 *         "ieee519_current_limit": 8.0,
 *         "compliance_status": "compliant"
 *       },
 *       "power_metrics": {
 *         "power_factor": 0.95,
 *         "frequency": 59.98,
 *         "apparent_power_kva": 4.2,
 *         "reactive_power_kvar": 1.3
 *       }
 *     },
 *     "events": [
 *       {
 *         "id": 245,
 *         "event_type": "voltage_sag",
 *         "severity": "medium",
 *         "start_time": "2024-07-02T09:15:30Z",
 *         "end_time": "2024-07-02T09:15:42Z",
 *         "duration_ms": 12000,
 *         "magnitude": 0.85,
 *         "affected_phases": ["L1"],
 *         "itic_curve_violation": false,
 *         "equipment_impact": ["UPS System", "Computer Equipment"],
 *         "estimated_cost": 2500.00
 *       }
 *     ],
 *     "compliance_analysis": {
 *       "ieee519": {
 *         "voltage_thd_compliance": 95.8,
 *         "current_thd_compliance": 87.2,
 *         "overall_score": 89.2,
 *         "violations": 2
 *       },
 *       "itic_curve": {
 *         "voltage_tolerance_compliance": 94.8,
 *         "ride_through_capability": "good"
 *       }
 *     },
 *     "recommendations": [
 *       "Install voltage regulators on Phase L1",
 *       "Consider harmonic filters for non-linear loads",
 *       "Upgrade UPS systems for better ride-through capability"
 *     ]
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "No power quality data found for specified period",
 *   "error": "NO_DATA_FOUND"
 * }
 */
router.get(
  "/",
  validateQuery(powerQualityQueryValidation),
  powerQualityController.getPowerQualityData
);

/**
 * @route GET /api/power-quality/stats/:buildingId
 * @desc Generate comprehensive power quality statistics with compliance scoring and performance analytics
 * @details Provides detailed power quality analysis including statistical analysis of voltage and
 *          current parameters, power factor trending with capacitor bank performance, harmonic
 *          distortion analysis with source identification, voltage unbalance monitoring, power
 *          quality event frequency analysis, equipment efficiency correlation, cost impact
 *          assessment, Philippine electrical standards compliance scoring, and predictive
 *          maintenance indicators based on electrical stress analysis.
 * @access Private (All authenticated users)
 */
router.get(
  "/stats/:buildingId",
  validateParams(buildingIdParamsValidation),
  validateQuery(dateRangeValidation),
  powerQualityController.getPowerQualityStats
);

/**
 * @route GET /api/power-quality/events/:buildingId
 * @desc Analyze power quality events with detailed impact assessment and root cause analysis
 * @details Provides comprehensive power quality event analysis including event detection and
 *          classification (sags, swells, interruptions, transients), duration and magnitude
 *          analysis, equipment impact evaluation, protection system performance assessment,
 *          root cause analysis with external factor correlation, ITIC curve violation tracking,
 *          IEEE 519 compliance analysis, financial impact calculation, event frequency trending,
 *          and preventive action recommendations for system improvement.
 * @access Private (All authenticated users)
 */
router.get(
  "/events/:buildingId",
  validateParams(buildingIdParamsValidation),
  validateQuery(dateRangeValidation),
  powerQualityController.getPowerQualityEvents
);

/**
 * @route POST /api/power-quality
 * @desc Record power quality measurement with real-time analysis and automated alert generation
 * @details Creates comprehensive power quality record with immediate analysis including multi-parameter
 *          data recording (voltage, current, power, harmonics), real-time IEEE 519 and ITIC compliance
 *          checking, automatic event detection and classification, equipment impact assessment,
 *          protection system evaluation, alert generation for critical violations, cost impact
 *          calculation, SCADA system integration, data validation, and automatic regulatory
 *          compliance report generation for continuous power quality monitoring.
 * @access Private (Admin, Energy Manager, Facility Engineer)
 * @example_request
 * POST /api/power-quality
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "Content-Type": "application/json" }
 * Body: {
 *   "building_id": 1,
 *   "voltage_l1": 230.5,
 *   "voltage_l2": 229.8,
 *   "voltage_l3": 230.2,
 *   "current_l1": 8.1,
 *   "current_l2": 8.3,
 *   "current_l3": 8.0,
 *   "power_factor": 0.95,
 *   "thd_voltage": 3.2,
 *   "thd_current": 4.8,
 *   "frequency": 59.98,
 *   "voltage_unbalance": 0.15,
 *   "harmonic_data": {
 *     "voltage_harmonics": [0, 0, 2.1, 1.8, 0.9, 0.5],
 *     "current_harmonics": [0, 0, 3.2, 2.1, 1.5, 0.8]
 *   },
 *   "recorded_at": "2024-07-03T14:30:00Z",
 *   "measurement_location": "Main Distribution Panel",
 *   "equipment_ids": [1, 8, 12]
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Power quality reading created successfully",
 *   "data": {
 *     "id": 15848,
 *     "building_id": 1,
 *     "reading_summary": {
 *       "power_quality_score": 87.5,
 *       "ieee519_compliance": "compliant",
 *       "itic_compliance": "compliant",
 *       "overall_assessment": "good"
 *     },
 *     "compliance_analysis": {
 *       "ieee519": {
 *         "voltage_thd": {
 *           "measured": 3.2,
 *           "limit": 5.0,
 *           "status": "compliant",
 *           "margin": 1.8
 *         },
 *         "current_thd": {
 *           "measured": 4.8,
 *           "limit": 8.0,
 *           "status": "compliant",
 *           "margin": 3.2
 *         }
 *       },
 *       "voltage_regulation": {
 *         "unbalance": 0.15,
 *         "limit": 2.0,
 *         "status": "excellent"
 *       }
 *     },
 *     "events_detected": [],
 *     "equipment_impact": {
 *       "affected_equipment": 0,
 *       "stress_level": "low",
 *       "efficiency_impact": 0.2
 *     },
 *     "cost_analysis": {
 *       "power_factor_impact": 0.00,
 *       "efficiency_loss_cost": 125.50,
 *       "potential_equipment_damage": 0.00
 *     },
 *     "alerts_generated": [],
 *     "recommendations": [
 *       "Power quality performance is excellent",
 *       "Continue monitoring harmonic levels during peak loads"
 *     ],
 *     "created_at": "2024-07-03T14:30:00Z",
 *     "processed_at": "2024-07-03T14:30:01Z"
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Power quality violation detected",
 *   "error": "COMPLIANCE_VIOLATION",
 *   "details": {
 *     "violations": [
 *       {
 *         "parameter": "thd_voltage",
 *         "measured": 6.8,
 *         "limit": 5.0,
 *         "standard": "IEEE519"
 *       }
 *     ],
 *     "alerts_created": [158, 159]
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
  validateBody(createPowerQualityValidation),
  powerQualityController.createPowerQualityReading
);

export default router;
