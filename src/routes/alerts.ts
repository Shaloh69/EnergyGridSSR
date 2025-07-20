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
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

router.use(authenticateToken);

// Routes with debug logging
router.get(
  "/",
  debugRoute("ALERTS", "GET_ALERTS"),
  validateQuery(alertQueryValidation),
  alertController.getAlerts
);

router.get(
  "/statistics",
  debugRoute("ALERTS", "GET_ALERT_STATISTICS"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateQuery(alertStatisticsQueryValidation),
  alertController.getAlertStatistics
);

router.get(
  "/:id",
  debugRoute("ALERTS", "GET_ALERT_BY_ID"),
  validateParams(idParamsValidation),
  alertController.getAlertById
);

router.post(
  "/",
  debugRoute("ALERTS", "CREATE_ALERT"),
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
  debugRoute("ALERTS", "UPDATE_ALERT"),
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
  debugRoute("ALERTS", "ACKNOWLEDGE_ALERT"),
  validateParams(idParamsValidation),
  alertController.acknowledgeAlert
);

router.post(
  "/:id/resolve",
  debugRoute("ALERTS", "RESOLVE_ALERT"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(idParamsValidation),
  validateBody(resolveAlertValidation),
  alertController.resolveAlert
);

router.get(
  "/thresholds",
  debugRoute("ALERTS", "GET_THRESHOLDS"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateQuery(thresholdQueryValidation),
  alertController.getThresholds
);

router.post(
  "/thresholds",
  debugRoute("ALERTS", "CREATE_THRESHOLD"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateBody(createThresholdValidation),
  alertController.createThreshold
);

router.post(
  "/test-monitoring/:buildingId",
  debugRoute("ALERTS", "TEST_MONITORING"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(buildingIdParamsValidation),
  validateBody(testMonitoringValidation),
  alertController.testMonitoring
);

router.post(
  "/process-escalations",
  debugRoute("ALERTS", "PROCESS_ESCALATIONS"),
  authorizeRoles(UserRole.ADMIN),
  alertController.processEscalations
);

export default router;
