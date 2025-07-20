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
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

router.use(authenticateToken);

// Routes with debug logging
router.get(
  "/",
  debugRoute("COMPLIANCE", "GET_ALL_COMPLIANCE_CHECKS"),
  validateQuery(complianceQueryValidation),
  complianceController.getAllComplianceChecks
);

router.get(
  "/audit/:auditId",
  debugRoute("COMPLIANCE", "GET_COMPLIANCE_CHECKS_BY_AUDIT"),
  validateParams(auditIdParamsValidation),
  complianceController.getComplianceChecksByAudit
);

router.get(
  "/report/:auditId",
  debugRoute("COMPLIANCE", "GET_COMPLIANCE_REPORT"),
  validateParams(auditIdParamsValidation),
  complianceController.getComplianceReport
);

router.get(
  "/trends/:buildingId",
  debugRoute("COMPLIANCE", "GET_COMPLIANCE_TRENDS"),
  validateParams(buildingIdParamsValidation),
  validateQuery(complianceTrendsQueryValidation),
  complianceController.getComplianceTrends
);

router.post(
  "/check",
  debugRoute("COMPLIANCE", "PERFORM_COMPLIANCE_CHECK"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(performComplianceCheckValidation),
  complianceController.performComplianceCheck
);

router.post(
  "/",
  debugRoute("COMPLIANCE", "CREATE_COMPLIANCE_CHECK"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateBody(createComplianceCheckValidation),
  complianceController.createComplianceCheck
);

router.put(
  "/:id",
  debugRoute("COMPLIANCE", "UPDATE_COMPLIANCE_CHECK"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(idParamsValidation),
  validateBody(updateComplianceCheckValidation),
  complianceController.updateComplianceCheck
);

router.delete(
  "/:id",
  debugRoute("COMPLIANCE", "DELETE_COMPLIANCE_CHECK"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  complianceController.deleteComplianceCheck
);

export default router;
