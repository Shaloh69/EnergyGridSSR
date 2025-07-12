// analytics.ts
import { Router } from "express";
import analyticsController from "@/controllers/analyticsController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import {
  analysisQueryValidation,
  baselineQueryValidation,
  forecastQueryValidation,
  powerQualityAnalysisValidation,
  anomalyDetectionValidation,
  gapAnalysisValidation,
  equipmentIdParamsValidation,
  powerQualityParamsValidation,
} from "@/validations/analyticsValidation";
import {
  buildingIdParamsValidation,
  auditIdParamsValidation,
} from "@/validations/commonValidations";

const router = Router();

router.use(authenticateToken);

// Routes

// Run comprehensive analytics analysis
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

// Get analytics dashboard data - Portfolio view (no validation needed)
router.get(
  "/dashboard",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  analyticsController.getDashboard
);

// Calculate energy baseline for a building
router.post(
  "/baseline/:buildingId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  validateQuery(baselineQueryValidation),
  analyticsController.calculateBaseline
);

// Analyze power quality for specific reading
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

// Get maintenance predictions for equipment
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

// Generate energy consumption forecast
router.get(
  "/forecast/:buildingId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  validateQuery(forecastQueryValidation),
  analyticsController.generateForecast
);

// Detect anomalies
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

// Run compliance analysis for audit
router.post(
  "/compliance/:auditId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(auditIdParamsValidation),
  analyticsController.runComplianceAnalysis
);

// Generate benchmarking report for building
router.get(
  "/benchmarking/:buildingId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  analyticsController.generateBenchmarkingReport
);

// Perform gap analysis for audit
router.post(
  "/gap-analysis/:auditId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(auditIdParamsValidation),
  validateBody(gapAnalysisValidation),
  analyticsController.performGapAnalysis
);

export default router;
