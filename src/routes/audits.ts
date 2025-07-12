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

const router = Router();

router.use(authenticateToken);

// Routes

// Get all audits with filtering and pagination
router.get("/", validateQuery(auditQueryValidation), auditController.getAudits);

// Get audit summary statistics
router.get(
  "/summary",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateQuery(dateRangeValidation),
  auditController.getAuditSummary
);

// Get specific audit by ID
router.get(
  "/:id",
  validateParams(auditParamsValidation),
  auditController.getAuditById
);

// Create new audit
router.post(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateBody(createAuditValidation),
  auditController.createAudit
);

// Update existing audit
router.put(
  "/:id",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(auditParamsValidation),
  validateBody(updateAuditValidation),
  auditController.updateAudit
);

// Delete audit
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(auditParamsValidation),
  auditController.deleteAudit
);

export default router;
