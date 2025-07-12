// dashboard.ts
import { Router } from "express";
import dashboardController from "@/controllers/dashboardController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import { validateQuery } from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import { alertsQueryValidation } from "@/validations/dashboardValidation";

const router = Router();

router.use(authenticateToken);

// Routes

// Get dashboard overview data
router.get("/overview", dashboardController.getDashboardOverview);

// Get real-time metrics
router.get("/real-time", dashboardController.getRealTimeMetrics);

// Get energy summary
router.get("/energy-summary", dashboardController.getEnergySummary);

// Get power quality summary
router.get(
  "/power-quality-summary",
  dashboardController.getPowerQualitySummary
);

// Get audit summary
router.get(
  "/audit-summary",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  dashboardController.getAuditSummary
);

// Get compliance summary
router.get(
  "/compliance-summary",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  dashboardController.getComplianceSummary
);

// Get active alerts for dashboard
router.get(
  "/alerts",
  validateQuery(alertsQueryValidation),
  dashboardController.getAlerts
);

export default router;
