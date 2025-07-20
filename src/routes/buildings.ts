// buildings.ts
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
  getBuildingsValidation,
  createBuildingValidation,
  updateBuildingValidation,
  buildingParamsValidation,
} from "@/validations/buildingValidation";
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

router.use(authenticateToken);

// Routes with debug logging
router.get(
  "/",
  debugRoute("BUILDINGS", "GET_BUILDINGS"),
  validateQuery(getBuildingsValidation),
  buildingController.getBuildings
);

router.get(
  "/:id",
  debugRoute("BUILDINGS", "GET_BUILDING_BY_ID"),
  validateParams(buildingParamsValidation),
  buildingController.getBuildingById
);

router.get(
  "/:id/deletion-check",
  debugRoute("BUILDINGS", "CHECK_BUILDING_DELETION"),
  validateParams(buildingParamsValidation),
  buildingController.checkBuildingDeletion
);

router.post(
  "/",
  debugRoute("BUILDINGS", "CREATE_BUILDING"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateBody(createBuildingValidation),
  buildingController.createBuilding
);

router.put(
  "/:id",
  debugRoute("BUILDINGS", "UPDATE_BUILDING"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingParamsValidation),
  validateBody(updateBuildingValidation),
  buildingController.updateBuilding
);

router.delete(
  "/:id",
  debugRoute("BUILDINGS", "DELETE_BUILDING"),
  authorizeRoles(UserRole.ADMIN),
  validateParams(buildingParamsValidation),
  buildingController.deleteBuilding
);

export default router;
