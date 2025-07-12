// reports.ts
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

const router = Router();

router.use(authenticateToken);

// Routes

// Get all reports with filtering and pagination
router.get(
  "/",
  validateQuery(reportsQueryValidation),
  reportController.getReports
);

// Get report statistics
router.get(
  "/stats",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  reportController.getReportStats
);

// Get specific report by ID
router.get(
  "/:id",
  validateParams(idParamsValidation),
  reportController.getReportById
);

// Download report file
router.get(
  "/:id/download",
  validateParams(idParamsValidation),
  reportController.downloadReport
);

// Regenerate existing report
router.post(
  "/:id/regenerate",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  reportController.regenerateReport
);

// Generate energy consumption report
router.post(
  "/energy",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(generateEnergyReportValidation),
  reportController.generateEnergyReport
);

// Generate power quality report
router.post(
  "/power-quality",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(generatePowerQualityReportValidation),
  reportController.generatePowerQualityReport
);

// Generate audit summary report
router.post(
  "/audit",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(generateAuditReportValidation),
  reportController.generateAuditReport
);

// Generate compliance report
router.post(
  "/compliance",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(generateComplianceReportValidation),
  reportController.generateComplianceReport
);

// Generate monitoring report
router.post(
  "/monitoring",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(generateMonitoringReportValidation),
  reportController.generateMonitoringReport
);

// Delete report
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  reportController.deleteReport
);

export default router;
