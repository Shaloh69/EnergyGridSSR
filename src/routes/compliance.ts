// compliance.ts
import { Router } from "express";
import complianceController from "@/controllers/complianceController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import {
  complianceQueryValidation,
  complianceTrendsQueryValidation,
  performComplianceCheckValidation,
  createComplianceCheckValidation,
  updateComplianceCheckValidation,
} from "@/validations/complianceValidation";
import {
  auditIdParamsValidation,
  buildingIdParamsValidation,
  idParamsValidation,
} from "@/validations/commonValidations";

const router = Router();

router.use(authenticateToken);

// Routes

// Get all compliance checks (paginated)
router.get(
  "/",
  validateQuery(complianceQueryValidation),
  complianceController.getAllComplianceChecks
);

// Get compliance checks for specific audit
router.get(
  "/audit/:auditId",
  validateParams(auditIdParamsValidation),
  complianceController.getComplianceChecksByAudit
);

// Get compliance report for audit
router.get(
  "/report/:auditId",
  validateParams(auditIdParamsValidation),
  complianceController.getComplianceReport
);

// Get compliance trends for building
router.get(
  "/trends/:buildingId",
  validateParams(buildingIdParamsValidation),
  validateQuery(complianceTrendsQueryValidation),
  complianceController.getComplianceTrends
);

// Perform compliance check
router.post(
  "/check",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(performComplianceCheckValidation),
  complianceController.performComplianceCheck
);

// Create new compliance check
router.post(
  "/",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(createComplianceCheckValidation),
  complianceController.createComplianceCheck
);

// Update compliance check
router.put(
  "/:id",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(idParamsValidation),
  validateBody(updateComplianceCheckValidation),
  complianceController.updateComplianceCheck
);

// Delete compliance check
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  complianceController.deleteComplianceCheck
);

export default router;
