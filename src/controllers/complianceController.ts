import { Request, Response } from "express";
import {
  IComplianceCheck,
  IComplianceCheckCreate,
  IComplianceCheckUpdate,
} from "@/interfaces/IComplianceCheck";
import { ApiResponse } from "@/interfaces/IResponse";
import { PaginatedResponse, PaginationQuery } from "@/types/common";
import { database } from "@/config/database";
import complianceService from "@/services/enhancedcomplianceService";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";

interface PerformComplianceCheckBody {
  auditId: number;
  standardType: string;
  checkData: any;
}

interface ComplianceTrendsQuery {
  days?: string;
}

interface ComplianceQuery extends PaginationQuery {
  audit_id?: string;
  standard_type?: string;
  status?: string;
  severity?: string;
  search?: string;
}

class ComplianceController {
  public getComplianceChecksByAudit = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { auditId } = req.params;
      logger.info("🚀 Getting compliance checks for audit:", auditId);

      if (!auditId || isNaN(parseInt(auditId))) {
        throw new CustomError("Invalid audit ID", 400);
      }

      const id = parseInt(auditId);

      try {
        // Validate audit exists
        const audit = await database.queryOne(
          "SELECT id, title, building_id FROM audits WHERE id = ?",
          [id]
        );

        if (!audit) {
          throw new CustomError("Audit not found", 404);
        }

        // Get enhanced compliance checks
        const checks = await database.query<IComplianceCheck>(
          `SELECT 
            cc.*,
            CASE 
              WHEN cc.due_date < CURDATE() AND cc.status = 'non_compliant' THEN 'overdue'
              WHEN cc.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND cc.status = 'non_compliant' THEN 'due_soon'
              ELSE 'normal'
            END as urgency_status,
            DATEDIFF(cc.due_date, CURDATE()) as days_until_due
          FROM compliance_checks cc 
          WHERE cc.audit_id = ? 
          ORDER BY 
            FIELD(cc.severity, 'critical', 'high', 'medium', 'low'),
            cc.standard_type, 
            cc.section_code`,
          [id]
        );

        // Get compliance statistics for this audit
        const stats = await this.getComplianceStatistics(id);

        logger.info(
          `Retrieved ${checks.length} compliance checks for audit ${audit.title}`
        );

        const response: ApiResponse<{
          checks: IComplianceCheck[];
          statistics: any;
          audit_info: any;
        }> = {
          success: true,
          message: "Compliance checks fetched successfully",
          data: {
            checks,
            statistics: stats,
            audit_info: audit,
          },
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching compliance checks:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch compliance checks", 500);
      }
    }
  );

  public getAllComplianceChecks = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting all compliance checks");

      const {
        page = 1,
        limit = 20,
        audit_id,
        standard_type,
        status,
        severity,
        search,
      } = req.query as ComplianceQuery;

      // Parse and validate pagination
      const pageNum = Math.max(1, parseInt(page.toString()) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit.toString()) || 20)
      );
      const offset = (pageNum - 1) * limitNum;

      try {
        // Build WHERE conditions
        const conditions: string[] = [];
        const params: any[] = [];

        if (audit_id && !isNaN(parseInt(audit_id))) {
          conditions.push("cc.audit_id = ?");
          params.push(parseInt(audit_id));
        }

        if (
          standard_type &&
          typeof standard_type === "string" &&
          standard_type.trim()
        ) {
          conditions.push("cc.standard_type = ?");
          params.push(standard_type.trim());
        }

        if (status && typeof status === "string" && status.trim()) {
          conditions.push("cc.status = ?");
          params.push(status.trim());
        }

        if (severity && typeof severity === "string" && severity.trim()) {
          conditions.push("cc.severity = ?");
          params.push(severity.trim());
        }

        if (search && typeof search === "string" && search.trim()) {
          conditions.push(
            "(cc.check_description LIKE ? OR cc.section_code LIKE ? OR cc.details LIKE ?)"
          );
          const searchTerm = `%${search.trim()}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Get total count
        const countResult = await database.queryOne<{ total: number }>(
          `SELECT COUNT(*) as total FROM compliance_checks cc ${whereClause}`,
          params
        );
        const totalItems = countResult?.total || 0;

        // Get data with enhanced information
        const dataQuery = `
          SELECT 
            cc.*,
            a.title as audit_title,
            a.building_id,
            b.name as building_name,
            b.code as building_code,
            CASE 
              WHEN cc.due_date < CURDATE() AND cc.status = 'non_compliant' THEN 'overdue'
              WHEN cc.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND cc.status = 'non_compliant' THEN 'due_soon'
              ELSE 'normal'
            END as urgency_status,
            DATEDIFF(cc.due_date, CURDATE()) as days_until_due
          FROM compliance_checks cc
          LEFT JOIN audits a ON cc.audit_id = a.id
          LEFT JOIN buildings b ON a.building_id = b.id
          ${whereClause}
          ORDER BY 
            FIELD(cc.severity, 'critical', 'high', 'medium', 'low'),
            cc.created_at DESC
          LIMIT ? OFFSET ?
        `;

        const checks = await database.query<IComplianceCheck>(dataQuery, [
          ...params,
          limitNum,
          offset,
        ]);

        const totalPages = Math.ceil(totalItems / limitNum);

        const response: ApiResponse<PaginatedResponse<IComplianceCheck>> = {
          success: true,
          message: "Compliance checks fetched successfully",
          data: {
            data: checks,
            pagination: {
              currentPage: pageNum,
              totalPages,
              totalItems,
              itemsPerPage: limitNum,
              hasNext: pageNum < totalPages,
              hasPrev: pageNum > 1,
            },
          },
        };

        logger.info(`Successfully returned ${checks.length} compliance checks`);
        res.json(response);
      } catch (error) {
        logger.error("Error fetching all compliance checks:", error);
        throw new CustomError("Failed to fetch compliance checks", 500);
      }
    }
  );

  public getComplianceReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { auditId } = req.params;
      logger.info("🚀 Generating compliance report for audit:", auditId);

      if (!auditId || isNaN(parseInt(auditId))) {
        throw new CustomError("Invalid audit ID", 400);
      }

      const id = parseInt(auditId);

      try {
        // Validate audit exists
        const audit = await database.queryOne(
          "SELECT id, title, building_id FROM audits WHERE id = ?",
          [id]
        );

        if (!audit) {
          throw new CustomError("Audit not found", 404);
        }

        const report = await complianceService.getComplianceReport(id);

        logger.info(`Compliance report generated for audit ${audit.title}`);

        const response: ApiResponse<any> = {
          success: true,
          message: "Compliance report generated successfully",
          data: report,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error generating compliance report:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to generate compliance report", 500);
      }
    }
  );

  public getComplianceTrends = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      const { days = "90" } = req.query as ComplianceTrendsQuery;
      logger.info("🚀 Getting compliance trends for building:", buildingId);

      if (!buildingId || isNaN(parseInt(buildingId))) {
        throw new CustomError("Invalid building ID", 400);
      }

      const id = parseInt(buildingId);
      const daysBack = parseInt(days);

      if (isNaN(daysBack) || daysBack < 1 || daysBack > 365) {
        throw new CustomError("days must be between 1 and 365", 400);
      }

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name FROM buildings WHERE id = ?",
          [id]
        );

        if (!building) {
          throw new CustomError("Building not found", 404);
        }

        const trends = await complianceService.getComplianceTrends(
          buildingId,
          daysBack
        );

        logger.info(
          `Compliance trends retrieved for building ${building.name} (${daysBack} days)`
        );

        const response: ApiResponse<any[]> = {
          success: true,
          message: "Compliance trends fetched successfully",
          data: trends,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching compliance trends:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch compliance trends", 500);
      }
    }
  );

  public performComplianceCheck = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { auditId, standardType, checkData } =
        req.body as PerformComplianceCheckBody;
      logger.info("🚀 Performing compliance check for audit:", auditId);

      if (!auditId || !standardType || !checkData) {
        throw new CustomError(
          "auditId, standardType, and checkData are required",
          400
        );
      }

      if (isNaN(auditId)) {
        throw new CustomError("Invalid audit ID", 400);
      }

      try {
        // Validate audit exists
        const audit = await database.queryOne(
          "SELECT id, title, building_id, status FROM audits WHERE id = ?",
          [auditId]
        );

        if (!audit) {
          throw new CustomError("Audit not found", 404);
        }

        if (audit.status === "completed") {
          throw new CustomError(
            "Cannot perform checks on completed audit",
            400
          );
        }

        const results = await complianceService.performComplianceCheck(
          auditId,
          standardType as any,
          checkData
        );

        logger.info(
          `Compliance check performed for audit ${audit.title}, ${results.length} checks processed`
        );

        const response: ApiResponse<any[]> = {
          success: true,
          message: "Compliance check performed successfully",
          data: results,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error performing compliance check:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to perform compliance check", 500);
      }
    }
  );

  public createComplianceCheck = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const checkData = req.body as IComplianceCheckCreate;
      logger.info("🚀 Creating compliance check");

      // Validate required fields
      if (
        !checkData.audit_id ||
        !checkData.standard_type ||
        !checkData.section_code ||
        !checkData.check_description ||
        !checkData.status ||
        !checkData.severity
      ) {
        throw new CustomError(
          "audit_id, standard_type, section_code, check_description, status, and severity are required",
          400
        );
      }

      try {
        // Validate audit exists
        const audit = await database.queryOne(
          "SELECT id, title, status FROM audits WHERE id = ?",
          [checkData.audit_id]
        );

        if (!audit) {
          throw new CustomError("Audit not found", 404);
        }

        if (audit.status === "completed") {
          throw new CustomError("Cannot add checks to completed audit", 400);
        }

        // Check for duplicate section code within the same audit
        const existingCheck = await database.queryOne(
          "SELECT id FROM compliance_checks WHERE audit_id = ? AND standard_type = ? AND section_code = ?",
          [checkData.audit_id, checkData.standard_type, checkData.section_code]
        );

        if (existingCheck) {
          throw new CustomError(
            "Compliance check for this section already exists",
            409
          );
        }

        // Insert new compliance check
        const insertQuery = `
          INSERT INTO compliance_checks 
          (audit_id, standard_type, section_code, check_description, status, severity, 
           details, corrective_action, due_date, responsible_person) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          checkData.audit_id,
          checkData.standard_type,
          checkData.section_code,
          checkData.check_description,
          checkData.status,
          checkData.severity,
          checkData.details || null,
          checkData.corrective_action || null,
          checkData.due_date || null,
          checkData.responsible_person || null,
        ];

        const insertId = await database.insert(insertQuery, insertParams);
        logger.info("Compliance check created with ID:", insertId);

        // Get the created compliance check
        const newCheck = await database.queryOne<IComplianceCheck>(
          `SELECT 
            cc.*,
            a.title as audit_title,
            CASE 
              WHEN cc.due_date < CURDATE() AND cc.status = 'non_compliant' THEN 'overdue'
              WHEN cc.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND cc.status = 'non_compliant' THEN 'due_soon'
              ELSE 'normal'
            END as urgency_status
          FROM compliance_checks cc
          LEFT JOIN audits a ON cc.audit_id = a.id
          WHERE cc.id = ?`,
          [insertId]
        );

        if (!newCheck) {
          throw new CustomError(
            "Failed to retrieve created compliance check",
            500
          );
        }

        logger.info(
          `Compliance check created for audit ${audit.title}: ${checkData.section_code}`
        );

        const response: ApiResponse<IComplianceCheck> = {
          success: true,
          message: "Compliance check created successfully",
          data: newCheck,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error creating compliance check:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to create compliance check", 500);
      }
    }
  );

  public updateComplianceCheck = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updateData = req.body as IComplianceCheckUpdate;
      logger.info("🚀 Updating compliance check ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid compliance check ID", 400);
      }

      const checkId = parseInt(id);

      try {
        // Check if compliance check exists
        const existingCheck = await database.queryOne<IComplianceCheck>(
          "SELECT * FROM compliance_checks WHERE id = ?",
          [checkId]
        );

        if (!existingCheck) {
          throw new CustomError("Compliance check not found", 404);
        }

        // Check if associated audit is still editable
        const audit = await database.queryOne(
          "SELECT status FROM audits WHERE id = ?",
          [existingCheck.audit_id]
        );

        if (audit?.status === "completed") {
          throw new CustomError(
            "Cannot update checks for completed audit",
            400
          );
        }

        // Build update query dynamically
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        const allowedFields = [
          "standard_type",
          "section_code",
          "check_description",
          "status",
          "severity",
          "details",
          "corrective_action",
          "due_date",
          "responsible_person",
        ];

        Object.entries(updateData).forEach(([key, value]) => {
          if (allowedFields.includes(key) && value !== undefined) {
            updateFields.push(`${key} = ?`);
            updateValues.push(value);
          }
        });

        if (updateFields.length === 0) {
          throw new CustomError("No valid fields to update", 400);
        }

        // Check for duplicate section code if being updated
        if (
          updateData.section_code &&
          updateData.section_code !== existingCheck.section_code
        ) {
          const duplicateCheck = await database.queryOne(
            "SELECT id FROM compliance_checks WHERE audit_id = ? AND standard_type = ? AND section_code = ? AND id != ?",
            [
              existingCheck.audit_id,
              updateData.standard_type || existingCheck.standard_type,
              updateData.section_code,
              checkId,
            ]
          );

          if (duplicateCheck) {
            throw new CustomError(
              "Compliance check for this section already exists",
              409
            );
          }
        }

        // Add check ID to parameters
        updateValues.push(checkId);

        const updateQuery = `
          UPDATE compliance_checks 
          SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;

        const affectedRows = await database.execute(updateQuery, updateValues);
        logger.info("Update affected rows:", affectedRows);

        if (affectedRows === 0) {
          throw new CustomError("Failed to update compliance check", 500);
        }

        // Get updated compliance check
        const updatedCheck = await database.queryOne<IComplianceCheck>(
          `SELECT 
            cc.*,
            a.title as audit_title,
            CASE 
              WHEN cc.due_date < CURDATE() AND cc.status = 'non_compliant' THEN 'overdue'
              WHEN cc.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND cc.status = 'non_compliant' THEN 'due_soon'
              ELSE 'normal'
            END as urgency_status
          FROM compliance_checks cc
          LEFT JOIN audits a ON cc.audit_id = a.id
          WHERE cc.id = ?`,
          [checkId]
        );

        logger.info(`Compliance check ${id} updated successfully`);

        const response: ApiResponse<IComplianceCheck> = {
          success: true,
          message: "Compliance check updated successfully",
          data: updatedCheck!,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error updating compliance check:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to update compliance check", 500);
      }
    }
  );

  public deleteComplianceCheck = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Deleting compliance check ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid compliance check ID", 400);
      }

      const checkId = parseInt(id);

      try {
        // Check if compliance check exists
        const existingCheck = await database.queryOne<{
          id: number;
          audit_id: number;
          section_code: string;
        }>(
          "SELECT id, audit_id, section_code FROM compliance_checks WHERE id = ?",
          [checkId]
        );

        if (!existingCheck) {
          throw new CustomError("Compliance check not found", 404);
        }

        // Check if associated audit is still editable
        const audit = await database.queryOne(
          "SELECT status FROM audits WHERE id = ?",
          [existingCheck.audit_id]
        );

        if (audit?.status === "completed") {
          throw new CustomError(
            "Cannot delete checks from completed audit",
            400
          );
        }

        // Delete compliance check
        const affectedRows = await database.execute(
          "DELETE FROM compliance_checks WHERE id = ?",
          [checkId]
        );

        if (affectedRows === 0) {
          throw new CustomError("Failed to delete compliance check", 500);
        }

        logger.info(
          `Compliance check ${id} (${existingCheck.section_code}) deleted successfully`
        );

        const response: ApiResponse = {
          success: true,
          message: "Compliance check deleted successfully",
        };

        res.json(response);
      } catch (error) {
        logger.error("Error deleting compliance check:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to delete compliance check", 500);
      }
    }
  );

  // Private helper methods

  /**
   * Get compliance statistics for an audit
   */
  private async getComplianceStatistics(auditId: number): Promise<any> {
    try {
      const stats = await database.queryOne<any>(
        `SELECT 
          COUNT(*) as total_checks,
          SUM(CASE WHEN status = 'compliant' THEN 1 ELSE 0 END) as compliant_checks,
          SUM(CASE WHEN status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant_checks,
          SUM(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END) as needs_review_checks,
          SUM(CASE WHEN status = 'not_applicable' THEN 1 ELSE 0 END) as not_applicable_checks,
          SUM(CASE WHEN severity = 'critical' AND status = 'non_compliant' THEN 1 ELSE 0 END) as critical_issues,
          SUM(CASE WHEN severity = 'high' AND status = 'non_compliant' THEN 1 ELSE 0 END) as high_issues,
          SUM(CASE WHEN due_date < CURDATE() AND status = 'non_compliant' THEN 1 ELSE 0 END) as overdue_issues,
          ROUND((SUM(CASE WHEN status = 'compliant' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as compliance_percentage
        FROM compliance_checks 
        WHERE audit_id = ?`,
        [auditId]
      );

      // Get standard breakdown
      const standardBreakdown = await database.query<any>(
        `SELECT 
          standard_type,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'compliant' THEN 1 ELSE 0 END) as compliant,
          SUM(CASE WHEN status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant
        FROM compliance_checks 
        WHERE audit_id = ?
        GROUP BY standard_type`,
        [auditId]
      );

      return {
        ...stats,
        standard_breakdown: standardBreakdown,
      };
    } catch (error) {
      logger.error("Error getting compliance statistics:", error);
      return {
        total_checks: 0,
        compliant_checks: 0,
        non_compliant_checks: 0,
        compliance_percentage: 0,
        standard_breakdown: [],
      };
    }
  }
}

export default new ComplianceController();
