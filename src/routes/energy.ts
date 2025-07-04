import { Router } from "express";
import energyController from "@/controllers/energyController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import {
  createEnergyReadingValidation,
  updateEnergyReadingValidation,
  energyQueryValidation,
  dateRangeValidation, // Use the energy-specific one with interval support
} from "@/validations/energyValidation";
import {
  idParamsValidation,
  buildingIdParamsValidation,
} from "@/validations/commonValidations";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/energy
 * @desc Retrieve comprehensive energy consumption data with advanced analytics and cost optimization
 * @details Fetches energy consumption records with sophisticated analysis including multi-building
 *          aggregation, time-based interval analysis (hourly, daily, weekly, monthly), energy
 *          type breakdown (active, reactive, apparent power), Philippine utility rate integration,
 *          peak demand analysis, power factor monitoring, energy baseline comparisons, carbon
 *          footprint calculations using local grid emission factors, and anomaly detection.
 *          Provides actionable insights for energy management and cost optimization.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/energy?building_id=1&start_date=2024-06-01&end_date=2024-06-30&interval=daily&include_cost=true
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Energy consumption data retrieved successfully",
 *   "data": {
 *     "building_id": 1,
 *     "building_name": "Green Energy Office Complex",
 *     "period": {
 *       "start_date": "2024-06-01",
 *       "end_date": "2024-06-30",
 *       "interval": "daily",
 *       "total_days": 30
 *     },
 *     "summary": {
 *       "total_consumption_kwh": 125750.5,
 *       "total_cost_php": 1509005.50,
 *       "average_daily_consumption": 4191.68,
 *       "peak_demand_kw": 285.2,
 *       "average_power_factor": 0.94,
 *       "load_factor": 0.73,
 *       "carbon_footprint_kg_co2": 89025.35
 *     },
 *     "daily_data": [
 *       {
 *         "date": "2024-06-01",
 *         "active_power_kwh": 4250.8,
 *         "reactive_power_kvarh": 825.4,
 *         "apparent_power_kvah": 4329.6,
 *         "power_factor": 0.98,
 *         "peak_demand_kw": 275.5,
 *         "cost_php": 51009.60,
 *         "cost_breakdown": {
 *           "energy_charge": 45606.00,
 *           "demand_charge": 4128.75,
 *           "power_factor_penalty": 0.00,
 *           "taxes_and_fees": 1274.85
 *         },
 *         "carbon_footprint_kg_co2": 3012.06
 *       }
 *     ],
 *     "analytics": {
 *       "efficiency_rating": "Good",
 *       "baseline_comparison": {
 *         "variance_percentage": 8.2,
 *         "trend": "increasing"
 *       },
 *       "cost_optimization": {
 *         "potential_monthly_savings": 25180.50,
 *         "recommendations": [
 *           "Shift 15% of load to off-peak hours",
 *           "Improve power factor to 0.95+ to avoid penalties"
 *         ]
 *       }
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "No energy data found for specified period",
 *   "error": "NO_DATA_FOUND",
 *   "details": {
 *     "building_id": 1,
 *     "period": "2024-06-01 to 2024-06-30"
 *   }
 * }
 */
router.get(
  "/",
  validateQuery(energyQueryValidation),
  energyController.getEnergyConsumption
);

/**
 * @route GET /api/energy/stats/:buildingId
 * @desc Generate detailed energy statistics with performance metrics and optimization insights
 * @details Provides comprehensive energy analysis including total consumption and demand statistics,
 *          peak and off-peak usage patterns with Philippine time-of-use rate analysis, power
 *          factor performance with IEEE 519 compliance assessment, energy efficiency indicators
 *          (kWh/sqm, kWh/occupant), seasonal consumption trends with weather correlation, load
 *          factor calculations, cost breakdown analysis, benchmarking against similar buildings,
 *          and energy conservation opportunity identification with savings potential calculations.
 * @access Private (All authenticated users)
 */
router.get(
  "/stats/:buildingId",
  validateParams(buildingIdParamsValidation),
  validateQuery(dateRangeValidation),
  energyController.getEnergyStats
);

/**
 * @route GET /api/energy/trends/:buildingId
 * @desc Analyze energy consumption trends with predictive modeling and forecasting
 * @details Performs advanced trend analysis including historical consumption patterns with
 *          seasonal adjustments, predictive modeling for future energy requirements, weather-
 *          normalized usage calculations, growth rate analysis, capacity planning recommendations,
 *          energy efficiency trend tracking, cost escalation projections, peak demand progression,
 *          equipment degradation impact assessment, and comparative benchmarking with industry
 *          standards. Provides strategic insights for energy planning and investment decisions.
 * @access Private (All authenticated users)
 */
router.get(
  "/trends/:buildingId",
  validateParams(buildingIdParamsValidation),
  validateQuery(dateRangeValidation),
  energyController.getEnergyTrends
);

/**
 * @route GET /api/energy/comparison
 * @desc Compare energy performance across buildings with benchmarking and ranking analysis
 * @details Provides multi-building energy performance comparison including normalized consumption
 *          metrics (kWh/sqm, kWh/occupant), relative performance ranking with percentile scoring,
 *          cost efficiency analysis across different building types, power quality correlation,
 *          energy efficiency best practices identification, Philippine building energy code
 *          compliance comparison, carbon footprint analysis, operational performance indicators,
 *          and energy management maturity assessment. Enables portfolio optimization and
 *          best practice sharing across facilities.
 * @access Private (All authenticated users)
 */
router.get(
  "/comparison",
  validateQuery(dateRangeValidation),
  energyController.getBuildingComparison
);

/**
 * @route POST /api/energy
 * @desc Create new energy consumption reading with comprehensive validation and analytics
 * @details Records new energy consumption data with advanced validation including multi-parameter
 *          readings (active, reactive, apparent power), power quality indicators, timestamp
 *          validation, duplicate detection, data quality assessment, automatic cost calculation
 *          using current Philippine utility rates, real-time alert generation for anomalies,
 *          equipment correlation, energy baseline updates, and IoT sensor integration.
 *          Provides immediate feedback on data quality and system performance.
 * @access Private (Admin, Energy Manager, Facility Engineer)
 * @example_request
 * POST /api/energy
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "Content-Type": "application/json" }
 * Body: {
 *   "building_id": 1,
 *   "active_power_kwh": 1850.75,
 *   "reactive_power_kvarh": 445.20,
 *   "apparent_power_kvah": 1902.50,
 *   "power_factor": 0.973,
 *   "voltage_v": 230.8,
 *   "current_a": 8.25,
 *   "frequency_hz": 59.98,
 *   "peak_demand_kw": 275.5,
 *   "temperature_c": 28.5,
 *   "humidity_percent": 65.2,
 *   "recorded_at": "2024-07-03T14:30:00Z",
 *   "meter_reading": "MT001_14:30",
 *   "data_quality_flags": {
 *     "validated": true,
 *     "source": "smart_meter",
 *     "confidence": 0.98
 *   }
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Energy reading created successfully",
 *   "data": {
 *     "id": 8745,
 *     "building_id": 1,
 *     "reading_data": {
 *       "active_power_kwh": 1850.75,
 *       "reactive_power_kvarh": 445.20,
 *       "apparent_power_kvah": 1902.50,
 *       "power_factor": 0.973,
 *       "efficiency_rating": "Excellent"
 *     },
 *     "cost_analysis": {
 *       "total_cost_php": 22209.00,
 *       "cost_breakdown": {
 *         "energy_charge": 19809.00,
 *         "demand_charge": 1651.25,
 *         "power_factor_bonus": -345.60,
 *         "taxes_and_fees": 1094.35
 *       },
 *       "cost_per_kwh": 12.0
 *     },
 *     "quality_assessment": {
 *       "data_quality_score": 98.5,
 *       "validation_passed": true,
 *       "anomaly_detected": false,
 *       "baseline_variance": 5.2
 *     },
 *     "alerts_generated": [],
 *     "recommendations": [
 *       "Maintain excellent power factor performance",
 *       "Consider load scheduling during off-peak hours"
 *     ],
 *     "created_at": "2024-07-03T14:30:00Z",
 *     "processed_at": "2024-07-03T14:30:02Z"
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Data validation failed",
 *   "error": "VALIDATION_ERROR",
 *   "details": {
 *     "power_factor": "Value 1.05 exceeds theoretical maximum of 1.0",
 *     "apparent_power_kvah": "Calculated value does not match provided value"
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
  validateBody(createEnergyReadingValidation),
  energyController.createEnergyReading
);

/**
 * @route PUT /api/energy/:id
 * @desc Update energy reading with comprehensive recalculation and impact analysis
 * @details Updates energy consumption record with intelligent impact management including
 *          data validation, cost recalculation, efficiency metrics updates, trend analysis
 *          recalculation, baseline adjustments, audit trail maintenance, alert re-evaluation,
 *          dashboard updates, and dependent system synchronization. Ensures data integrity
 *          and consistency across all analytical and reporting systems.
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
  validateBody(updateEnergyReadingValidation),
  energyController.updateEnergyReading
);

/**
 * @route DELETE /api/energy/:id
 * @desc Remove energy reading with comprehensive impact analysis and data integrity maintenance
 * @details Securely deletes energy consumption record with complete impact management including
 *          dependency validation, statistics recalculation, trend analysis adjustment, cost
 *          recalculation, baseline updates, alert cleanup, dashboard synchronization, audit
 *          trail creation, and referential integrity maintenance. Ensures data consistency
 *          and accuracy across all dependent calculations and reporting systems.
 * @access Private (Admin, Energy Manager)
 */
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  energyController.deleteEnergyReading
);

export default router;
