import { Router } from "express";
import equipmentController from "@/controllers/equipmentController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import {
  createEquipmentValidation,
  updateEquipmentValidation,
  equipmentQueryValidation,
} from "@/validations/equipmentValidation";
import { idParamsValidation } from "@/validations/commonValidations";
import Joi from "joi";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Create validation schemas for parameters
const qrCodeParamsValidation = Joi.object({
  qrCode: Joi.string().required().min(1).messages({
    "any.required": "QR Code is required",
    "string.empty": "QR Code cannot be empty",
  }),
});

const buildingIdParamsValidation = Joi.object({
  buildingId: Joi.string().optional().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
  }),
});

/**
 * @route GET /api/equipment
 * @desc Retrieve comprehensive equipment inventory with operational status and performance analytics
 * @details Fetches equipment list with advanced filtering including building association, equipment
 *          type categorization, operational status tracking, maintenance status indicators,
 *          performance metrics, energy consumption correlation, condition assessment, warranty
 *          information, and predictive maintenance indicators. Provides complete equipment
 *          portfolio visibility for strategic asset management and operational optimization.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/equipment?building_id=1&equipment_type=hvac&status=operational&page=1&limit=10
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Equipment retrieved successfully",
 *   "data": {
 *     "equipment": [
 *       {
 *         "id": 12,
 *         "name": "Central Chiller Unit #1",
 *         "code": "CCU-001",
 *         "building_id": 1,
 *         "building_name": "Green Energy Office Complex",
 *         "equipment_type": "hvac",
 *         "manufacturer": "Carrier",
 *         "model": "30XA1002",
 *         "serial_number": "CCU1234567",
 *         "installation_date": "2022-03-15",
 *         "power_rating_kw": 150.5,
 *         "status": "operational",
 *         "condition_score": 88.5,
 *         "performance_metrics": {
 *           "efficiency_percentage": 92.3,
 *           "availability_percentage": 98.7,
 *           "energy_consumption_kwh_day": 3600,
 *           "operating_hours_month": 720,
 *           "maintenance_cost_monthly_php": 15000
 *         },
 *         "maintenance_info": {
 *           "last_maintenance": "2024-06-15T08:00:00Z",
 *           "next_maintenance_due": "2024-09-15T08:00:00Z",
 *           "maintenance_type": "preventive",
 *           "maintenance_score": 85.2
 *         },
 *         "predictive_analysis": {
 *           "failure_risk_score": 15.2,
 *           "estimated_remaining_life_years": 12.5,
 *           "recommended_actions": [
 *             "Monitor refrigerant levels",
 *             "Check compressor performance"
 *           ]
 *         },
 *         "warranty_info": {
 *           "warranty_status": "active",
 *           "warranty_expiry": "2027-03-15",
 *           "warranty_type": "comprehensive"
 *         },
 *         "alerts": {
 *           "active_alerts": 0,
 *           "last_alert": null,
 *           "alert_history_count": 3
 *         },
 *         "qr_code": "QR_CCU001_2024",
 *         "created_at": "2022-03-15T10:00:00Z",
 *         "updated_at": "2024-07-03T12:00:00Z"
 *       }
 *     ],
 *     "pagination": {
 *       "current_page": 1,
 *       "per_page": 10,
 *       "total_pages": 5,
 *       "total_count": 45
 *     },
 *     "summary_statistics": {
 *       "total_equipment": 45,
 *       "operational": 42,
 *       "maintenance_required": 3,
 *       "offline": 0,
 *       "average_condition_score": 84.7,
 *       "total_power_rating_kw": 2850.5,
 *       "monthly_maintenance_cost_php": 185000
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Building not found",
 *   "error": "BUILDING_NOT_FOUND",
 *   "details": {
 *     "building_id": 999
 *   }
 * }
 */
router.get(
  "/",
  validateQuery(equipmentQueryValidation),
  equipmentController.getEquipment
);

/**
 * @route GET /api/equipment/:id
 * @desc Retrieve detailed equipment information with comprehensive operational data and analytics
 * @details Fetches complete equipment profile including specifications, installation details,
 *          operational history, maintenance records, performance metrics, energy consumption
 *          patterns, condition assessments, warranty status, spare parts inventory, associated
 *          alerts, cost analysis, and predictive maintenance insights. Provides comprehensive
 *          equipment management dashboard for informed decision-making and maintenance planning.
 * @access Private (All authenticated users)
 */
router.get(
  "/:id",
  validateParams(idParamsValidation),
  equipmentController.getEquipmentById
);

/**
 * @route GET /api/equipment/qr/:qrCode
 * @desc Retrieve equipment information via QR code for mobile access and field operations
 * @details Provides mobile-optimized equipment access using QR code scanning including basic
 *          equipment information, current operational status, recent maintenance history,
 *          performance indicators, quick action capabilities, alert status, and emergency
 *          contact information. Enables field personnel to quickly access equipment data
 *          and perform maintenance operations with complete context and safety information.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/equipment/qr/QR_CCU001_2024
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Equipment retrieved successfully via QR code",
 *   "data": {
 *     "equipment": {
 *       "id": 12,
 *       "name": "Central Chiller Unit #1",
 *       "code": "CCU-001",
 *       "qr_code": "QR_CCU001_2024",
 *       "equipment_type": "hvac",
 *       "manufacturer": "Carrier",
 *       "model": "30XA1002",
 *       "serial_number": "CCU1234567",
 *       "building_name": "Green Energy Office Complex",
 *       "location": "Mechanical Room - Level B1"
 *     },
 *     "current_status": {
 *       "operational_status": "running",
 *       "condition_score": 88.5,
 *       "performance_efficiency": 92.3,
 *       "last_reading": "2024-07-03T14:25:00Z",
 *       "current_load_percentage": 75.2,
 *       "temperature_c": 8.5,
 *       "pressure_bar": 2.1
 *     },
 *     "alerts": {
 *       "active_alerts": 0,
 *       "last_alert": null,
 *       "status_indicator": "green"
 *     },
 *     "maintenance_info": {
 *       "last_maintenance": "2024-06-15T08:00:00Z",
 *       "next_maintenance_due": "2024-09-15T08:00:00Z",
 *       "days_until_maintenance": 74,
 *       "maintenance_type": "preventive",
 *       "technician_assigned": "John Dela Cruz"
 *     },
 *     "quick_actions": [
 *       {
 *         "action": "log_maintenance",
 *         "label": "Log Maintenance Work",
 *         "available": true
 *       },
 *       {
 *         "action": "report_issue",
 *         "label": "Report Issue",
 *         "available": true
 *       },
 *       {
 *         "action": "emergency_stop",
 *         "label": "Emergency Stop",
 *         "available": true,
 *         "requires_confirmation": true
 *       }
 *     ],
 *     "safety_info": {
 *       "safety_rating": "standard",
 *       "ppe_required": ["Safety glasses", "Hearing protection"],
 *       "emergency_procedures": "Follow lockout/tagout procedures before maintenance",
 *       "emergency_contact": "+63-2-555-0123"
 *     },
 *     "documentation": {
 *       "manual_url": "/documents/carrier-30xa1002-manual.pdf",
 *       "wiring_diagram": "/documents/ccu001-wiring.pdf",
 *       "maintenance_log": "/equipment/12/maintenance-log"
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "QR code not found or expired",
 *   "error": "QR_CODE_NOT_FOUND",
 *   "details": {
 *     "qr_code": "QR_CCU001_2023",
 *     "suggestion": "QR code may have been updated. Contact system administrator."
 *   }
 * }
 */
router.get(
  "/qr/:qrCode",
  validateParams(qrCodeParamsValidation),
  equipmentController.getEquipmentByQR
);

/**
 * @route GET /api/equipment/maintenance/schedule/:buildingId?
 * @desc Generate comprehensive maintenance schedule with optimization and resource planning
 * @details Provides intelligent maintenance scheduling including preventive maintenance calendars,
 *          predictive maintenance recommendations, resource allocation optimization, maintenance
 *          priority ranking, cost-benefit analysis, equipment downtime minimization, maintenance
 *          team scheduling, spare parts planning, and compliance requirement integration.
 *          Supports strategic maintenance planning and operational efficiency optimization.
 * @access Private (All authenticated users)
 */
router.get(
  "/maintenance/schedule/:buildingId?",
  validateParams(buildingIdParamsValidation),
  equipmentController.getMaintenanceSchedule
);

/**
 * @route POST /api/equipment
 * @desc Create comprehensive equipment record with integrated monitoring and maintenance setup
 * @details Creates new equipment entry with complete initialization including specification
 *          documentation, installation parameters, operational baseline establishment, maintenance
 *          schedule creation, monitoring threshold configuration, alert setup, QR code generation,
 *          warranty tracking, spare parts inventory initialization, and energy consumption
 *          baseline establishment. Provides complete equipment lifecycle management foundation.
 * @access Private (Admin, Energy Manager, Facility Engineer)
 */
router.post(
  "/",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(createEquipmentValidation),
  equipmentController.createEquipment
);

/**
 * @route PUT /api/equipment/:id
 * @desc Update equipment information with comprehensive impact analysis and recalibration
 * @details Updates equipment record with intelligent change management including specification
 *          updates, status changes with impact analysis, maintenance schedule adjustments,
 *          monitoring threshold recalibration, performance baseline updates, cost impact
 *          assessment, warranty status updates, and dependent system synchronization.
 *          Maintains equipment data integrity while enabling flexible asset management.
 * @access Private (Admin, Energy Manager, Facility Engineer)
 */
router.put(
  "/:id",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(idParamsValidation),
  validateBody(updateEquipmentValidation),
  equipmentController.updateEquipment
);

/**
 * @route DELETE /api/equipment/:id
 * @desc Remove equipment with comprehensive data archival and dependency management
 * @details Securely deletes equipment with complete asset lifecycle management including
 *          dependency validation, maintenance record archival, monitoring configuration cleanup,
 *          alert threshold removal, performance data archival, cost impact finalization,
 *          warranty closure, spare parts redistribution, and referential integrity maintenance.
 *          Ensures complete asset decommissioning while preserving historical data for
 *          regulatory compliance and analytical purposes.
 * @access Private (Admin, Energy Manager)
 */
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  equipmentController.deleteEquipment
);

export default router;
