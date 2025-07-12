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

const router = Router();

router.use(authenticateToken);

// Routes

// Get power quality data with pagination and filtering
router.get(
  "/",
  validateQuery(powerQualityQueryValidation),
  powerQualityController.getPowerQualityData
);

// Get power quality statistics for a building
router.get(
  "/stats/:buildingId",
  validateParams(powerQualityParamsValidation),
  validateQuery(dateRangeValidation),
  powerQualityController.getPowerQualityStats
);

// Get power quality events for a building
router.get(
  "/events/:buildingId",
  validateParams(powerQualityParamsValidation),
  validateQuery(powerQualityEventsQueryValidation),
  powerQualityController.getPowerQualityEvents
);

// Analyze power quality trends for a building
router.get(
  "/trends/:buildingId",
  validateParams(powerQualityParamsValidation),
  validateQuery(powerQualityTrendsQueryValidation),
  powerQualityController.analyzePowerQualityTrends
);

// Create new power quality reading
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
