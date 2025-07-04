import { Router } from "express";
import analyticsController from "@/controllers/analyticsController";
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
const analysisQueryValidation = Joi.object({
  building_id: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
    "any.required": "Building ID is required",
  }),
  equipment_id: Joi.string().optional().pattern(/^\d+$/).messages({
    "string.pattern.base": "Equipment ID must be a valid number",
  }),
  start_date: Joi.string().required().isoDate().messages({
    "any.required": "Start date is required",
    "string.isoDate": "Start date must be a valid ISO date",
  }),
  end_date: Joi.string().required().isoDate().messages({
    "any.required": "End date is required",
    "string.isoDate": "End date must be a valid ISO date",
  }),
  analysis_types: Joi.string().optional().default("energy,anomaly,efficiency"),
});

const baselineQueryValidation = Joi.object({
  baseline_type: Joi.string()
    .valid("daily", "weekly", "monthly", "seasonal")
    .optional()
    .default("monthly"),
  lookback_days: Joi.string().pattern(/^\d+$/).optional().default("365"),
});

const forecastQueryValidation = Joi.object({
  forecast_days: Joi.string().pattern(/^\d+$/).optional().default("30"),
  forecast_type: Joi.string()
    .valid("consumption", "demand", "cost")
    .optional()
    .default("consumption"),
});

const powerQualityAnalysisValidation = Joi.object({
  voltageData: Joi.array().items(Joi.number()).required(),
  currentData: Joi.array().items(Joi.number()).optional(),
  frequencyData: Joi.array().items(Joi.number()).optional(),
});

const anomalyDetectionValidation = Joi.object({
  building_id: Joi.number().required(),
  equipment_id: Joi.number().optional(),
  start_date: Joi.date().required(),
  end_date: Joi.date().required(),
  analysis_types: Joi.array()
    .items(Joi.string().valid("energy", "power_quality", "equipment"))
    .required(),
  parameters: Joi.object().optional(),
});

const gapAnalysisValidation = Joi.object({
  target_standards: Joi.array()
    .items(Joi.string().valid("PEC2017", "OSHS", "ISO25010", "RA11285"))
    .optional(),
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

const equipmentIdParamsValidation = Joi.object({
  equipmentId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Equipment ID must be a valid number",
    "any.required": "Equipment ID is required",
  }),
});

const auditIdParamsValidation = Joi.object({
  auditId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Audit ID must be a valid number",
    "any.required": "Audit ID is required",
  }),
});

const powerQualityParamsValidation = Joi.object({
  buildingId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
    "any.required": "Building ID is required",
  }),
  pqReadingId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Power Quality Reading ID must be a valid number",
    "any.required": "Power Quality Reading ID is required",
  }),
});

// Analytics endpoints

/**
 * @route GET /api/analytics/analysis
 * @desc Execute comprehensive multi-dimensional analytics analysis with advanced insights
 * @details Performs sophisticated analytics including energy consumption analysis, anomaly detection,
 *          efficiency optimization opportunities, seasonal pattern recognition, weather correlation
 *          analysis, equipment performance correlation, cost optimization insights, and predictive
 *          modeling. Provides actionable recommendations for energy management improvement and
 *          operational efficiency enhancement.
 * @access Private (Energy Manager, Facility Engineer, Admin)
 * @example_request
 * GET /api/analytics/analysis?building_id=1&start_date=2024-06-01&end_date=2024-06-30&analysis_types=energy,anomaly,efficiency
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Analytics analysis completed successfully",
 *   "data": {
 *     "analysis_id": "ANALYSIS-2024-07-03-001",
 *     "building_id": 1,
 *     "analysis_period": {
 *       "start_date": "2024-06-01",
 *       "end_date": "2024-06-30",
 *       "duration_days": 30
 *     },
 *     "energy_analysis": {
 *       "total_consumption_kwh": 125750.5,
 *       "average_daily_consumption": 4191.68,
 *       "peak_demand_kw": 285.2,
 *       "load_factor": 0.73,
 *       "cost_analysis": {
 *         "total_cost_php": 1509005.50,
 *         "average_cost_per_kwh": 12.0,
 *         "potential_savings_php": 75450.25
 *       },
 *       "efficiency_score": 82.5,
 *       "baseline_comparison": 8.2
 *     },
 *     "anomaly_detection": {
 *       "anomalies_detected": 8,
 *       "severity_breakdown": {
 *         "high": 2,
 *         "medium": 4,
 *         "low": 2
 *       },
 *       "pattern_analysis": {
 *         "weekend_anomalies": 3,
 *         "peak_hour_anomalies": 5,
 *         "equipment_related": 6
 *       }
 *     },
 *     "efficiency_opportunities": [
 *       {
 *         "category": "HVAC Optimization",
 *         "potential_savings_kwh": 8500,
 *         "potential_savings_php": 102000,
 *         "implementation_cost": 250000,
 *         "payback_months": 29.4,
 *         "priority": "high"
 *       },
 *       {
 *         "category": "Lighting Upgrade",
 *         "potential_savings_kwh": 3200,
 *         "potential_savings_php": 38400,
 *         "implementation_cost": 85000,
 *         "payback_months": 26.6,
 *         "priority": "medium"
 *       }
 *     ],
 *     "recommendations": [
 *       "Implement HVAC scheduling optimization during non-peak hours",
 *       "Install smart lighting controls in common areas",
 *       "Consider power factor correction to reduce reactive power charges"
 *     ]
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Insufficient data for analysis period",
 *   "error": "INSUFFICIENT_DATA",
 *   "details": {
 *     "required_data_points": 720,
 *     "available_data_points": 245
 *   }
 * }
 */
router.get(
  "/analysis",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateQuery(analysisQueryValidation),
  analyticsController.runAnalysis
);

/**
 * @route GET /api/analytics/dashboard
 * @desc Generate comprehensive analytics dashboard with key performance indicators and insights
 * @details Provides executive-level analytics dashboard including energy efficiency trends,
 *          cost optimization opportunities, equipment performance analytics, anomaly detection
 *          summaries, predictive maintenance insights, compliance analytics, and strategic
 *          recommendations. Includes comparative analysis and benchmarking for continuous
 *          improvement planning.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/analytics/dashboard
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Analytics dashboard data retrieved successfully",
 *   "data": {
 *     "overview": {
 *       "total_buildings": 8,
 *       "total_equipment": 356,
 *       "data_points_collected": 2450000,
 *       "analysis_models_active": 15,
 *       "last_updated": "2024-07-03T14:30:00Z"
 *     },
 *     "energy_analytics": {
 *       "portfolio_efficiency_score": 83.4,
 *       "monthly_consumption_kwh": 875250.5,
 *       "monthly_cost_php": 10503006.00,
 *       "cost_savings_identified_php": 876500.50,
 *       "carbon_footprint_reduction_kg": 125000,
 *       "efficiency_trends": {
 *         "last_month": 2.1,
 *         "quarter": 5.8,
 *         "year": 12.3,
 *         "trend_direction": "improving"
 *       }
 *     },
 *     "predictive_insights": {
 *       "equipment_maintenance_predictions": [
 *         {
 *           "equipment_id": 12,
 *           "equipment_name": "Central Chiller Unit #1",
 *           "failure_probability": 15.2,
 *           "recommended_maintenance_date": "2024-08-15",
 *           "estimated_cost_php": 25000,
 *           "priority": "medium"
 *         },
 *         {
 *           "equipment_id": 28,
 *           "equipment_name": "Air Handling Unit #3",
 *           "failure_probability": 72.8,
 *           "recommended_maintenance_date": "2024-07-10",
 *           "estimated_cost_php": 45000,
 *           "priority": "high"
 *         }
 *       ],
 *       "energy_forecast": {
 *         "next_month_consumption_kwh": 920000,
 *         "next_month_cost_php": 11040000,
 *         "variance_confidence": 89.5,
 *         "peak_demand_forecast_kw": 1950,
 *         "cost_optimization_potential_php": 552000
 *       }
 *     },
 *     "anomaly_detection": {
 *       "anomalies_detected_last_week": 8,
 *       "critical_anomalies": 2,
 *       "cost_impact_php": 45250.50,
 *       "detection_accuracy": 94.2,
 *       "recent_anomalies": [
 *         {
 *           "timestamp": "2024-07-02T14:30:00Z",
 *           "building": "Manufacturing Plant A",
 *           "type": "energy_spike",
 *           "severity": "high",
 *           "cost_impact_php": 25000,
 *           "root_cause": "HVAC malfunction",
 *           "status": "resolved"
 *         }
 *       ]
 *     },
 *     "compliance_analytics": {
 *       "overall_compliance_score": 86.7,
 *       "ieee519_compliance_rate": 91.2,
 *       "pec2017_compliance_rate": 94.8,
 *       "oshs_compliance_rate": 82.1,
 *       "ra11285_compliance_rate": 88.9,
 *       "compliance_trends": {
 *         "improving_standards": ["IEEE519", "RA11285"],
 *         "declining_standards": ["OSHS"],
 *         "stable_standards": ["PEC2017"]
 *       }
 *     },
 *     "optimization_opportunities": [
 *       {
 *         "category": "Energy Efficiency",
 *         "opportunity": "HVAC scheduling optimization",
 *         "potential_savings_php": 125000,
 *         "implementation_cost_php": 85000,
 *         "payback_months": 8.2,
 *         "priority": "high"
 *       },
 *       {
 *         "category": "Power Quality",
 *         "opportunity": "Harmonic filtering installation",
 *         "potential_savings_php": 89000,
 *         "implementation_cost_php": 185000,
 *         "payback_months": 24.9,
 *         "priority": "medium"
 *       }
 *     ],
 *     "performance_benchmarking": {
 *       "industry_percentile": 78,
 *       "regional_ranking": 12,
 *       "best_performing_building": {
 *         "id": 1,
 *         "name": "Green Energy Office Complex",
 *         "efficiency_score": 92.5
 *       },
 *       "improvement_potential": {
 *         "energy_efficiency": 8.5,
 *         "cost_reduction": 12.3,
 *         "carbon_footprint": 15.2
 *       }
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Analytics engine temporarily unavailable",
 *   "error": "ANALYTICS_SERVICE_ERROR",
 *   "details": {
 *     "last_successful_update": "2024-07-03T14:15:00Z",
 *     "retry_after_seconds": 300
 *   }
 * }
 */
router.get("/dashboard", analyticsController.getAnalyticsDashboard);

/**
 * @route POST /api/analytics/baseline/:buildingId
 * @desc Calculate intelligent energy baseline with seasonal adjustments and weather normalization
 * @details Establishes sophisticated energy baseline using historical data analysis, seasonal
 *          adjustment algorithms, weather normalization techniques, occupancy pattern recognition,
 *          equipment operational mode analysis, and statistical modeling. Provides reference
 *          framework for performance evaluation and improvement tracking with confidence intervals
 *          and accuracy metrics.
 * @access Private (Energy Manager, Admin)
 */
router.post(
  "/baseline/:buildingId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  validateQuery(baselineQueryValidation),
  analyticsController.calculateBaseline
);

/**
 * @route POST /api/analytics/power-quality/:buildingId/:pqReadingId
 * @desc Analyze power quality events with IEEE 519 compliance assessment and equipment impact analysis
 * @details Performs comprehensive power quality analysis including harmonic distortion evaluation,
 *          voltage quality assessment, IEEE 519 compliance verification, ITIC curve analysis,
 *          equipment stress evaluation, power factor optimization opportunities, and cost impact
 *          assessment. Provides detailed recommendations for power quality improvement and
 *          equipment protection.
 * @access Private (Energy Manager, Facility Engineer, Admin)
 */
router.post(
  "/power-quality/:buildingId/:pqReadingId",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(powerQualityParamsValidation),
  validateBody(powerQualityAnalysisValidation),
  analyticsController.analyzePowerQuality
);

/**
 * @route GET /api/analytics/maintenance/:equipmentId
 * @desc Generate predictive maintenance insights with failure prediction and optimization recommendations
 * @details Provides advanced maintenance analytics including failure probability prediction,
 *          maintenance scheduling optimization, cost-benefit analysis of maintenance strategies,
 *          equipment life cycle assessment, performance degradation tracking, and replacement
 *          timing recommendations. Utilizes machine learning algorithms for predictive accuracy
 *          and maintenance cost optimization.
 * @access Private (Energy Manager, Facility Engineer, Admin)
 */
router.get(
  "/maintenance/:equipmentId",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(equipmentIdParamsValidation),
  analyticsController.getMaintenancePredictions
);

/**
 * @route GET /api/analytics/forecast/:buildingId
 * @desc Generate sophisticated energy consumption forecasts with multiple scenario analysis
 * @details Creates comprehensive energy forecasting including demand prediction, cost projection,
 *          seasonal adjustment forecasting, weather impact modeling, occupancy pattern prediction,
 *          equipment degradation impact, and multiple scenario analysis (optimistic, realistic,
 *          pessimistic). Provides confidence intervals and accuracy metrics for strategic
 *          planning and budget preparation.
 * @access Private (Energy Manager, Admin)
 */
router.get(
  "/forecast/:buildingId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  validateQuery(forecastQueryValidation),
  analyticsController.generateForecast
);

/**
 * @route POST /api/analytics/anomalies
 * @desc Detect and analyze anomalies with advanced pattern recognition and root cause analysis
 * @details Performs sophisticated anomaly detection using statistical modeling, machine learning
 *          algorithms, and pattern recognition techniques. Identifies energy consumption anomalies,
 *          equipment performance deviations, power quality irregularities, and operational
 *          inefficiencies. Provides root cause analysis and corrective action recommendations
 *          with priority-based implementation guidance.
 * @access Private (Energy Manager, Facility Engineer, Admin)
 * @example_request
 * POST /api/analytics/anomalies
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "Content-Type": "application/json" }
 * Body: {
 *   "building_id": 1,
 *   "equipment_id": 8,
 *   "start_date": "2024-06-01T00:00:00Z",
 *   "end_date": "2024-06-30T23:59:59Z",
 *   "analysis_types": ["energy", "power_quality", "equipment"],
 *   "parameters": {
 *     "sensitivity": "medium",
 *     "threshold_deviation": 2.5,
 *     "minimum_duration_minutes": 15,
 *     "exclude_weekends": false,
 *     "weather_correlation": true
 *   }
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Anomaly detection completed successfully",
 *   "data": {
 *     "detection_id": "ANOMALY-2024-07-03-001",
 *     "building_id": 1,
 *     "equipment_id": 8,
 *     "analysis_summary": {
 *       "total_anomalies": 15,
 *       "energy_anomalies": 8,
 *       "power_quality_anomalies": 4,
 *       "equipment_anomalies": 3,
 *       "confidence_score": 0.89
 *     },
 *     "anomalies": [
 *       {
 *         "id": "A001",
 *         "type": "energy",
 *         "severity": "high",
 *         "timestamp": "2024-06-15T14:30:00Z",
 *         "duration_minutes": 45,
 *         "description": "Energy consumption spike 85% above baseline",
 *         "detected_value": 385.2,
 *         "expected_value": 208.5,
 *         "deviation_percentage": 84.7,
 *         "confidence": 0.94,
 *         "root_cause_analysis": {
 *           "primary_cause": "HVAC system malfunction",
 *           "contributing_factors": ["High ambient temperature", "Faulty temperature sensor"],
 *           "equipment_correlation": "Central Chiller Unit #1"
 *         },
 *         "recommendations": [
 *           "Inspect and calibrate temperature sensors",
 *           "Check chiller refrigerant levels",
 *           "Review HVAC control programming"
 *         ],
 *         "estimated_cost_impact": 15750.50
 *       },
 *       {
 *         "id": "A002",
 *         "type": "power_quality",
 *         "severity": "medium",
 *         "timestamp": "2024-06-22T09:15:00Z",
 *         "duration_minutes": 20,
 *         "description": "Voltage harmonic distortion exceeded IEEE 519 limits",
 *         "detected_value": 6.8,
 *         "expected_value": 3.2,
 *         "deviation_percentage": 112.5,
 *         "confidence": 0.87,
 *         "root_cause_analysis": {
 *           "primary_cause": "Non-linear load startup",
 *           "contributing_factors": ["Variable frequency drives", "LED lighting bank"],
 *           "equipment_correlation": "Main Distribution Panel"
 *         }
 *       }
 *     ],
 *     "patterns": {
 *       "temporal_patterns": {
 *         "peak_anomaly_hours": ["14:00-16:00", "09:00-11:00"],
 *         "weekday_vs_weekend": {
 *           "weekday_anomalies": 12,
 *           "weekend_anomalies": 3
 *         }
 *       },
 *       "weather_correlation": {
 *         "temperature_correlation": 0.73,
 *         "humidity_correlation": 0.24
 *       }
 *     },
 *     "overall_recommendations": [
 *       "Implement predictive maintenance for HVAC systems",
 *       "Install power quality monitoring on critical circuits",
 *       "Review equipment startup sequences to minimize power quality impact"
 *     ]
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Analysis failed due to insufficient data quality",
 *   "error": "DATA_QUALITY_ERROR",
 *   "details": {
 *     "missing_data_percentage": 35.2,
 *     "data_gaps": [
 *       "2024-06-10T00:00:00Z to 2024-06-12T00:00:00Z",
 *       "2024-06-25T14:00:00Z to 2024-06-25T18:00:00Z"
 *     ]
 *   }
 * }
 */
router.post(
  "/anomalies",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(anomalyDetectionValidation),
  analyticsController.detectAnomalies
);

// Compliance Analytics endpoints

/**
 * @route POST /api/analytics/compliance/:auditId
 * @desc Execute comprehensive compliance analysis with multi-standard assessment and gap identification
 * @details Performs detailed compliance analysis across multiple Philippine standards (IEEE 519,
 *          PEC, OSHS, ISO 25010, RA 11285), identifies compliance gaps, calculates compliance
 *          scores, assesses regulatory risks, and provides prioritized corrective action plans.
 *          Includes cost-benefit analysis of compliance improvements and regulatory deadline
 *          tracking for strategic compliance management.
 * @access Private (Energy Manager, Admin)
 */
router.post(
  "/compliance/:auditId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(auditIdParamsValidation),
  analyticsController.runComplianceAnalysis
);

/**
 * @route GET /api/analytics/benchmarking/:buildingId
 * @desc Generate comprehensive compliance benchmarking with industry comparison and best practices
 * @details Provides detailed benchmarking analysis comparing building performance against industry
 *          standards, similar facilities, and best practices. Includes energy efficiency ranking,
 *          compliance score positioning, cost performance comparison, and identification of
 *          improvement opportunities. Delivers strategic recommendations for competitive
 *          advantage and compliance leadership.
 * @access Private (Energy Manager, Admin)
 */
router.get(
  "/benchmarking/:buildingId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  analyticsController.generateBenchmarkingReport
);

/**
 * @route POST /api/analytics/gap-analysis/:auditId
 * @desc Perform detailed compliance gap analysis with prioritized remediation planning
 * @details Conducts comprehensive gap analysis identifying specific compliance deficiencies,
 *          regulatory requirement misalignments, and improvement opportunities. Provides
 *          prioritized remediation plans with cost estimates, implementation timelines,
 *          resource requirements, and risk assessments. Includes regulatory change impact
 *          analysis and adaptation strategies for continuous compliance maintenance.
 * @access Private (Energy Manager, Admin)
 */
router.post(
  "/gap-analysis/:auditId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(auditIdParamsValidation),
  validateBody(gapAnalysisValidation),
  analyticsController.performGapAnalysis
);

export default router;
