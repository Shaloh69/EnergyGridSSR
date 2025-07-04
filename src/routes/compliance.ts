import { Router } from "express";
import complianceController from "@/controllers/complianceController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import Joi from "joi";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Create parameter validation schemas
const auditIdParamsValidation = Joi.object({
  auditId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Audit ID must be a valid number",
    "any.required": "Audit ID is required",
  }),
});

const buildingIdParamsValidation = Joi.object({
  buildingId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
    "any.required": "Building ID is required",
  }),
});

const idParamsValidation = Joi.object({
  id: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "ID must be a valid number",
    "any.required": "ID is required",
  }),
});

/**
 * @route GET /api/compliance/audit/:auditId
 * @desc Retrieve comprehensive compliance checks with detailed assessment and scoring
 * @details Fetches all compliance checks associated with specific audit including detailed
 *          assessment results across multiple Philippine standards (IEEE 519, PEC, OSHS,
 *          ISO 25010, RA 11285), compliance scoring with weighted calculations, violation
 *          categorization with severity levels, requirement mapping with regulatory references,
 *          and gap identification with remediation priorities. Provides complete compliance
 *          assessment framework for audit documentation and regulatory reporting.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/compliance/audit/23
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Compliance checks retrieved successfully",
 *   "data": {
 *     "audit_id": 23,
 *     "audit_title": "Q2 2024 Energy Efficiency & Compliance Audit",
 *     "building_id": 1,
 *     "building_name": "Green Energy Office Complex",
 *     "overall_compliance": {
 *       "score": 86.7,
 *       "status": "compliant",
 *       "total_checks": 112,
 *       "passed_checks": 97,
 *       "failed_checks": 15,
 *       "critical_violations": 2,
 *       "improvement_rate": 12.5
 *     },
 *     "standards_summary": [
 *       {
 *         "standard": "IEEE519",
 *         "score": 89.2,
 *         "status": "compliant",
 *         "total_checks": 25,
 *         "passed": 23,
 *         "failed": 2,
 *         "critical_violations": 0,
 *         "category": "Power Quality"
 *       },
 *       {
 *         "standard": "PEC2017",
 *         "score": 92.5,
 *         "status": "compliant",
 *         "total_checks": 18,
 *         "passed": 18,
 *         "failed": 0,
 *         "critical_violations": 0,
 *         "category": "Electrical Safety"
 *       },
 *       {
 *         "standard": "OSHS",
 *         "score": 78.3,
 *         "status": "needs_improvement",
 *         "total_checks": 32,
 *         "passed": 27,
 *         "failed": 5,
 *         "critical_violations": 1,
 *         "category": "Occupational Safety"
 *       },
 *       {
 *         "standard": "RA11285",
 *         "score": 85.9,
 *         "status": "compliant",
 *         "total_checks": 22,
 *         "passed": 20,
 *         "failed": 2,
 *         "critical_violations": 0,
 *         "category": "Energy Efficiency"
 *       }
 *     ],
 *     "detailed_checks": [
 *       {
 *         "id": 1245,
 *         "standard": "IEEE519",
 *         "requirement_code": "IEEE519-5.1",
 *         "requirement_title": "Voltage Harmonic Distortion Limits",
 *         "description": "Total harmonic distortion of voltage shall not exceed 5% at point of common coupling",
 *         "status": "failed",
 *         "severity": "medium",
 *         "measured_value": 6.8,
 *         "required_value": 5.0,
 *         "unit": "percent",
 *         "location": "Main Distribution Panel",
 *         "finding": "Voltage THD exceeds IEEE 519 limits during peak load conditions",
 *         "impact": "Potential equipment stress and reduced efficiency",
 *         "recommendation": "Install harmonic filters on non-linear loads",
 *         "estimated_cost_php": 185000,
 *         "priority": "high",
 *         "target_completion": "2024-09-30",
 *         "responsible_party": "Electrical Contractor"
 *       },
 *       {
 *         "id": 1246,
 *         "standard": "OSHS",
 *         "requirement_code": "OSHS-8.2.1",
 *         "requirement_title": "Electrical Panel Access Clearance",
 *         "description": "Minimum 1-meter clearance required in front of electrical panels",
 *         "status": "failed",
 *         "severity": "critical",
 *         "measured_value": 0.6,
 *         "required_value": 1.0,
 *         "unit": "meters",
 *         "location": "Basement Electrical Room",
 *         "finding": "Storage equipment blocking access to main electrical panel",
 *         "impact": "Safety hazard for maintenance personnel",
 *         "recommendation": "Relocate storage equipment and install safety markings",
 *         "estimated_cost_php": 15000,
 *         "priority": "critical",
 *         "target_completion": "2024-08-15",
 *         "responsible_party": "Facility Management"
 *       }
 *     ],
 *     "risk_assessment": {
 *       "overall_risk_score": 23.5,
 *       "risk_categories": {
 *         "safety_risk": "medium",
 *         "compliance_risk": "low",
 *         "financial_risk": "medium",
 *         "operational_risk": "low"
 *       },
 *       "mitigation_priority": [
 *         "Critical safety violations",
 *         "Power quality compliance",
 *         "Energy efficiency improvements"
 *       ]
 *     },
 *     "implementation_plan": {
 *       "immediate_actions": 3,
 *       "short_term_actions": 8,
 *       "long_term_actions": 4,
 *       "total_estimated_cost_php": 485000,
 *       "estimated_completion": "2024-12-31"
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Audit not found or compliance checks not completed",
 *   "error": "AUDIT_NOT_FOUND",
 *   "details": {
 *     "audit_id": 999
 *   }
 * }
 */
router.get(
  "/audit/:auditId",
  validateParams(auditIdParamsValidation),
  complianceController.getComplianceChecksByAudit
);

/**
 * @route GET /api/compliance/report/:auditId
 * @desc Generate comprehensive compliance report with executive summary and detailed analysis
 * @details Produces detailed compliance report including executive summary with key findings,
 *          multi-standard compliance assessment, detailed violation analysis with severity
 *          categorization, gap analysis with prioritized remediation plans, cost-benefit
 *          analysis of compliance improvements, regulatory risk assessment, implementation
 *          timeline recommendations, and regulatory submission preparation. Provides
 *          complete compliance documentation for management and regulatory purposes.
 * @access Private (All authenticated users)
 */
router.get(
  "/report/:auditId",
  validateParams(auditIdParamsValidation),
  complianceController.getComplianceReport
);

/**
 * @route GET /api/compliance/trends/:buildingId
 * @desc Analyze compliance trends with predictive insights and performance tracking
 * @details Provides comprehensive compliance trend analysis including historical compliance
 *          score progression, standard-specific performance trends, violation frequency
 *          analysis, improvement rate tracking, seasonal compliance patterns, regulatory
 *          change impact assessment, predictive compliance risk modeling, and performance
 *          benchmarking against industry standards. Enables proactive compliance management
 *          and strategic planning for continuous improvement.
 * @access Private (All authenticated users)
 */
router.get(
  "/trends/:buildingId",
  validateParams(buildingIdParamsValidation),
  complianceController.getComplianceTrends
);

/**
 * @route POST /api/compliance/check
 * @desc Perform comprehensive compliance assessment with multi-standard evaluation
 * @details Executes detailed compliance check across multiple regulatory standards including
 *          IEEE 519 power quality compliance, PEC electrical safety requirements, OSHS
 *          occupational safety standards, ISO 25010 system quality standards, and RA 11285
 *          energy efficiency requirements. Performs automated compliance scoring, violation
 *          detection, gap analysis, and generates prioritized remediation recommendations
 *          with cost estimates and implementation timelines.
 * @access Private (Admin, Energy Manager, Facility Engineer)
 * @example_request
 * POST /api/compliance/check
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "Content-Type": "application/json" }
 * Body: {
 *   "audit_id": 24,
 *   "building_id": 1,
 *   "standards": ["IEEE519", "PEC2017", "OSHS", "RA11285"],
 *   "check_type": "comprehensive",
 *   "data_collection": {
 *     "power_quality_data": {
 *       "voltage_thd_l1": 6.8,
 *       "voltage_thd_l2": 5.2,
 *       "voltage_thd_l3": 7.1,
 *       "current_thd_l1": 4.5,
 *       "power_factor": 0.89,
 *       "voltage_unbalance": 2.1
 *     },
 *     "safety_inspection": {
 *       "electrical_panel_clearance_m": 0.6,
 *       "fire_extinguisher_count": 8,
 *       "emergency_exit_count": 4,
 *       "safety_signage_count": 15,
 *       "ppe_availability": true
 *     },
 *     "energy_data": {
 *       "annual_consumption_kwh": 1580000,
 *       "building_area_sqm": 8500,
 *       "energy_intensity_kwh_sqm": 185.9,
 *       "renewable_energy_percentage": 8.2,
 *       "energy_management_system": true
 *     }
 *   },
 *   "inspector_notes": {
 *     "general_observations": "Building systems well maintained, minor compliance issues identified",
 *     "critical_issues": ["Electrical panel access blocked", "Voltage THD exceeds limits"],
 *     "positive_findings": ["Good safety culture", "Energy monitoring systems in place"]
 *   }
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Compliance check completed successfully",
 *   "data": {
 *     "check_id": "COMP-2024-07-03-001",
 *     "audit_id": 24,
 *     "building_id": 1,
 *     "check_timestamp": "2024-07-03T14:30:00Z",
 *     "overall_results": {
 *       "compliance_score": 84.2,
 *       "status": "mostly_compliant",
 *       "total_requirements_checked": 97,
 *       "compliant_requirements": 82,
 *       "non_compliant_requirements": 15,
 *       "critical_violations": 2,
 *       "risk_score": 26.3
 *     },
 *     "standard_results": [
 *       {
 *         "standard": "IEEE519",
 *         "score": 78.5,
 *         "status": "needs_improvement",
 *         "violations": [
 *           {
 *             "requirement": "Voltage THD Limit",
 *             "code": "IEEE519-5.1",
 *             "severity": "medium",
 *             "finding": "L1 and L3 voltage THD exceed 5% limit",
 *             "measured_values": [6.8, 7.1],
 *             "limit": 5.0,
 *             "recommendation": "Install harmonic filters"
 *           }
 *         ]
 *       },
 *       {
 *         "standard": "OSHS",
 *         "score": 81.2,
 *         "status": "mostly_compliant",
 *         "violations": [
 *           {
 *             "requirement": "Electrical Panel Clearance",
 *             "code": "OSHS-8.2.1",
 *             "severity": "critical",
 *             "finding": "Insufficient clearance in front of main panel",
 *             "measured_value": 0.6,
 *             "required_value": 1.0,
 *             "recommendation": "Remove obstructions immediately"
 *           }
 *         ]
 *       },
 *       {
 *         "standard": "RA11285",
 *         "score": 88.7,
 *         "status": "compliant",
 *         "violations": []
 *       }
 *     ],
 *     "remediation_plan": {
 *       "immediate_actions": [
 *         {
 *           "action": "Clear electrical panel access",
 *           "deadline": "2024-07-10",
 *           "responsible": "Facility Management",
 *           "cost_php": 5000,
 *           "priority": "critical"
 *         }
 *       ],
 *       "short_term_actions": [
 *         {
 *           "action": "Install harmonic filters",
 *           "deadline": "2024-09-30",
 *           "responsible": "Electrical Contractor",
 *           "cost_php": 185000,
 *           "priority": "high"
 *         }
 *       ],
 *       "total_estimated_cost_php": 350000,
 *       "estimated_completion": "2024-12-31"
 *     },
 *     "next_assessment": {
 *       "recommended_date": "2025-01-15",
 *       "focus_areas": ["Power quality monitoring", "Safety compliance verification"],
 *       "type": "follow_up"
 *     },
 *     "generated_reports": [
 *       {
 *         "type": "compliance_summary",
 *         "format": "pdf",
 *         "url": "/api/reports/compliance/COMP-2024-07-03-001/summary"
 *       },
 *       {
 *         "type": "remediation_plan",
 *         "format": "excel",
 *         "url": "/api/reports/compliance/COMP-2024-07-03-001/plan"
 *       }
 *     ]
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Insufficient data for IEEE 519 compliance assessment",
 *   "error": "INSUFFICIENT_DATA",
 *   "details": {
 *     "missing_parameters": ["current_thd_l2", "current_thd_l3", "harmonic_spectrum"],
 *     "standard": "IEEE519",
 *     "required_for_assessment": "Complete three-phase power quality measurements"
 *   }
 * }
 */
router.post(
  "/check",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  complianceController.performComplianceCheck
);

/**
 * @route PUT /api/compliance/:id
 * @desc Update compliance check with progress tracking and remediation status
 * @details Updates compliance check information including remediation progress tracking,
 *          status updates with timestamp logging, corrective action documentation,
 *          compliance score recalculation, violation resolution verification, implementation
 *          milestone tracking, and stakeholder communication updates. Maintains complete
 *          audit trail for regulatory compliance and provides progress visibility for
 *          management oversight and continuous improvement initiatives.
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
  complianceController.updateComplianceCheck
);

export default router;
