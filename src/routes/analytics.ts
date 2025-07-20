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
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

router.use(authenticateToken);

// Routes with debug logging
router.get(
  "/analysis",
  debugRoute("ANALYTICS", "RUN_ANALYSIS"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateQuery(analysisQueryValidation),
  analyticsController.runAnalysis
);

router.get(
  "/dashboard",
  debugRoute("ANALYTICS", "GET_DASHBOARD"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  analyticsController.getDashboard
);

router.post(
  "/baseline/:buildingId",
  debugRoute("ANALYTICS", "CALCULATE_BASELINE"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  validateQuery(baselineQueryValidation),
  analyticsController.calculateBaseline
);

router.post(
  "/power-quality/:buildingId/:pqReadingId",
  debugRoute("ANALYTICS", "ANALYZE_POWER_QUALITY"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(powerQualityParamsValidation),
  validateBody(powerQualityAnalysisValidation),
  analyticsController.analyzePowerQuality
);

router.get(
  "/maintenance/:equipmentId",
  debugRoute("ANALYTICS", "GET_MAINTENANCE_PREDICTIONS"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(equipmentIdParamsValidation),
  analyticsController.getMaintenancePredictions
);

router.get(
  "/forecast/:buildingId",
  debugRoute("ANALYTICS", "GENERATE_FORECAST"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  validateQuery(forecastQueryValidation),
  analyticsController.generateForecast
);

router.post(
  "/anomalies",
  debugRoute("ANALYTICS", "DETECT_ANOMALIES"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(anomalyDetectionValidation),
  analyticsController.detectAnomalies
);

router.post(
  "/compliance/:auditId",
  debugRoute("ANALYTICS", "RUN_COMPLIANCE_ANALYSIS"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(auditIdParamsValidation),
  analyticsController.runComplianceAnalysis
);

router.get(
  "/benchmarking/:buildingId",
  debugRoute("ANALYTICS", "GENERATE_BENCHMARKING_REPORT"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  analyticsController.generateBenchmarkingReport
);

router.post(
  "/gap-analysis/:auditId",
  debugRoute("ANALYTICS", "PERFORM_GAP_ANALYSIS"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(auditIdParamsValidation),
  validateBody(gapAnalysisValidation),
  analyticsController.performGapAnalysis
);

export default router;
