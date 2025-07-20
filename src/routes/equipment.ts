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
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

router.use(authenticateToken);

// Routes with debug logging
router.get(
  "/",
  debugRoute("EQUIPMENT", "GET_EQUIPMENT"),
  validateQuery(equipmentQueryValidation),
  equipmentController.getEquipment
);

router.get(
  "/:id",
  debugRoute("EQUIPMENT", "GET_EQUIPMENT_BY_ID"),
  validateParams(equipmentParamsValidation),
  equipmentController.getEquipmentById
);

router.get(
  "/qr/:qrCode",
  debugRoute("EQUIPMENT", "GET_EQUIPMENT_BY_QR"),
  validateParams(qrCodeParamsValidation),
  equipmentController.getEquipmentByQR
);

router.get(
  "/maintenance/schedule/:buildingId?",
  debugRoute("EQUIPMENT", "GET_MAINTENANCE_SCHEDULE"),
  validateParams(buildingIdOptionalParamsValidation),
  validateQuery(maintenanceQueryValidation),
  equipmentController.getMaintenanceSchedule
);

router.get(
  "/:id/maintenance",
  debugRoute("EQUIPMENT", "GET_MAINTENANCE_HISTORY"),
  validateParams(equipmentParamsValidation),
  validateQuery(maintenanceQueryValidation),
  equipmentController.getMaintenanceHistory
);

router.post(
  "/:id/maintenance",
  debugRoute("EQUIPMENT", "LOG_MAINTENANCE"),
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

router.get(
  "/:id/performance",
  debugRoute("EQUIPMENT", "GET_PERFORMANCE_ANALYTICS"),
  validateParams(equipmentParamsValidation),
  validateQuery(performanceQueryValidation),
  equipmentController.getPerformanceAnalytics
);

router.post(
  "/",
  debugRoute("EQUIPMENT", "CREATE_EQUIPMENT"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(createEquipmentValidation),
  equipmentController.createEquipment
);

router.put(
  "/:id",
  debugRoute("EQUIPMENT", "UPDATE_EQUIPMENT"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(equipmentParamsValidation),
  validateBody(updateEquipmentValidation),
  equipmentController.updateEquipment
);

router.delete(
  "/:id",
  debugRoute("EQUIPMENT", "DELETE_EQUIPMENT"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(equipmentParamsValidation),
  equipmentController.deleteEquipment
);

export default router;
