// reports.ts - Updated with Enhanced Energy Audit Report
import { Router } from "express";
import reportController from "@/controllers/reportController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import {
  reportsQueryValidation,
  generateEnergyReportValidation,
  generatePowerQualityReportValidation,
  generateAuditReportValidation,
  generateComplianceReportValidation,
  generateMonitoringReportValidation,
} from "@/validations/reportValidation";
import { idParamsValidation } from "@/validations/commonValidations";
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

router.use(authenticateToken);

// Routes with debug logging
router.get(
  "/",
  debugRoute("REPORTS", "GET_REPORTS"),
  validateQuery(reportsQueryValidation),
  reportController.getReports
);

router.get(
  "/stats",
  debugRoute("REPORTS", "GET_REPORT_STATS"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  reportController.getReportStats
);

router.get(
  "/:id",
  debugRoute("REPORTS", "GET_REPORT_BY_ID"),
  validateParams(idParamsValidation),
  reportController.getReportById
);

router.get(
  "/:id/download",
  debugRoute("REPORTS", "DOWNLOAD_REPORT"),
  validateParams(idParamsValidation),
  reportController.downloadReport
);

router.post(
  "/:id/regenerate",
  debugRoute("REPORTS", "REGENERATE_REPORT"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  reportController.regenerateReport
);

router.post(
  "/energy",
  debugRoute("REPORTS", "GENERATE_ENERGY_REPORT"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(generateEnergyReportValidation),
  reportController.generateEnergyReport
);

router.post(
  "/power-quality",
  debugRoute("REPORTS", "GENERATE_POWER_QUALITY_REPORT"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(generatePowerQualityReportValidation),
  reportController.generatePowerQualityReport
);

// UPDATED: Enhanced Energy Audit Report - Now generates comprehensive professional reports
router.post(
  "/audit",
  debugRoute("REPORTS", "GENERATE_COMPREHENSIVE_ENERGY_AUDIT_REPORT"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(generateAuditReportValidation),
  reportController.generateAuditReport // This now generates comprehensive energy audit reports
);

router.post(
  "/compliance",
  debugRoute("REPORTS", "GENERATE_COMPLIANCE_REPORT"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(generateComplianceReportValidation),
  reportController.generateComplianceReport
);

router.post(
  "/monitoring",
  debugRoute("REPORTS", "GENERATE_MONITORING_REPORT"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(generateMonitoringReportValidation),
  reportController.generateMonitoringReport
);

router.delete(
  "/:id",
  debugRoute("REPORTS", "DELETE_REPORT"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  reportController.deleteReport
);

export default router;
