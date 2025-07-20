// audits.ts
import { Router } from "express";
import auditController from "@/controllers/auditController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import {
  auditQueryValidation,
  createAuditValidation,
  updateAuditValidation,
  auditParamsValidation,
} from "@/validations/auditValidation";
import { dateRangeValidation } from "@/validations/commonValidations";
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

router.use(authenticateToken);

// Routes with debug logging
router.get(
  "/",
  debugRoute("AUDITS", "GET_AUDITS"),
  validateQuery(auditQueryValidation),
  auditController.getAudits
);

router.get(
  "/summary",
  debugRoute("AUDITS", "GET_AUDIT_SUMMARY"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateQuery(dateRangeValidation),
  auditController.getAuditSummary
);

router.get(
  "/:id",
  debugRoute("AUDITS", "GET_AUDIT_BY_ID"),
  validateParams(auditParamsValidation),
  auditController.getAuditById
);

router.post(
  "/",
  debugRoute("AUDITS", "CREATE_AUDIT"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateBody(createAuditValidation),
  auditController.createAudit
);

router.put(
  "/:id",
  debugRoute("AUDITS", "UPDATE_AUDIT"),
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(auditParamsValidation),
  validateBody(updateAuditValidation),
  auditController.updateAudit
);

router.delete(
  "/:id",
  debugRoute("AUDITS", "DELETE_AUDIT"),
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(auditParamsValidation),
  auditController.deleteAudit
);

export default router;
