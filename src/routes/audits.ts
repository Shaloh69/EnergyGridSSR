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
  createAuditValidation,
  updateAuditValidation,
  auditQueryValidation,
} from "@/validations/auditValidation";
import {
  idParamsValidation,
  dateRangeValidation,
} from "@/validations/commonValidations";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/audits
 * @desc Retrieve comprehensive energy audits with multi-criteria filtering and compliance tracking
 * @details Fetches detailed audit data with sophisticated filtering including audit type classification,
 *          compliance standard tracking (IEEE 519, PEC, OSHS, ISO 25010, RA 11285), progress monitoring,
 *          building and auditor filtering, status-based queries, and date range specifications.
 *          Includes audit performance metrics, compliance scoring, risk assessment summaries, and
 *          energy savings potential calculations with prioritized improvement recommendations.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/audits?building_id=1&audit_type=energy_efficiency&status=completed&page=1&limit=10
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Audits retrieved successfully",
 *   "data": {
 *     "audits": [
 *       {
 *         "id": 23,
 *         "title": "Q2 2024 Energy Efficiency & Compliance Audit",
 *         "description": "Comprehensive audit covering energy efficiency, power quality, and regulatory compliance",
 *         "audit_type": "comprehensive",
 *         "status": "completed",
 *         "building_id": 1,
 *         "building_name": "Green Energy Office Complex",
 *         "auditor_id": 15,
 *         "auditor_name": "Maria Santos",
 *         "planned_start_date": "2024-06-01",
 *         "planned_end_date": "2024-06-15",
 *         "actual_start_date": "2024-06-01",
 *         "actual_end_date": "2024-06-14",
 *         "completed_date": "2024-06-14T16:30:00Z",
 *         "compliance_score": 86.7,
 *         "risk_score": 23.5,
 *         "energy_savings_potential_kwh": 25000,
 *         "cost_savings_potential_php": 300000,
 *         "implementation_cost_php": 850000,
 *         "payback_period_months": 34,
 *         "compliance_standards": [
 *           {
 *             "standard": "IEEE519",
 *             "score": 89.2,
 *             "status": "compliant",
 *             "violations": 2
 *           },
 *           {
 *             "standard": "PEC2017",
 *             "score": 92.5,
 *             "status": "compliant",
 *             "violations": 0
 *           },
 *           {
 *             "standard": "OSHS",
 *             "score": 78.3,
 *             "status": "needs_improvement",
 *             "violations": 5
 *           },
 *           {
 *             "standard": "RA11285",
 *             "score": 85.9,
 *             "status": "compliant",
 *             "violations": 1
 *           }
 *         ],
 *         "findings_summary": {
 *           "critical_findings": 2,
 *           "high_priority_findings": 8,
 *           "medium_priority_findings": 15,
 *           "low_priority_findings": 12,
 *           "total_findings": 37
 *         },
 *         "recommendations_summary": {
 *           "immediate_actions": 3,
 *           "short_term_actions": 12,
 *           "long_term_actions": 8,
 *           "implemented": 5,
 *           "in_progress": 7,
 *           "planned": 13
 *         },
 *         "created_at": "2024-05-15T09:00:00Z",
 *         "updated_at": "2024-06-14T16:30:00Z"
 *       }
 *     ],
 *     "pagination": {
 *       "current_page": 1,
 *       "per_page": 10,
 *       "total_pages": 3,
 *       "total_count": 23
 *     },
 *     "summary_statistics": {
 *       "total_audits": 23,
 *       "completed_audits": 18,
 *       "in_progress_audits": 3,
 *       "planned_audits": 2,
 *       "average_compliance_score": 83.4,
 *       "total_savings_potential_php": 2850000,
 *       "total_implemented_savings_php": 1275000
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Invalid audit type specified",
 *   "error": "VALIDATION_ERROR",
 *   "details": {
 *     "invalid_type": "invalid_audit_type",
 *     "allowed_types": ["energy_efficiency", "power_quality", "compliance", "comprehensive"]
 *   }
 * }
 */
router.get("/", validateQuery(auditQueryValidation), auditController.getAudits);

/**
 * @route GET /api/audits/summary
 * @desc Generate comprehensive audit program analytics with KPI tracking and trend analysis
 * @details Provides executive-level audit program summary including completion rate analytics,
 *          compliance score distributions, energy efficiency improvement tracking, cost-benefit
 *          analysis of recommendations, risk mitigation progress, auditor performance metrics,
 *          building compliance rankings, and ROI analysis of implemented improvements. Includes
 *          strategic insights for audit program optimization and resource allocation.
 * @access Private (All authenticated users)
 */
router.get(
  "/summary",
  validateQuery(dateRangeValidation),
  auditController.getAuditSummary
);

/**
 * @route GET /api/audits/:id
 * @desc Retrieve detailed audit information with comprehensive findings and implementation tracking
 * @details Fetches complete audit documentation including methodology details, scope definition,
 *          comprehensive findings with evidence, multi-standard compliance assessment, detailed
 *          risk analysis with impact matrices, prioritized recommendations with cost-benefit
 *          analysis, implementation progress tracking, energy savings calculations, and
 *          follow-up action plans with responsibility assignments and timelines.
 * @access Private (All authenticated users)
 */
router.get(
  "/:id",
  validateParams(idParamsValidation),
  auditController.getAuditById
);

/**
 * @route POST /api/audits
 * @desc Create comprehensive energy audit with integrated compliance framework and baseline establishment
 * @details Initiates new energy audit with complete setup including scope definition, methodology
 *          selection, building baseline establishment, compliance framework mapping across
 *          multiple standards (IEEE 519, PEC, OSHS, ISO 25010, RA 11285), equipment inventory,
 *          data collection strategy, stakeholder identification, risk assessment framework,
 *          audit timeline with milestones, and resource allocation with auditor assignments.
 * @access Private (Admin, Energy Manager)
 * @example_request
 * POST /api/audits
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "Content-Type": "application/json" }
 * Body: {
 *   "title": "Q3 2024 Energy Efficiency & Compliance Audit",
 *   "description": "Comprehensive audit covering energy efficiency, power quality, and regulatory compliance for sustainability certification",
 *   "building_id": 1,
 *   "audit_type": "comprehensive",
 *   "auditor_id": 15,
 *   "planned_start_date": "2024-08-01",
 *   "planned_end_date": "2024-08-15",
 *   "scope": "Complete building energy systems, power quality assessment, and multi-standard compliance evaluation",
 *   "compliance_standards": ["IEEE519", "PEC2017", "OSHS", "ISO25010", "RA11285"],
 *   "methodology": "ISO 50001 based energy audit with Philippine regulatory compliance assessment",
 *   "objectives": [
 *     "Identify energy conservation opportunities",
 *     "Assess IEEE 519 power quality compliance",
 *     "Evaluate safety compliance per OSHS standards",
 *     "Determine RA 11285 energy efficiency compliance"
 *   ],
 *   "stakeholders": [
 *     {
 *       "role": "building_manager",
 *       "name": "Juan Dela Cruz",
 *       "email": "juan.delacruz@company.com"
 *     },
 *     {
 *       "role": "facility_engineer",
 *       "name": "Ana Rodriguez",
 *       "email": "ana.rodriguez@company.com"
 *     }
 *   ],
 *   "budget_php": 150000,
 *   "expected_savings_target_php": 500000
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Audit created successfully",
 *   "data": {
 *     "id": 24,
 *     "title": "Q3 2024 Energy Efficiency & Compliance Audit",
 *     "description": "Comprehensive audit covering energy efficiency, power quality, and regulatory compliance for sustainability certification",
 *     "audit_type": "comprehensive",
 *     "status": "planned",
 *     "building_id": 1,
 *     "building_name": "Green Energy Office Complex",
 *     "auditor_id": 15,
 *     "auditor_name": "Maria Santos",
 *     "planned_start_date": "2024-08-01",
 *     "planned_end_date": "2024-08-15",
 *     "audit_framework": {
 *       "methodology": "ISO 50001 based energy audit with Philippine regulatory compliance assessment",
 *       "compliance_standards": [
 *         {
 *           "standard": "IEEE519",
 *           "scope": "Power quality and harmonic compliance",
 *           "checklist_items": 25
 *         },
 *         {
 *           "standard": "PEC2017",
 *           "scope": "Electrical installation safety",
 *           "checklist_items": 18
 *         },
 *         {
 *           "standard": "OSHS",
 *           "scope": "Occupational safety and health",
 *           "checklist_items": 32
 *         },
 *         {
 *           "standard": "ISO25010",
 *           "scope": "System quality requirements",
 *           "checklist_items": 15
 *         },
 *         {
 *           "standard": "RA11285",
 *           "scope": "Energy efficiency and conservation",
 *           "checklist_items": 22
 *         }
 *       ]
 *     },
 *     "baseline_data": {
 *       "energy_baseline_established": true,
 *       "baseline_period": "2024-02-01 to 2024-07-31",
 *       "baseline_consumption_kwh": 751500.5,
 *       "baseline_cost_php": 9018006.00,
 *       "baseline_efficiency_score": 82.3
 *     },
 *     "audit_plan": {
 *       "total_checklist_items": 112,
 *       "estimated_man_hours": 120,
 *       "data_collection_points": 45,
 *       "equipment_assessments": 28,
 *       "stakeholder_interviews": 8
 *     },
 *     "notifications_sent": [
 *       "juan.delacruz@company.com",
 *       "ana.rodriguez@company.com",
 *       "maria.santos@company.com"
 *     ],
 *     "next_steps": [
 *       "Coordinate with building management for access",
 *       "Schedule equipment inspection appointments",
 *       "Prepare data collection instruments",
 *       "Brief audit team on methodology and safety requirements"
 *     ],
 *     "created_at": "2024-07-03T14:30:00Z",
 *     "created_by": 15,
 *     "audit_code": "AUD-2024-Q3-001"
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Auditor not available for specified period",
 *   "error": "AUDITOR_CONFLICT",
 *   "details": {
 *     "auditor_id": 15,
 *     "conflicting_audit": {
 *       "id": 22,
 *       "title": "Manufacturing Plant B Audit",
 *       "period": "2024-08-05 to 2024-08-20"
 *     },
 *     "available_periods": [
 *       "2024-07-15 to 2024-07-30",
 *       "2024-08-25 to 2024-09-10"
 *     ]
 *   }
 * }
 */
router.post(
  "/",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateBody(createAuditValidation),
  auditController.createAudit
);

/**
 * @route PUT /api/audits/:id
 * @desc Update audit progress with comprehensive findings documentation and compliance scoring
 * @details Updates audit information including progress milestone tracking, detailed findings
 *          documentation with supporting evidence, multi-standard compliance scoring, risk
 *          assessment updates, recommendation prioritization with cost-benefit analysis,
 *          implementation timeline adjustments, stakeholder communication updates, and
 *          quality assurance checkpoints while maintaining complete audit trail integrity.
 * @access Private (Admin, Energy Manager, Facility Engineer)
 */
router.put(
  "/:id",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateParams(idParamsValidation),
  validateBody(updateAuditValidation),
  auditController.updateAudit
);

/**
 * @route DELETE /api/audits/:id
 * @desc Remove audit with comprehensive data archival and regulatory compliance maintenance
 * @details Securely deletes audit while maintaining regulatory compliance through data archival,
 *          removes associated findings and recommendations, updates building compliance status,
 *          cleans up audit-related notifications, adjusts performance metrics calculations,
 *          maintains deletion audit trail for regulatory compliance, and ensures referential
 *          integrity across all dependent systems while preserving historical compliance data.
 * @access Private (Admin, Energy Manager)
 */
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  auditController.deleteAudit
);

export default router;
