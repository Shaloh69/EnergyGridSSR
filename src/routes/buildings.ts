import { Router } from "express";
import buildingController from "@/controllers/buildingController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import {
  createBuildingValidation,
  updateBuildingValidation,
  getBuildingsValidation,
} from "@/validations/buildingValidation";
import { idParamsValidation } from "@/validations/commonValidations";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/buildings
 * @desc Retrieve comprehensive building inventory with advanced filtering and analytics
 * @details Fetches paginated building list with sophisticated filtering capabilities including
 *          text search across names, codes, and descriptions, status-based filtering (active,
 *          maintenance, inactive), multi-field sorting options, and comprehensive building
 *          metadata. Includes building performance summaries, energy efficiency indicators,
 *          equipment counts, recent activity summaries, and operational status dashboards
 *          for effective building portfolio management.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/buildings?search=office&status=active&sortBy=efficiency_score&sortOrder=DESC&page=1&limit=10
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Buildings retrieved successfully",
 *   "data": {
 *     "buildings": [
 *       {
 *         "id": 1,
 *         "name": "Green Energy Office Complex",
 *         "code": "GEOC-001",
 *         "description": "LEED certified office building with renewable energy systems",
 *         "address": "1234 Makati Avenue, Makati City, Metro Manila, Philippines",
 *         "area_sqm": 8500,
 *         "floors": 15,
 *         "year_built": 2022,
 *         "building_type": "commercial",
 *         "status": "active",
 *         "performance_summary": {
 *           "efficiency_score": 88.5,
 *           "energy_intensity_kwh_sqm": 145.2,
 *           "carbon_intensity_kg_co2_sqm": 89.7,
 *           "cost_per_sqm_php": 285.40
 *         },
 *         "equipment_summary": {
 *           "total_equipment": 45,
 *           "operational": 42,
 *           "maintenance_required": 3,
 *           "offline": 0
 *         },
 *         "recent_metrics": {
 *           "monthly_consumption_kwh": 125750.5,
 *           "monthly_cost_php": 1509005.50,
 *           "average_power_factor": 0.94,
 *           "active_alerts": 2
 *         },
 *         "compliance_status": {
 *           "overall_score": 86.7,
 *           "last_audit": "2024-06-15",
 *           "next_audit_due": "2024-09-15"
 *         },
 *         "created_at": "2024-01-15T09:00:00Z",
 *         "updated_at": "2024-07-03T10:30:00Z"
 *       }
 *     ],
 *     "pagination": {
 *       "current_page": 1,
 *       "per_page": 10,
 *       "total_pages": 1,
 *       "total_count": 8,
 *       "has_next": false,
 *       "has_previous": false
 *     },
 *     "summary_statistics": {
 *       "total_buildings": 8,
 *       "active_buildings": 7,
 *       "total_area_sqm": 125000,
 *       "average_efficiency_score": 83.2,
 *       "total_monthly_consumption_kwh": 875250.5,
 *       "total_monthly_cost_php": 10503006.00
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Invalid sort field specified",
 *   "error": "VALIDATION_ERROR",
 *   "details": {
 *     "invalid_field": "invalid_sort_field",
 *     "allowed_fields": ["name", "code", "area_sqm", "efficiency_score", "created_at"]
 *   }
 * }
 */
router.get(
  "/",
  validateQuery(getBuildingsValidation),
  buildingController.getBuildings
);

/**
 * @route GET /api/buildings/:id
 * @desc Retrieve detailed building information with comprehensive operational data and analytics
 * @details Fetches complete building profile including basic specifications, physical
 *          characteristics, operational status, associated equipment inventory with status
 *          summaries, recent energy consumption metrics, power quality indicators, audit
 *          history with compliance status, maintenance schedules, alert summaries, and
 *          performance analytics. Provides comprehensive building dashboard data for
 *          detailed facility management and operational oversight.
 * @access Private (All authenticated users)
 */
router.get(
  "/:id",
  validateParams(idParamsValidation),
  buildingController.getBuildingById
);

/**
 * @route POST /api/buildings
 * @desc Create comprehensive building record with integrated energy management setup
 * @details Creates new building with complete initialization including basic information setup,
 *          physical specification documentation, building type classification, operational
 *          status establishment, energy baseline creation, equipment inventory framework,
 *          compliance standard assignment based on building type, monitoring system configuration,
 *          and initial dashboard setup. Establishes foundation for comprehensive energy
 *          management and operational monitoring.
 * @access Private (Admin, Energy Manager)
 * @example_request
 * POST /api/buildings
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "Content-Type": "application/json" }
 * Body: {
 *   "name": "Sustainable Technology Center",
 *   "code": "STC-002",
 *   "description": "Advanced technology center with integrated renewable energy systems and smart building automation",
 *   "address": "5678 Technology Boulevard, Bonifacio Global City, Taguig, Metro Manila, Philippines",
 *   "area_sqm": 12500,
 *   "floors": 8,
 *   "year_built": 2023,
 *   "building_type": "commercial",
 *   "status": "active",
 *   "additional_info": {
 *     "certifications": ["LEED Gold", "BERDE 4-Star"],
 *     "renewable_energy": {
 *       "solar_capacity_kw": 150,
 *       "energy_storage_kwh": 500
 *     },
 *     "automation_level": "advanced",
 *     "occupancy_capacity": 800,
 *     "parking_spaces": 200
 *   },
 *   "energy_targets": {
 *     "annual_consumption_target_kwh": 1800000,
 *     "carbon_reduction_target_percent": 25,
 *     "renewable_energy_target_percent": 15
 *   }
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Building created successfully",
 *   "data": {
 *     "id": 9,
 *     "name": "Sustainable Technology Center",
 *     "code": "STC-002",
 *     "description": "Advanced technology center with integrated renewable energy systems and smart building automation",
 *     "address": "5678 Technology Boulevard, Bonifacio Global City, Taguig, Metro Manila, Philippines",
 *     "area_sqm": 12500,
 *     "floors": 8,
 *     "year_built": 2023,
 *     "building_type": "commercial",
 *     "status": "active",
 *     "initialization_results": {
 *       "energy_baseline_created": true,
 *       "monitoring_thresholds_configured": true,
 *       "compliance_standards_assigned": [
 *         "IEEE519",
 *         "PEC2017",
 *         "OSHS",
 *         "RA11285"
 *       ],
 *       "dashboard_configured": true,
 *       "alert_profiles_created": 5
 *     },
 *     "default_settings": {
 *       "energy_efficiency_target": 85.0,
 *       "power_factor_target": 0.95,
 *       "carbon_intensity_target_kg_co2_sqm": 75.0,
 *       "monitoring_interval_minutes": 15
 *     },
 *     "next_steps": [
 *       "Configure equipment inventory",
 *       "Set up IoT sensor network",
 *       "Schedule initial energy audit",
 *       "Train facility management team"
 *     ],
 *     "created_at": "2024-07-03T14:30:00Z",
 *     "created_by": 15,
 *     "estimated_setup_completion": "2024-07-10T00:00:00Z"
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Building code already exists",
 *   "error": "DUPLICATE_BUILDING_CODE",
 *   "details": {
 *     "existing_building": {
 *       "id": 3,
 *       "name": "Existing Building",
 *       "code": "STC-002"
 *     },
 *     "suggestion": "Use code STC-003 or modify existing building"
 *   }
 * }
 */
router.post(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateBody(createBuildingValidation),
  buildingController.createBuilding
);

/**
 * @route PUT /api/buildings/:id
 * @desc Update building information with comprehensive impact analysis and recalibration
 * @details Updates building record with intelligent change management including information
 *          updates, specification modifications, status changes with audit trail logging,
 *          energy baseline recalculation for significant changes, compliance requirement
 *          updates, equipment validation triggers, historical data preservation, and
 *          dependent system updates. Maintains data integrity while enabling flexible
 *          building management and operational adjustments.
 * @access Private (Admin, Energy Manager)
 */
router.put(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  validateBody(updateBuildingValidation),
  buildingController.updateBuilding
);

/**
 * @route DELETE /api/buildings/:id
 * @desc Remove building with comprehensive data management and compliance preservation
 * @details Securely deletes building with complete data lifecycle management including
 *          dependency validation, historical data archival, audit record preservation,
 *          equipment reassignment or archival, monitoring configuration cleanup, alert
 *          threshold removal, dashboard update, maintenance schedule cleanup, and
 *          referential integrity maintenance. Includes deletion audit trail creation
 *          for regulatory compliance and data governance requirements.
 * @access Private (Admin only)
 */
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN),
  validateParams(idParamsValidation),
  buildingController.deleteBuilding
);

export default router;
