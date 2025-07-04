import { Router } from "express";
import reportController from "@/controllers/reportController";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/middleware/validation";
import { UserRole } from "@/types/enums";
import { idParamsValidation } from "@/validations/commonValidations";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/reports
 * @desc Retrieve comprehensive report library with advanced filtering and metadata analysis
 * @details Provides access to complete report repository including multi-criteria filtering
 *          (type, status, building, date range, creator), report classification (energy,
 *          power quality, audit, compliance, monitoring), status tracking (generating,
 *          completed, failed, archived), building and audit associations, creator permissions,
 *          file metadata, generation parameters, search functionality, and access control
 *          management for comprehensive report library administration.
 * @access Private (All authenticated users)
 */
router.get("/", reportController.getReports);

/**
 * @route GET /api/reports/:id
 * @desc Retrieve detailed report information with comprehensive metadata and generation context
 * @details Provides complete report details including generation parameters, processing status,
 *          file information (size, format, location), generation timeline, data source scope,
 *          access log history, report validation status, associated building and audit context,
 *          creator information, sharing permissions, download statistics, and quality metrics
 *          for comprehensive report management and access control.
 * @access Private (All authenticated users)
 */
router.get(
  "/:id",
  validateParams(idParamsValidation),
  reportController.getReportById
);

/**
 * @route GET /api/reports/:id/download
 * @desc Download report file with comprehensive security validation and access logging
 * @details Provides secure report download with access permission validation, download activity
 *          logging, file integrity verification, bandwidth optimization, format conversion
 *          (PDF, Excel, CSV), watermarking for sensitive reports, access expiration checking,
 *          download statistics tracking, and security headers for safe file delivery with
 *          comprehensive audit trail maintenance.
 * @access Private (All authenticated users with report permissions)
 * @example_request
 * GET /api/reports/1247/download
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * HTTP 200 OK
 * Headers: {
 *   "Content-Type": "application/pdf",
 *   "Content-Disposition": "attachment; filename=\"Energy_Report_June_2024.pdf\"",
 *   "Content-Length": "2485760",
 *   "X-Report-ID": "1247",
 *   "X-Generated-Date": "2024-07-03T14:32:15Z",
 *   "X-Download-Count": "3",
 *   "Cache-Control": "private, no-cache",
 *   "X-Content-Security": "watermarked"
 * }
 * [Binary PDF content]
 *
 * Response Metadata (in application logs):
 * {
 *   "download_logged": true,
 *   "user_id": 15,
 *   "report_id": 1247,
 *   "file_size_bytes": 2485760,
 *   "download_time": "2024-07-03T14:35:22Z",
 *   "client_ip": "192.168.1.100",
 *   "user_agent": "Mozilla/5.0...",
 *   "access_granted": true,
 *   "watermark_applied": true
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Report file not found or has expired",
 *   "error": "REPORT_NOT_AVAILABLE",
 *   "details": {
 *     "report_id": 1247,
 *     "status": "expired",
 *     "expiry_date": "2024-07-01T00:00:00Z",
 *     "regeneration_available": true
 *   }
 * }
 */
router.get(
  "/:id/download",
  validateParams(idParamsValidation),
  reportController.downloadReport
);

/**
 * @route POST /api/reports/energy
 * @desc Generate comprehensive energy consumption report with advanced analytics and benchmarking
 * @details Creates detailed energy performance report including multi-building consumption analysis,
 *          time-series trend analysis with seasonal adjustments, peak demand profiling, cost
 *          analysis with Philippine utility rates, energy efficiency metrics and benchmarking,
 *          power factor analysis, carbon footprint calculations, energy conservation opportunity
 *          identification, regulatory compliance assessment, and strategic recommendations for
 *          energy management optimization with ROI analysis.
 * @access Private (Admin, Energy Manager, Facility Engineer)
 * @example_request
 * POST /api/reports/energy
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "Content-Type": "application/json" }
 * Body: {
 *   "building_id": 1,
 *   "start_date": "2024-06-01",
 *   "end_date": "2024-06-30",
 *   "title": "Monthly Energy Performance Report - June 2024",
 *   "include_comparison": true,
 *   "include_trends": true,
 *   "include_forecasting": true,
 *   "report_format": "pdf",
 *   "sections": [
 *     "executive_summary",
 *     "consumption_analysis",
 *     "cost_analysis",
 *     "efficiency_metrics",
 *     "recommendations"
 *   ],
 *   "comparison_period": {
 *     "start_date": "2024-05-01",
 *     "end_date": "2024-05-31"
 *   }
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Energy report generation initiated successfully",
 *   "data": {
 *     "report_id": 1247,
 *     "status": "generating",
 *     "estimated_completion": "2024-07-03T14:35:00Z",
 *     "job_id": "ENERGY_REPORT_2024_07_03_001",
 *     "report_details": {
 *       "title": "Monthly Energy Performance Report - June 2024",
 *       "building_id": 1,
 *       "building_name": "Green Energy Office Complex",
 *       "period": "2024-06-01 to 2024-06-30",
 *       "format": "pdf",
 *       "estimated_pages": 45,
 *       "sections_included": 5
 *     },
 *     "preview_data": {
 *       "total_consumption_kwh": 125750.5,
 *       "total_cost_php": 1509005.50,
 *       "efficiency_score": 82.5,
 *       "vs_previous_month": {
 *         "consumption_change": 8.2,
 *         "cost_change": 12.5,
 *         "efficiency_change": -2.1
 *       }
 *     },
 *     "download_url": "/api/reports/1247/download",
 *     "notification_emails": ["energymanager@company.com"],
 *     "created_at": "2024-07-03T14:30:00Z"
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Insufficient data for report generation",
 *   "error": "INSUFFICIENT_DATA",
 *   "details": {
 *     "required_data_points": 720,
 *     "available_data_points": 245,
 *     "missing_days": ["2024-06-10", "2024-06-11", "2024-06-12"]
 *   }
 * }
 */
router.post(
  "/energy",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  reportController.generateEnergyReport
);

/**
 * @route POST /api/reports/power-quality
 * @desc Generate detailed power quality analysis report with IEEE 519 compliance and equipment impact
 * @details Creates comprehensive power quality report including voltage quality assessment (RMS,
 *          THD, unbalance), current quality analysis, power factor trending, IEEE 519 compliance
 *          verification, ITIC curve analysis, power quality event analysis with impact assessment,
 *          equipment stress evaluation, maintenance recommendations, cost impact analysis, and
 *          improvement recommendations with ROI calculations for optimal power system performance.
 * @access Private (Admin, Energy Manager, Facility Engineer)
 */
router.post(
  "/power-quality",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  reportController.generatePowerQualityReport
);

/**
 * @route POST /api/reports/audit
 * @desc Generate comprehensive audit report with findings, recommendations, and implementation tracking
 * @details Creates detailed audit documentation including executive summary, methodology documentation,
 *          comprehensive findings with evidence, multi-standard compliance assessment (IEEE 519,
 *          PEC, OSHS, ISO 25010, RA 11285), risk analysis with impact matrices, prioritized
 *          recommendations with cost-benefit analysis, energy savings potential, implementation
 *          timeline, follow-up action plans, and responsibility assignments for complete audit
 *          documentation and strategic planning.
 * @access Private (Admin, Energy Manager, Facility Engineer)
 */
router.post(
  "/audit",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  reportController.generateAuditReport
);

/**
 * @route POST /api/reports/compliance
 * @desc Generate regulatory compliance report with gap analysis and corrective action planning
 * @details Creates comprehensive compliance documentation including multi-standard assessment
 *          (IEEE 519, PEC, OSHS, ISO 25010, RA 11285), gap analysis with severity ratings,
 *          compliance score calculations, regulatory requirement mapping, non-compliance risk
 *          assessment, corrective action plans with timelines, implementation tracking,
 *          verification procedures, regulatory submission preparation, and continuous improvement
 *          recommendations for strategic compliance management.
 * @access Private (Admin, Energy Manager, Facility Engineer)
 */
router.post(
  "/compliance",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  reportController.generateComplianceReport
);

/**
 * @route DELETE /api/reports/:id
 * @desc Remove report with secure deletion and comprehensive audit trail maintenance
 * @details Securely deletes report with complete lifecycle management including permission validation,
 *          secure file deletion with overwrite protection, access log archival, database cleanup,
 *          referential integrity maintenance, stakeholder notification, storage optimization,
 *          deletion audit trail creation, impact assessment, and backup verification for
 *          comprehensive report lifecycle management and regulatory compliance.
 * @access Private (Admin, Energy Manager)
 */
router.delete(
  "/:id",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(idParamsValidation),
  reportController.deleteReport
);

export default router;
