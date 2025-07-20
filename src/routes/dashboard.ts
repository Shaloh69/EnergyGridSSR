// dashboard.ts
import { Router } from "express";
import dashboardController from "@/controllers/dashboardController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import { validateQuery } from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import { alertsQueryValidation } from "@/validations/dashboardValidation";
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

router.use(authenticateToken);

// Routes with debug logging
router.get(
  "/overview",
  debugRoute("DASHBOARD", "GET_DASHBOARD_OVERVIEW"),
  dashboardController.getDashboardOverview
);

router.get(
  "/real-time",
  debugRoute("DASHBOARD", "GET_REAL_TIME_METRICS"),
  dashboardController.getRealTimeMetrics
);

router.get(
  "/energy-summary",
  debugRoute("DASHBOARD", "GET_ENERGY_SUMMARY"),
  dashboardController.getEnergySummary
);

router.get(
  "/power-quality-summary",
  debugRoute("DASHBOARD", "GET_POWER_QUALITY_SUMMARY"),
  dashboardController.getPowerQualitySummary
);

router.get(
  "/audit-summary",
  debugRoute("DASHBOARD", "GET_AUDIT_SUMMARY"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  dashboardController.getAuditSummary
);

router.get(
  "/compliance-summary",
  debugRoute("DASHBOARD", "GET_COMPLIANCE_SUMMARY"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  dashboardController.getComplianceSummary
);

router.get(
  "/alerts",
  debugRoute("DASHBOARD", "GET_DASHBOARD_ALERTS"),
  validateQuery(alertsQueryValidation),
  dashboardController.getAlerts
);

export default router;
