import { Request, Response } from "express";
import {
  IAudit,
  IAuditDetailed,
  IAuditDetailedRaw,
  IAuditRaw,
  IAuditCreate,
  IAuditUpdate,
} from "@/interfaces/IAudit";
import { ApiResponse } from "@/interfaces/IResponse";
import {
  PaginatedResponse,
  PaginationQuery,
  FilterQuery,
  DateRangeQuery,
} from "@/types/common";
import { database } from "@/config/database";
import { socketManager } from "@/config/socket";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";

interface AuditQuery extends PaginationQuery, FilterQuery, DateRangeQuery {
  buildingId?: string;
  auditType?: string;
  status?: string;
  auditorId?: string;
}

class AuditController {
  /**
   * Helper method to convert raw audit dates to proper Date objects
   */
  private convertRawAudit(rawAudit: IAuditRaw): IAudit {
    return {
      ...rawAudit,
      scheduled_date: rawAudit.scheduled_date
        ? new Date(rawAudit.scheduled_date)
        : undefined,
      started_date: rawAudit.started_date
        ? new Date(rawAudit.started_date)
        : undefined,
      completed_date: rawAudit.completed_date
        ? new Date(rawAudit.completed_date)
        : undefined,
    };
  }

  /**
   * Helper method to convert raw detailed audit to proper types
   */
  private convertRawDetailedAudit(rawAudit: IAuditDetailedRaw): IAuditDetailed {
    return {
      ...rawAudit,
      scheduled_date: rawAudit.scheduled_date
        ? new Date(rawAudit.scheduled_date)
        : undefined,
      started_date: rawAudit.started_date
        ? new Date(rawAudit.started_date)
        : undefined,
      completed_date: rawAudit.completed_date
        ? new Date(rawAudit.completed_date)
        : undefined,
    };
  }

  /**
   * Helper method to format Date for database storage
   */
  private formatDateForDB(date: Date): string {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  public getAudits = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Starting getAudits request");

      const {
        page = 1,
        limit = 20,
        sortBy = "scheduled_date",
        sortOrder = "DESC",
        buildingId,
        auditType,
        status,
        auditorId,
        startDate,
        endDate,
        search,
      } = req.query as AuditQuery;

      // Parse and validate pagination
      const pageNum = Math.max(1, parseInt(page.toString()) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit.toString()) || 20)
      );
      const offset = (pageNum - 1) * limitNum;

      // Validate sortBy
      const allowedSortFields = [
        "scheduled_date",
        "created_at",
        "updated_at",
        "title",
        "audit_type",
        "status",
        "priority",
        "compliance_score",
        "completed_date",
      ];
      const safeSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "scheduled_date";
      const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

      try {
        // Build WHERE conditions with proper parameterization
        const conditions: string[] = [];
        const params: any[] = [];

        if (buildingId && !isNaN(parseInt(buildingId))) {
          conditions.push("a.building_id = ?");
          params.push(parseInt(buildingId));
        }

        if (auditType && typeof auditType === "string" && auditType.trim()) {
          conditions.push("a.audit_type = ?");
          params.push(auditType.trim());
        }

        if (status && typeof status === "string" && status.trim()) {
          conditions.push("a.status = ?");
          params.push(status.trim());
        }

        if (auditorId && !isNaN(parseInt(auditorId))) {
          conditions.push("a.auditor_id = ?");
          params.push(parseInt(auditorId));
        }

        if (startDate && typeof startDate === "string" && startDate.trim()) {
          conditions.push("a.scheduled_date >= ?");
          params.push(startDate.trim());
        }

        if (endDate && typeof endDate === "string" && endDate.trim()) {
          conditions.push("a.scheduled_date <= ?");
          params.push(endDate.trim());
        }

        if (search && typeof search === "string" && search.trim()) {
          conditions.push(
            "(a.title LIKE ? OR a.description LIKE ? OR b.name LIKE ?)"
          );
          const searchPattern = `%${search.trim()}%`;
          params.push(searchPattern, searchPattern, searchPattern);
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as total FROM audits a 
                           LEFT JOIN buildings b ON a.building_id = b.id 
                           ${whereClause}`;
        const countResult = await database.queryOne<{ total: number }>(
          countQuery,
          params
        );
        const totalItems = countResult?.total || 0;

        // Get audits data with enhanced information
        const dataQuery = `
          SELECT 
            a.*,
            b.name as building_name,
            b.code as building_code,
            b.area_sqm as building_area,
            b.building_type,
            u.first_name as auditor_first_name,
            u.last_name as auditor_last_name,
            CONCAT(u.first_name, ' ', u.last_name) as auditor_name,
            u.email as auditor_email,
            COUNT(cc.id) as compliance_checks_count,
            SUM(CASE WHEN cc.status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant_count,
            SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) as compliant_count,
            SUM(CASE WHEN cc.severity = 'critical' AND cc.status = 'non_compliant' THEN 1 ELSE 0 END) as critical_issues
          FROM audits a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN users u ON a.auditor_id = u.id
          LEFT JOIN compliance_checks cc ON a.id = cc.audit_id
          ${whereClause}
          GROUP BY a.id, b.name, b.code, b.area_sqm, b.building_type, u.first_name, u.last_name, u.email
          ORDER BY a.${safeSortBy} ${safeSortOrder}
          LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limitNum, offset];
        logger.info("Executing data query with params:", {
          query: dataQuery.substring(0, 100),
          paramsCount: dataParams.length,
        });

        const rawAudits = await database.query<IAuditDetailedRaw>(
          dataQuery,
          dataParams
        );
        const audits = rawAudits.map((rawAudit) =>
          this.convertRawDetailedAudit(rawAudit)
        );
        logger.info("Audits retrieved:", audits.length);

        // Enhance audits with additional statistics
        const enhancedAudits = await this.enhanceAuditsWithStats(audits);

        // Build response
        const totalPages = Math.ceil(totalItems / limitNum);

        const response: ApiResponse<PaginatedResponse<IAuditDetailed>> = {
          success: true,
          message: "Audits fetched successfully",
          data: {
            data: enhancedAudits,
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

        logger.info(`Successfully returned ${enhancedAudits.length} audits`);
        res.json(response);
      } catch (error) {
        logger.error("Error fetching audits:", error);
        throw new CustomError("Failed to fetch audits", 500);
      }
    }
  );

  public getAuditById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Getting audit by ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid audit ID", 400);
      }

      const auditId = parseInt(id);

      try {
        const rawAudit = await database.queryOne<IAuditDetailedRaw>(
          `SELECT 
            a.*,
            b.name as building_name,
            b.code as building_code,
            b.area_sqm as building_area,
            b.building_type,
            u.first_name as auditor_first_name,
            u.last_name as auditor_last_name,
            CONCAT(u.first_name, ' ', u.last_name) as auditor_name,
            u.email as auditor_email,
            COUNT(cc.id) as compliance_checks_count,
            SUM(CASE WHEN cc.status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant_count,
            SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) as compliant_count,
            SUM(CASE WHEN cc.severity = 'critical' AND cc.status = 'non_compliant' THEN 1 ELSE 0 END) as critical_issues
          FROM audits a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN users u ON a.auditor_id = u.id
          LEFT JOIN compliance_checks cc ON a.id = cc.audit_id
          WHERE a.id = ?
          GROUP BY a.id, b.name, b.code, b.area_sqm, b.building_type, u.first_name, u.last_name, u.email`,
          [auditId]
        );

        if (!rawAudit) {
          throw new CustomError("Audit not found", 404);
        }

        const audit = this.convertRawDetailedAudit(rawAudit);

        // Get compliance checks for this audit
        const complianceChecks = await database.query(
          `SELECT 
            cc.*,
            CASE 
              WHEN cc.due_date < CURDATE() AND cc.status = 'non_compliant' THEN 'overdue'
              WHEN cc.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND cc.status = 'non_compliant' THEN 'due_soon'
              ELSE 'normal'
            END as urgency_status
          FROM compliance_checks cc 
          WHERE cc.audit_id = ? 
          ORDER BY cc.standard_type, cc.section_code, cc.id`,
          [auditId]
        );

        // Get related equipment for this building
        const relatedEquipment = await database.query(
          `SELECT 
            e.id, e.name, e.equipment_type, e.status, e.location
          FROM equipment e 
          WHERE e.building_id = ? 
          ORDER BY e.equipment_type, e.name`,
          [audit.building_id]
        );

        const enhancedAudit = {
          ...audit,
          compliance_checks: complianceChecks,
          related_equipment: relatedEquipment,
          completion_percentage:
            audit.status === "completed"
              ? 100
              : audit.status === "in_progress"
                ? 50
                : 0,
        };

        const response: ApiResponse<IAuditDetailed> = {
          success: true,
          message: "Audit fetched successfully",
          data: enhancedAudit,
        };

        logger.info("Successfully retrieved audit:", audit.title);
        res.json(response);
      } catch (error) {
        logger.error("Error fetching audit by ID:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch audit", 500);
      }
    }
  );

  public createAudit = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const auditData = req.body as IAuditCreate;
      logger.info("🚀 Creating audit:", auditData.title);

      // Validate required fields
      if (
        !auditData.building_id ||
        !auditData.auditor_id ||
        !auditData.audit_type ||
        !auditData.title ||
        !auditData.scheduled_date
      ) {
        throw new CustomError(
          "building_id, auditor_id, audit_type, title, and scheduled_date are required",
          400
        );
      }

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name FROM buildings WHERE id = ? AND status = 'active'",
          [auditData.building_id]
        );

        if (!building) {
          throw new CustomError("Building not found or inactive", 404);
        }

        // Validate auditor exists and is active
        const auditor = await database.queryOne(
          "SELECT id, first_name, last_name, email FROM users WHERE id = ? AND is_active = true",
          [auditData.auditor_id]
        );

        if (!auditor) {
          throw new CustomError("Auditor not found or inactive", 404);
        }

        // Check for conflicting audits (same building, overlapping dates)
        const conflictingAudit = await database.queryOne(
          `SELECT id FROM audits 
           WHERE building_id = ? AND status IN ('scheduled', 'in_progress') 
           AND scheduled_date = ? AND id != ?`,
          [auditData.building_id, auditData.scheduled_date, 0]
        );

        if (conflictingAudit) {
          throw new CustomError(
            "Another audit is already scheduled for this building on the same date",
            409
          );
        }

        // Insert new audit using specialized insert method
        const insertQuery = `
          INSERT INTO audits 
          (building_id, auditor_id, audit_type, title, description, priority, scheduled_date) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          auditData.building_id,
          auditData.auditor_id,
          auditData.audit_type,
          auditData.title,
          auditData.description || null,
          auditData.priority || "medium",
          auditData.scheduled_date
            ? this.formatDateForDB(auditData.scheduled_date)
            : null,
        ];

        const insertId = await database.insert(insertQuery, insertParams);
        logger.info("Audit created with ID:", insertId);

        // Get the created audit with enhanced information
        const rawNewAudit = await database.queryOne<IAuditDetailedRaw>(
          `SELECT 
            a.*,
            b.name as building_name,
            b.code as building_code,
            u.first_name as auditor_first_name,
            u.last_name as auditor_last_name,
            CONCAT(u.first_name, ' ', u.last_name) as auditor_name,
            u.email as auditor_email
          FROM audits a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN users u ON a.auditor_id = u.id
          WHERE a.id = ?`,
          [insertId]
        );

        if (!rawNewAudit) {
          throw new CustomError("Failed to retrieve created audit", 500);
        }

        const newAudit = this.convertRawDetailedAudit(rawNewAudit);

        // Notify auditor via socket
        socketManager.emitToUser(
          auditData.auditor_id.toString(),
          "newAuditAssigned",
          newAudit
        );

        // Notify building managers
        socketManager.emitToBuilding(
          auditData.building_id.toString(),
          "newAuditScheduled",
          newAudit
        );

        logger.info(
          `New audit created: ${auditData.title} for building ${building.name}`
        );

        const response: ApiResponse<IAuditDetailed> = {
          success: true,
          message: "Audit created successfully",
          data: newAudit,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error creating audit:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to create audit", 500);
      }
    }
  );

  public updateAudit = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updateData = req.body as IAuditUpdate;
      logger.info("🚀 Updating audit ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid audit ID", 400);
      }

      const auditId = parseInt(id);

      try {
        // Check if audit exists
        const existingRawAudit = await database.queryOne<IAuditRaw>(
          "SELECT * FROM audits WHERE id = ?",
          [auditId]
        );

        if (!existingRawAudit) {
          throw new CustomError("Audit not found", 404);
        }

        // Handle status changes with automatic date updates
        if (updateData.status) {
          if (updateData.status === "in_progress" && !updateData.started_date) {
            updateData.started_date = new Date();
          } else if (
            updateData.status === "completed" &&
            !updateData.completed_date
          ) {
            updateData.completed_date = new Date();
          }
        }

        // Build update query dynamically
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        const allowedFields = [
          "auditor_id",
          "audit_type",
          "title",
          "description",
          "status",
          "priority",
          "scheduled_date",
          "started_date",
          "completed_date",
          "findings",
          "recommendations",
          "compliance_score",
        ];

        Object.entries(updateData).forEach(([key, value]) => {
          if (allowedFields.includes(key) && value !== undefined) {
            updateFields.push(`${key} = ?`);
            if (value instanceof Date) {
              updateValues.push(this.formatDateForDB(value));
            } else {
              updateValues.push(value);
            }
          }
        });

        if (updateFields.length === 0) {
          throw new CustomError("No valid fields to update", 400);
        }

        // Validate foreign key references if being updated
        if (updateData.auditor_id) {
          const auditor = await database.queryOne(
            "SELECT id FROM users WHERE id = ? AND is_active = true",
            [updateData.auditor_id]
          );
          if (!auditor) {
            throw new CustomError("Auditor not found or inactive", 404);
          }
        }

        // Add audit ID to parameters
        updateValues.push(auditId);

        const updateQuery = `
          UPDATE audits 
          SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;

        const affectedRows = await database.execute(updateQuery, updateValues);
        logger.info("Update affected rows:", affectedRows);

        if (affectedRows === 0) {
          throw new CustomError("Failed to update audit", 500);
        }

        // Get updated audit with enhanced information
        const rawUpdatedAudit = await database.queryOne<IAuditDetailedRaw>(
          `SELECT 
            a.*,
            b.name as building_name,
            b.code as building_code,
            b.area_sqm as building_area,
            b.building_type,
            u.first_name as auditor_first_name,
            u.last_name as auditor_last_name,
            CONCAT(u.first_name, ' ', u.last_name) as auditor_name,
            u.email as auditor_email,
            COUNT(cc.id) as compliance_checks_count,
            SUM(CASE WHEN cc.status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant_count,
            SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) as compliant_count,
            SUM(CASE WHEN cc.severity = 'critical' AND cc.status = 'non_compliant' THEN 1 ELSE 0 END) as critical_issues
          FROM audits a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN users u ON a.auditor_id = u.id
          LEFT JOIN compliance_checks cc ON a.id = cc.audit_id
          WHERE a.id = ?
          GROUP BY a.id, b.name, b.code, b.area_sqm, b.building_type, u.first_name, u.last_name, u.email`,
          [auditId]
        );

        const updatedAudit = this.convertRawDetailedAudit(rawUpdatedAudit!);

        // Notify about update
        if (updateData.status) {
          socketManager.emitToUser(
            updatedAudit.auditor_id.toString(),
            "auditStatusChanged",
            updatedAudit
          );
          socketManager.emitToBuilding(
            updatedAudit.building_id.toString(),
            "auditUpdated",
            updatedAudit
          );
        }

        logger.info(
          `Audit ${id} updated by user ${req.user?.id}: ${
            updateData.status
              ? `status changed to ${updateData.status}`
              : "fields updated"
          }`
        );

        const response: ApiResponse<IAuditDetailed> = {
          success: true,
          message: "Audit updated successfully",
          data: updatedAudit,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error updating audit:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to update audit", 500);
      }
    }
  );

  public deleteAudit = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Deleting audit ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid audit ID", 400);
      }

      const auditId = parseInt(id);

      try {
        // Check if audit exists
        const existingRawAudit = await database.queryOne<IAuditRaw>(
          "SELECT * FROM audits WHERE id = ?",
          [auditId]
        );

        if (!existingRawAudit) {
          throw new CustomError("Audit not found", 404);
        }

        const existingAudit = this.convertRawAudit(existingRawAudit);

        // Don't allow deletion of completed audits
        if (existingAudit.status === "completed") {
          throw new CustomError("Cannot delete completed audits", 400);
        }

        // Check for associated compliance checks
        const complianceCheckCount = await database.queryOne<{ count: number }>(
          "SELECT COUNT(*) as count FROM compliance_checks WHERE audit_id = ?",
          [auditId]
        );

        if ((complianceCheckCount?.count || 0) > 0) {
          throw new CustomError(
            "Cannot delete audit with associated compliance checks. Please delete compliance checks first or set audit status to cancelled.",
            400
          );
        }

        // Delete audit
        const affectedRows = await database.execute(
          "DELETE FROM audits WHERE id = ?",
          [auditId]
        );

        if (affectedRows === 0) {
          throw new CustomError("Failed to delete audit", 500);
        }

        // Notify about deletion
        socketManager.emitToBuilding(
          existingAudit.building_id.toString(),
          "auditDeleted",
          { auditId, title: existingAudit.title }
        );

        logger.info(
          `Audit ${id} (${existingAudit.title}) deleted successfully`
        );

        const response: ApiResponse = {
          success: true,
          message: "Audit deleted successfully",
        };

        res.json(response);
      } catch (error) {
        logger.error("Error deleting audit:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to delete audit", 500);
      }
    }
  );

  // Private helper methods

  /**
   * Enhance audits with additional statistics
   */
  private async enhanceAuditsWithStats(
    audits: IAuditDetailed[]
  ): Promise<IAuditDetailed[]> {
    if (audits.length === 0) return audits;

    try {
      return audits.map((audit) => ({
        ...audit,
        completion_percentage: this.calculateCompletionPercentage(audit),
        urgency_status: this.calculateUrgencyLevel(audit),
      }));
    } catch (error) {
      logger.error("Error enhancing audits with stats:", error);
      return audits;
    }
  }

  /**
   * Calculate completion percentage based on audit status and compliance checks
   */
  private calculateCompletionPercentage(audit: IAuditDetailed): number {
    const totalChecks = audit.compliance_checks_count || 0;
    const completedChecks = audit.compliant_count || 0;

    switch (audit.status) {
      case "completed":
        return 100;
      case "in_progress":
        return totalChecks > 0
          ? Math.round((completedChecks / totalChecks) * 100)
          : 25;
      case "scheduled":
        return 0;
      case "cancelled":
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Calculate urgency level based on various factors
   */
  private calculateUrgencyLevel(
    audit: IAuditDetailed
  ): "low" | "medium" | "high" | "critical" {
    const now = new Date();

    // Fixed: Check if scheduled_date exists before creating Date object
    if (!audit.scheduled_date) {
      return "low";
    }

    const scheduledDate = audit.scheduled_date;
    const daysDiff = Math.ceil(
      (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Overdue audits
    if (daysDiff < 0 && audit.status === "scheduled") {
      return "critical";
    }

    // Due soon or high priority
    if (daysDiff <= 3 || audit.priority === "critical") {
      return "high";
    }

    // Due within a week or high priority
    if (daysDiff <= 7 || audit.priority === "high") {
      return "medium";
    }

    return "low";
  }

  // Add this method to the AuditController class in auditController.ts

  /**
   * Get audit summary statistics - supports research objectives for energy efficiency tracking
   */
  public getAuditSummary = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting audit summary");

      const { startDate, endDate } = req.query as DateRangeQuery;

      try {
        // Build date conditions
        const dateConditions: string[] = [];
        const dateParams: any[] = [];

        if (startDate) {
          dateConditions.push("a.created_at >= ?");
          dateParams.push(startDate);
        }

        if (endDate) {
          dateConditions.push("a.created_at <= ?");
          dateParams.push(endDate);
        }

        const dateWhereClause =
          dateConditions.length > 0
            ? `WHERE ${dateConditions.join(" AND ")}`
            : "";

        // Get comprehensive audit statistics
        const [
          overallStats,
          statusStats,
          typeStats,
          complianceStats,
          buildingStats,
          recentAudits,
          trends,
        ] = await Promise.all([
          // Overall statistics
          database.queryOne<any>(
            `
          SELECT 
            COUNT(*) as total_audits,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_audits,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_audits,
            COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_audits,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_audits,
            AVG(CASE WHEN compliance_score IS NOT NULL THEN compliance_score END) as avg_compliance_score,
            AVG(CASE WHEN completed_date IS NOT NULL AND started_date IS NOT NULL 
                THEN TIMESTAMPDIFF(DAY, started_date, completed_date) END) as avg_completion_days
          FROM audits a ${dateWhereClause}
        `,
            dateParams
          ),

          // By status
          database.query<any>(
            `
          SELECT 
            status,
            COUNT(*) as count,
            AVG(CASE WHEN compliance_score IS NOT NULL THEN compliance_score END) as avg_score
          FROM audits a ${dateWhereClause}
          GROUP BY status
          ORDER BY count DESC
        `,
            dateParams
          ),

          // By type - aligns with research paper's audit categories
          database.query<any>(
            `
          SELECT 
            audit_type,
            COUNT(*) as count,
            AVG(CASE WHEN compliance_score IS NOT NULL THEN compliance_score END) as avg_score,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
          FROM audits a ${dateWhereClause}
          GROUP BY audit_type
          ORDER BY count DESC
        `,
            dateParams
          ),

          // Compliance statistics - critical for research objectives
          database.queryOne<any>(
            `
          SELECT 
            COUNT(DISTINCT a.id) as audits_with_compliance,
            AVG(a.compliance_score) as overall_avg_score,
            COUNT(CASE WHEN a.compliance_score >= 90 THEN 1 END) as excellent_audits,
            COUNT(CASE WHEN a.compliance_score >= 70 AND a.compliance_score < 90 THEN 1 END) as good_audits,
            COUNT(CASE WHEN a.compliance_score >= 50 AND a.compliance_score < 70 THEN 1 END) as fair_audits,
            COUNT(CASE WHEN a.compliance_score < 50 THEN 1 END) as poor_audits,
            COUNT(cc.id) as total_compliance_checks,
            COUNT(CASE WHEN cc.status = 'compliant' THEN 1 END) as compliant_checks,
            COUNT(CASE WHEN cc.status = 'non_compliant' THEN 1 END) as non_compliant_checks,
            COUNT(CASE WHEN cc.severity = 'critical' AND cc.status = 'non_compliant' THEN 1 END) as critical_violations
          FROM audits a
          LEFT JOIN compliance_checks cc ON a.id = cc.audit_id
          ${dateWhereClause.replace("WHERE", "WHERE a.compliance_score IS NOT NULL AND")}
        `,
            dateParams
          ),

          // By building - shows campus-wide performance
          database.query<any>(
            `
          SELECT 
            b.id as building_id,
            b.name as building_name,
            b.code as building_code,
            b.building_type,
            COUNT(a.id) as audit_count,
            AVG(CASE WHEN a.compliance_score IS NOT NULL THEN a.compliance_score END) as avg_compliance_score,
            COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_audits,
            MAX(a.completed_date) as last_audit_date
          FROM buildings b
          LEFT JOIN audits a ON b.id = a.building_id ${dateConditions.length > 0 ? "AND " + dateConditions.join(" AND ") : ""}
          GROUP BY b.id, b.name, b.code, b.building_type
          HAVING audit_count > 0
          ORDER BY avg_compliance_score DESC, audit_count DESC
          LIMIT 20
        `,
            dateParams
          ),

          // Recent audits
          database.query<any>(
            `
          SELECT 
            a.id,
            a.title,
            a.audit_type,
            a.status,
            a.compliance_score,
            a.completed_date,
            b.name as building_name,
            CONCAT(u.first_name, ' ', u.last_name) as auditor_name
          FROM audits a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN users u ON a.auditor_id = u.id
          ${dateWhereClause}
          ORDER BY a.created_at DESC
          LIMIT 10
        `,
            dateParams
          ),

          // Trends - supports research objective tracking
          this.getAuditTrends(dateParams, dateWhereClause),
        ]);

        // Calculate performance metrics based on research objectives
        const performanceMetrics = {
          energy_efficiency_score: await this.calculateEnergyEfficiencyScore(
            dateParams,
            dateWhereClause
          ),
          power_quality_score: await this.calculatePowerQualityScore(
            dateParams,
            dateWhereClause
          ),
          safety_compliance_rate: await this.calculateSafetyComplianceRate(
            dateParams,
            dateWhereClause
          ),
          improvement_rate: await this.calculateImprovementRate(
            dateParams,
            dateWhereClause
          ),
        };

        // Identify priority areas based on research findings
        const priorityAreas = await this.identifyPriorityAreas(
          dateParams,
          dateWhereClause
        );

        const summary = {
          overall_statistics: overallStats || {
            total_audits: 0,
            completed_audits: 0,
            in_progress_audits: 0,
            scheduled_audits: 0,
            cancelled_audits: 0,
            avg_compliance_score: 0,
            avg_completion_days: 0,
          },
          by_status: this.formatStatsByKey(statusStats || [], "status"),
          by_type: this.formatStatsByKey(typeStats || [], "audit_type"),
          compliance_overview: complianceStats || {
            audits_with_compliance: 0,
            overall_avg_score: 0,
            excellent_audits: 0,
            good_audits: 0,
            fair_audits: 0,
            poor_audits: 0,
            total_compliance_checks: 0,
            compliant_checks: 0,
            non_compliant_checks: 0,
            critical_violations: 0,
          },
          building_performance: buildingStats || [],
          recent_audits: recentAudits || [],
          trends: trends || {},
          performance_metrics: performanceMetrics,
          priority_areas: priorityAreas,
          period: {
            start_date: startDate || "All time",
            end_date: endDate || "Present",
            generated_at: new Date(),
          },
        };

        const response: ApiResponse<any> = {
          success: true,
          message: "Audit summary retrieved successfully",
          data: summary,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching audit summary:", error);
        throw new CustomError("Failed to fetch audit summary", 500);
      }
    }
  );

  // Private helper methods for audit summary

  /**
   * Get audit trends over time
   */
  private async getAuditTrends(
    dateParams: any[],
    dateWhereClause: string
  ): Promise<any> {
    try {
      // Monthly trends - Fixed GROUP BY to match all non-aggregated SELECT expressions
      const monthlyTrends = await database.query<any>(
        `
      SELECT 
        DATE_FORMAT(a.created_at, '%Y-%m') as month,
        COUNT(*) as total_audits,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_audits,
        AVG(CASE WHEN a.compliance_score IS NOT NULL THEN a.compliance_score END) as avg_compliance_score
      FROM audits a
      ${dateWhereClause}
      GROUP BY DATE_FORMAT(a.created_at, '%Y-%m')
      ORDER BY DATE_FORMAT(a.created_at, '%Y-%m') DESC
      LIMIT 12
    `,
        dateParams
      );

      // Weekly trends for recent period - Simplified to avoid GROUP BY issues
      const weeklyTrends = await database.query<any>(`
      SELECT 
        YEARWEEK(a.created_at, 1) as week,
        COUNT(*) as total_audits,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_audits,
        MIN(DATE(a.created_at - INTERVAL WEEKDAY(a.created_at) DAY)) as week_start
      FROM audits a
      WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
      GROUP BY YEARWEEK(a.created_at, 1)
      ORDER BY YEARWEEK(a.created_at, 1) DESC
    `);

      return {
        monthly: monthlyTrends.reverse(), // Show chronological order
        weekly: weeklyTrends.reverse(),
        completion_rate_trend: this.calculateCompletionRateTrend(monthlyTrends),
        compliance_trend: this.calculateComplianceTrend(monthlyTrends),
      };
    } catch (error) {
      logger.error("Error calculating audit trends:", error);
      return {
        monthly: [],
        weekly: [],
        completion_rate_trend: 0,
        compliance_trend: 0,
      };
    }
  }

  /**
   * Calculate energy efficiency score based on research objectives
   */
  private async calculateEnergyEfficiencyScore(
    dateParams: any[],
    dateWhereClause: string
  ): Promise<number> {
    try {
      const result = await database.queryOne<any>(
        `
      SELECT 
        AVG(CASE 
          WHEN cc.section_code REGEXP '(energy|efficiency|consumption|power)' 
          THEN CASE WHEN cc.status = 'compliant' THEN 100 ELSE 0 END 
        END) as energy_efficiency_score
      FROM audits a
      JOIN compliance_checks cc ON a.id = cc.audit_id
      ${dateWhereClause}
      AND cc.section_code REGEXP '(energy|efficiency|consumption|power)'
    `,
        dateParams
      );

      return Math.round(result?.energy_efficiency_score || 0);
    } catch (error) {
      logger.error("Error calculating energy efficiency score:", error);
      return 0;
    }
  }

  /**
   * Calculate power quality score - aligns with PEC 2017 requirements in research
   */
  private async calculatePowerQualityScore(
    dateParams: any[],
    dateWhereClause: string
  ): Promise<number> {
    try {
      const result = await database.queryOne<any>(
        `
      SELECT 
        AVG(CASE 
          WHEN cc.section_code REGEXP '(power|quality|voltage|harmonic|frequency)'
          THEN CASE WHEN cc.status = 'compliant' THEN 100 ELSE 0 END 
        END) as power_quality_score
      FROM audits a
      JOIN compliance_checks cc ON a.id = cc.audit_id
      ${dateWhereClause}
      AND cc.section_code REGEXP '(power|quality|voltage|harmonic|frequency)'
    `,
        dateParams
      );

      return Math.round(result?.power_quality_score || 0);
    } catch (error) {
      logger.error("Error calculating power quality score:", error);
      return 0;
    }
  }

  /**
   * Calculate safety compliance rate - aligns with OSHS requirements in research
   */
  private async calculateSafetyComplianceRate(
    dateParams: any[],
    dateWhereClause: string
  ): Promise<number> {
    try {
      const result = await database.queryOne<any>(
        `
      SELECT 
        AVG(CASE 
          WHEN (cc.section_code REGEXP '(safety|OSHS|hazard|protection)' OR cc.severity = 'critical')
          THEN CASE WHEN cc.status = 'compliant' THEN 100 ELSE 0 END 
        END) as safety_compliance_rate
      FROM audits a
      JOIN compliance_checks cc ON a.id = cc.audit_id
      ${dateWhereClause}
      AND (cc.section_code REGEXP '(safety|OSHS|hazard|protection)' OR cc.severity = 'critical')
    `,
        dateParams
      );

      return Math.round(result?.safety_compliance_rate || 0);
    } catch (error) {
      logger.error("Error calculating safety compliance rate:", error);
      return 0;
    }
  }

  /**
   * Calculate improvement rate over time
   */
  private async calculateImprovementRate(
    dateParams: any[],
    dateWhereClause: string
  ): Promise<number> {
    try {
      const recentScore = await database.queryOne<any>(`
      SELECT AVG(a.compliance_score) as avg_score
      FROM audits a
      WHERE a.completed_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
      AND a.compliance_score IS NOT NULL
    `);

      const previousScore = await database.queryOne<any>(`
      SELECT AVG(a.compliance_score) as avg_score
      FROM audits a
      WHERE a.completed_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      AND a.completed_date < DATE_SUB(NOW(), INTERVAL 3 MONTH)
      AND a.compliance_score IS NOT NULL
    `);

      if (recentScore?.avg_score && previousScore?.avg_score) {
        return Math.round(
          ((recentScore.avg_score - previousScore.avg_score) /
            previousScore.avg_score) *
            100
        );
      }

      return 0;
    } catch (error) {
      logger.error("Error calculating improvement rate:", error);
      return 0;
    }
  }

  /**
   * Fixed method - Identify priority areas based on compliance gaps - supports research recommendations
   */
  private async identifyPriorityAreas(
    dateParams: any[],
    dateWhereClause: string
  ): Promise<any[]> {
    try {
      const priorityAreas = await database.query<any>(
        `
      SELECT 
        cc.standard_type,
        COUNT(*) as total_checks,
        COUNT(CASE WHEN cc.status = 'non_compliant' THEN 1 END) as violations,
        COUNT(CASE WHEN cc.severity = 'critical' AND cc.status = 'non_compliant' THEN 1 END) as critical_violations,
        ROUND((COUNT(CASE WHEN cc.status = 'non_compliant' THEN 1 END) / COUNT(*)) * 100, 2) as violation_rate
      FROM audits a
      JOIN compliance_checks cc ON a.id = cc.audit_id
      ${dateWhereClause}
      GROUP BY cc.standard_type
      HAVING violation_rate > 10
      ORDER BY critical_violations DESC, violation_rate DESC
      LIMIT 5
    `,
        dateParams
      );

      return priorityAreas.map((area) => ({
        ...area,
        priority_level:
          area.critical_violations > 0
            ? "critical"
            : area.violation_rate > 30
              ? "high"
              : "medium",
        recommended_action: this.generateRecommendedAction(
          area.standard_type,
          area.violation_rate
        ),
      }));
    } catch (error) {
      logger.error("Error identifying priority areas:", error);
      return [];
    }
  }

  /**
   * Generate recommended actions based on research findings
   */
  private generateRecommendedAction(
    standardType: string,
    violationRate: number
  ): string {
    const actions: Record<string, string> = {
      PEC2017:
        violationRate > 30
          ? "Immediate electrical system upgrade and compliance review required"
          : "Schedule enhanced electrical safety inspection",
      OSHS:
        violationRate > 30
          ? "Critical safety protocol review and staff training required"
          : "Update safety procedures and conduct training refresher",
      ISO25010:
        violationRate > 30
          ? "System architecture review and quality assurance overhaul needed"
          : "Implement additional quality controls and testing procedures",
      RA11285:
        violationRate > 30
          ? "Energy efficiency program implementation required"
          : "Enhance energy monitoring and conservation measures",
    };

    return (
      actions[standardType] ||
      "Review compliance procedures and implement corrective measures"
    );
  }

  /**
   * Calculate completion rate trend
   */
  private calculateCompletionRateTrend(monthlyData: any[]): number {
    if (monthlyData.length < 2) return 0;

    const recent = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];

    if (!recent?.total_audits || !previous?.total_audits) return 0;

    const recentRate = (recent.completed_audits / recent.total_audits) * 100;
    const previousRate =
      (previous.completed_audits / previous.total_audits) * 100;

    return Math.round(recentRate - previousRate);
  }

  /**
   * Calculate compliance score trend
   */
  private calculateComplianceTrend(monthlyData: any[]): number {
    if (monthlyData.length < 2) return 0;

    const recent = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];

    if (!recent?.avg_compliance_score || !previous?.avg_compliance_score)
      return 0;

    return Math.round(
      recent.avg_compliance_score - previous.avg_compliance_score
    );
  }

  /**
   * Format statistics by key - reused from alertController pattern
   */
  private formatStatsByKey(stats: any[], key: string): Record<string, any> {
    const result: Record<string, any> = {};
    stats.forEach((stat) => {
      result[stat[key]] = {
        count: stat.count,
        avg_score: Math.round(stat.avg_score || 0),
      };
    });
    return result;
  }
}

export default new AuditController();
