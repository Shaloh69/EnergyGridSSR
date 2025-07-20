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
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

router.use(authenticateToken);

// Routes with debug logging
router.get(
  "/",
  debugRoute("ENERGY", "GET_ENERGY_CONSUMPTION"),
  validateQuery(energyQueryValidation),
  energyController.getEnergyConsumption
);

router.get(
  "/stats/:buildingId",
  debugRoute("ENERGY", "GET_ENERGY_STATS"),
  validateParams(buildingIdParamsValidation),
  validateQuery(dateRangeValidation),
  energyController.getEnergyStats
);

router.get(
  "/trends/:buildingId",
  debugRoute("ENERGY", "GET_ENERGY_TRENDS"),
  validateParams(buildingIdParamsValidation),
  validateQuery(energyTrendsQueryValidation),
  energyController.getEnergyTrends
);

router.get(
  "/comparison",
  debugRoute("ENERGY", "GET_BUILDING_COMPARISON"),
  validateQuery(dateRangeValidation),
  energyController.getBuildingComparison
);

router.post(
  "/",
  debugRoute("ENERGY", "CREATE_ENERGY_READING"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(createEnergyReadingValidation),
  energyController.createEnergyReading
);

router.put(
  "/:id",
  debugRoute("ENERGY", "UPDATE_ENERGY_READING"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(idParamsValidation),
  validateBody(updateEnergyReadingValidation),
  energyController.updateEnergyReading
);

router.delete(
  "/:id",
  debugRoute("ENERGY", "DELETE_ENERGY_READING"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  energyController.deleteEnergyReading
);

export default router;
