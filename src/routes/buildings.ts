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

const router = Router();

router.use(authenticateToken);

// Routes

// Get all buildings with filtering and pagination
router.get(
  "/",
  validateQuery(getBuildingsValidation),
  buildingController.getBuildings
);

// Get specific building by ID
router.get(
  "/:id",
  validateParams(buildingParamsValidation),
  buildingController.getBuildingById
);

router.get(
  "/:id/deletion-check",
  validateParams(buildingParamsValidation),
  buildingController.checkBuildingDeletion
);

// Create new building
router.post(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateBody(createBuildingValidation),
  buildingController.createBuilding
);

// Update existing building
router.put(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingParamsValidation),
  validateBody(updateBuildingValidation),
  buildingController.updateBuilding
);

// Delete building
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN),
  validateParams(buildingParamsValidation),
  buildingController.deleteBuilding
);

export default router;
