// energy.ts
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
  energyQueryValidation,
  createEnergyReadingValidation,
  updateEnergyReadingValidation,
  dateRangeValidation,
  energyTrendsQueryValidation,
} from "@/validations/energyValidation";
import {
  idParamsValidation,
  buildingIdParamsValidation,
} from "@/validations/commonValidations";

const router = Router();

router.use(authenticateToken);

// Routes

// Get energy consumption data with filtering and pagination
router.get(
  "/",
  validateQuery(energyQueryValidation),
  energyController.getEnergyConsumption
);

// Get energy statistics for a building
router.get(
  "/stats/:buildingId",
  validateParams(buildingIdParamsValidation),
  validateQuery(dateRangeValidation),
  energyController.getEnergyStats
);

// Get energy trends for a building
router.get(
  "/trends/:buildingId",
  validateParams(buildingIdParamsValidation),
  validateQuery(energyTrendsQueryValidation),
  energyController.getEnergyTrends
);

// Get building comparison data
router.get(
  "/comparison",
  validateQuery(dateRangeValidation),
  energyController.getBuildingComparison
);

// Create new energy reading
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

// Update energy reading
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

// Delete energy reading
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  energyController.deleteEnergyReading
);

export default router;
