// equipment.ts
import { Router } from "express";
import equipmentController from "@/controllers/equipmentController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import {
  equipmentQueryValidation,
  createEquipmentValidation,
  updateEquipmentValidation,
  equipmentParamsValidation,
  qrCodeParamsValidation,
  buildingIdOptionalParamsValidation,
  maintenanceQueryValidation,
  maintenanceLogValidation,
  performanceQueryValidation,
} from "@/validations/equipmentValidation";

const router = Router();

router.use(authenticateToken);

// Routes

// Get all equipment with filtering and pagination
router.get(
  "/",
  validateQuery(equipmentQueryValidation),
  equipmentController.getEquipment
);

// Get equipment by ID
router.get(
  "/:id",
  validateParams(equipmentParamsValidation),
  equipmentController.getEquipmentById
);

// Get equipment by QR code
router.get(
  "/qr/:qrCode",
  validateParams(qrCodeParamsValidation),
  equipmentController.getEquipmentByQR
);

// Get maintenance schedule (optionally filtered by building)
router.get(
  "/maintenance/schedule/:buildingId?",
  validateParams(buildingIdOptionalParamsValidation),
  validateQuery(maintenanceQueryValidation),
  equipmentController.getMaintenanceSchedule
);

// NEW ROUTES - Add these missing endpoints

// Get equipment maintenance history
router.get(
  "/:id/maintenance",
  validateParams(equipmentParamsValidation),
  validateQuery(maintenanceQueryValidation),
  equipmentController.getMaintenanceHistory
);

// Log equipment maintenance
router.post(
  "/:id/maintenance",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER,
    UserRole.STAFF
  ),
  validateParams(equipmentParamsValidation),
  validateBody(maintenanceLogValidation),
  equipmentController.logMaintenance
);

// Get equipment performance analytics
router.get(
  "/:id/performance",
  validateParams(equipmentParamsValidation),
  validateQuery(performanceQueryValidation),
  equipmentController.getPerformanceAnalytics
);

// Create new equipment
router.post(
  "/",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(createEquipmentValidation),
  equipmentController.createEquipment
);

// Update equipment
router.put(
  "/:id",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(equipmentParamsValidation),
  validateBody(updateEquipmentValidation),
  equipmentController.updateEquipment
);

// Delete equipment
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(equipmentParamsValidation),
  equipmentController.deleteEquipment
);

export default router;
