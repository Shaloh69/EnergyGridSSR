// alerts.ts
import { Router } from "express";
import alertController from "@/controllers/alertController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import {
  alertQueryValidation,
  createAlertValidation,
  updateAlertValidation,
  resolveAlertValidation,
  createThresholdValidation,
  thresholdQueryValidation,
  testMonitoringValidation,
  alertStatisticsQueryValidation,
} from "@/validations/alertValidation";
import {
  idParamsValidation,
  buildingIdParamsValidation,
} from "@/validations/commonValidations";

const router = Router();

router.use(authenticateToken);

// Routes
router.get("/", validateQuery(alertQueryValidation), alertController.getAlerts);

router.get(
  "/statistics",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateQuery(alertStatisticsQueryValidation),
  alertController.getAlertStatistics
);

router.get(
  "/:id",
  validateParams(idParamsValidation),
  alertController.getAlertById
);

router.post(
  "/",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(createAlertValidation),
  alertController.createAlert
);

router.put(
  "/:id",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(idParamsValidation),
  validateBody(updateAlertValidation),
  alertController.updateAlert
);

router.post(
  "/:id/acknowledge",
  validateParams(idParamsValidation),
  alertController.acknowledgeAlert
);

router.post(
  "/:id/resolve",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(idParamsValidation),
  validateBody(resolveAlertValidation),
  alertController.resolveAlert
);

// Alert Thresholds Routes
router.get(
  "/thresholds",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateQuery(thresholdQueryValidation),
  alertController.getThresholds
);

router.post(
  "/thresholds",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateBody(createThresholdValidation),
  alertController.createThreshold
);

// Monitoring & Testing Routes
router.post(
  "/test-monitoring/:buildingId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  validateBody(testMonitoringValidation),
  alertController.testMonitoring
);

router.post(
  "/process-escalations",
  authorizeRoles(UserRole.ADMIN),
  alertController.processEscalations
);

export default router;
