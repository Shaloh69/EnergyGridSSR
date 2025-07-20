// powerQuality.ts
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
  powerQualityQueryValidation,
  createPowerQualityValidation,
  powerQualityParamsValidation,
  powerQualityEventsQueryValidation,
  powerQualityTrendsQueryValidation,
} from "@/validations/powerQualityValidation";
import { dateRangeValidation } from "@/validations/commonValidations";
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

router.use(authenticateToken);

// Routes with debug logging
router.get(
  "/",
  debugRoute("POWER_QUALITY", "GET_POWER_QUALITY_DATA"),
  validateQuery(powerQualityQueryValidation),
  powerQualityController.getPowerQualityData
);

router.get(
  "/stats/:buildingId",
  debugRoute("POWER_QUALITY", "GET_POWER_QUALITY_STATS"),
  validateParams(powerQualityParamsValidation),
  validateQuery(dateRangeValidation),
  powerQualityController.getPowerQualityStats
);

router.get(
  "/events/:buildingId",
  debugRoute("POWER_QUALITY", "GET_POWER_QUALITY_EVENTS"),
  validateParams(powerQualityParamsValidation),
  validateQuery(powerQualityEventsQueryValidation),
  powerQualityController.getPowerQualityEvents
);

router.get(
  "/trends/:buildingId",
  debugRoute("POWER_QUALITY", "ANALYZE_POWER_QUALITY_TRENDS"),
  validateParams(powerQualityParamsValidation),
  validateQuery(powerQualityTrendsQueryValidation),
  powerQualityController.analyzePowerQualityTrends
);

router.post(
  "/",
  debugRoute("POWER_QUALITY", "CREATE_POWER_QUALITY_READING"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(createPowerQualityValidation),
  powerQualityController.createPowerQualityReading
);

export default router;
