// reportController.ts - Updated with Enhanced Audit Report Generation
import { Request, Response } from "express";
import {
  IReport,
  IReportDetailed,
  IReportRaw,
  IReportCreate,
  ReportParams,
} from "@/interfaces/IReport";
import { ApiResponse } from "@/interfaces/IResponse";
import { PaginatedResponse, PaginationQuery } from "@/types/common";
import { database } from "@/config/database";
import reportService from "@/services/reportService";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";
import path from "path";
import fs from "fs";

interface EnergyReportBody {
  buildingId?: number;
  startDate: string;
  endDate: string;
  title: string;
  includeComparison?: boolean;
  includeTrends?: boolean;
}

interface PowerQualityReportBody {
  buildingId: number;
  startDate: string;
  endDate: string;
  title: string;
  includeEvents?: boolean;
  includeCompliance?: boolean;
}

// UPDATED: Enhanced interface for comprehensive energy audit reports
interface AuditReportBody {
  auditId: number;
  title: string;
  includeCompliance?: boolean;
  includeRecommendations?: boolean;
  includeImplementationPlan?: boolean; // New optional field
}

interface ComplianceReportBody {
  auditId: number;
  title: string;
  standards?: string[];
  includeGapAnalysis?: boolean;
}

interface MonitoringReportBody {
  buildingId?: number;
  startDate: string;
  endDate: string;
  title: string;
  reportTypes: string[];
}

interface ReportQuery extends PaginationQuery {
  report_type?: string;
  building_id?: string;
  audit_id?: string;
  status?: string;
  generated_by?: string;
  search?: string;
}

class ReportController {
  /**
   * Helper method to safely parse string to number
   */
  private parseToNumber(
    value: string | number | undefined
  ): number | undefined {
    if (value === undefined || value === null) return undefined;

    // If it's already a number, return it
    if (typeof value === "number") {
      return isNaN(value) ? undefined : value;
    }

    // If it's a string, parse it
    if (typeof value === "string") {
      const trimmed = value.trim();
      const parsed = parseInt(trimmed);
      return isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
  }

  /**
   * Helper method to safely trim string
   */
  private safelyTrimString(value: string | undefined): string | undefined {
    if (!value || typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /**
   * Helper method to convert raw report to typed report
   */
  private convertRawReport(rawReport: IReportRaw): IReport {
    return {
      ...rawReport,
      parameters: rawReport.parameters
        ? JSON.parse(rawReport.parameters)
        : undefined,
      data: rawReport.data ? JSON.parse(rawReport.data) : undefined,
    };
  }

  public getReports = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const query = req.query as ReportQuery;
      logger.info("🚀 Getting reports with query:", query);

      const {
        page = "1",
        limit = "10",
        report_type,
        building_id,
        audit_id,
        status,
        generated_by,
        search,
      } = query;

      // Fixed: Use parseToNumber helper method with proper fallback
      const pageNum = this.parseToNumber(page) || 1;
      const limitNum = Math.min(this.parseToNumber(limit) || 10, 100);
      const offset = (pageNum - 1) * limitNum;

      try {
        // Build query conditions
        const conditions: string[] = ["1=1"];
        const params: any[] = [];

        if (report_type) {
          conditions.push("r.report_type = ?");
          params.push(report_type);
        }

        if (building_id) {
          const buildingIdNum = this.parseToNumber(building_id);
          if (buildingIdNum !== undefined) {
            conditions.push("r.building_id = ?");
            params.push(buildingIdNum);
          }
        }

        if (audit_id) {
          const auditIdNum = this.parseToNumber(audit_id);
          if (auditIdNum !== undefined) {
            conditions.push("r.audit_id = ?");
            params.push(auditIdNum);
          }
        }

        if (status) {
          conditions.push("r.status = ?");
          params.push(status);
        }

        if (generated_by) {
          const generatedByNum = this.parseToNumber(generated_by);
          if (generatedByNum !== undefined) {
            conditions.push("r.generated_by = ?");
            params.push(generatedByNum);
          }
        }

        if (search) {
          const searchTerm = this.safelyTrimString(search);
          if (searchTerm) {
            conditions.push(
              "(r.title LIKE ? OR b.name LIKE ? OR a.title LIKE ?)"
            );
            const searchPattern = `%${searchTerm}%`;
            params.push(searchPattern, searchPattern, searchPattern);
          }
        }

        const whereClause = conditions.join(" AND ");

        // Get total count
        const countQuery = `
          SELECT COUNT(*) as total
          FROM reports r
          LEFT JOIN buildings b ON r.building_id = b.id
          LEFT JOIN audits a ON r.audit_id = a.id
          WHERE ${whereClause}
        `;

        logger.info("Executing count query with params:", {
          query: countQuery.substring(0, 100),
          paramsCount: params.length,
        });

        const countResult = await database.queryOne<{ total: number }>(
          countQuery,
          params
        );
        const totalItems = countResult?.total || 0;

        logger.info("Total items found:", totalItems);

        // Get paginated data
        const dataQuery = `
          SELECT 
            r.*,
            b.name as building_name,
            b.code as building_code,
            a.title as audit_title,
            a.status as audit_status,
            a.audit_type,
            u.first_name,
            u.last_name,
            CONCAT(u.first_name, ' ', u.last_name) as generated_by_name,
            u.email as generated_by_email,
            CASE 
              WHEN r.file_path IS NOT NULL AND r.file_path != '' THEN true
              ELSE false
            END as file_available,
            CASE 
              WHEN r.file_size IS NOT NULL THEN ROUND(r.file_size / 1024 / 1024, 2)
              ELSE NULL
            END as file_size_mb,
            TIMESTAMPDIFF(MINUTE, r.created_at, NOW()) as age_minutes
          FROM reports r
          LEFT JOIN buildings b ON r.building_id = b.id
          LEFT JOIN audits a ON r.audit_id = a.id
          LEFT JOIN users u ON r.generated_by = u.id
          WHERE ${whereClause}
          ORDER BY r.created_at DESC
          LIMIT ?
          OFFSET ?
        `;

        const dataParams = [...params, limitNum, offset];
        logger.info("Executing data query with params:", {
          query: dataQuery.substring(0, 100),
          paramsCount: dataParams.length,
        });

        const rawReports = await database.query<IReportRaw>(
          dataQuery,
          dataParams
        );
        const reports = rawReports.map((rawReport) => ({
          ...this.convertRawReport(rawReport),
          file_available: (rawReport as any).file_available,
          file_size_mb: (rawReport as any).file_size_mb,
          age_minutes: (rawReport as any).age_minutes,
          building_name: (rawReport as any).building_name,
          building_code: (rawReport as any).building_code,
          audit_title: (rawReport as any).audit_title,
          audit_status: (rawReport as any).audit_status,
          audit_type: (rawReport as any).audit_type,
          generated_by_name: (rawReport as any).generated_by_name,
          generated_by_email: (rawReport as any).generated_by_email,
        })) as IReportDetailed[];

        logger.info("Reports retrieved:", reports.length);

        // Enhance reports with additional statistics
        const enhancedReports = await this.enhanceReportsWithStats(reports);

        // Build response
        const totalPages = Math.ceil(totalItems / limitNum);

        const response: ApiResponse<PaginatedResponse<IReportDetailed>> = {
          success: true,
          message: "Reports fetched successfully",
          data: {
            data: enhancedReports,
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

        logger.info(`Successfully returned ${enhancedReports.length} reports`);
        res.json(response);
      } catch (error) {
        logger.error("Error fetching reports:", error);
        throw new CustomError("Failed to fetch reports", 500);
      }
    }
  );

  public getReportById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Getting report by ID:", id);

      // Fixed: Use parseToNumber helper method
      const reportId = this.parseToNumber(id);
      if (reportId === undefined) {
        throw new CustomError("Invalid report ID", 400);
      }

      try {
        const rawReport = await database.queryOne<IReportRaw>(
          `SELECT 
            r.*,
            b.name as building_name,
            b.code as building_code,
            a.title as audit_title,
            a.status as audit_status,
            a.audit_type,
            u.first_name,
            u.last_name,
            CONCAT(u.first_name, ' ', u.last_name) as generated_by_name,
            u.email as generated_by_email,
            CASE 
              WHEN r.file_path IS NOT NULL AND r.file_path != '' THEN true
              ELSE false
            END as file_available,
            CASE 
              WHEN r.file_size IS NOT NULL THEN ROUND(r.file_size / 1024 / 1024, 2)
              ELSE NULL
            END as file_size_mb
          FROM reports r
          LEFT JOIN buildings b ON r.building_id = b.id
          LEFT JOIN audits a ON r.audit_id = a.id
          LEFT JOIN users u ON r.generated_by = u.id
          WHERE r.id = ?`,
          [reportId]
        );

        if (!rawReport) {
          throw new CustomError("Report not found", 404);
        }

        const report = {
          ...this.convertRawReport(rawReport),
          file_available: (rawReport as any).file_available,
          file_size_mb: (rawReport as any).file_size_mb,
          building_name: (rawReport as any).building_name,
          building_code: (rawReport as any).building_code,
          audit_title: (rawReport as any).audit_title,
          audit_status: (rawReport as any).audit_status,
          audit_type: (rawReport as any).audit_type,
          generated_by_name: (rawReport as any).generated_by_name,
          generated_by_email: (rawReport as any).generated_by_email,
        } as IReportDetailed;

        // Get report metadata and summary
        const reportSummary = await this.getReportSummaryData(report);

        const enhancedReport = {
          ...report,
          summary: reportSummary,
          download_available:
            report.file_available && fs.existsSync(report.file_path || ""),
        };

        const response: ApiResponse<IReportDetailed> = {
          success: true,
          message: "Report fetched successfully",
          data: enhancedReport,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching report by ID:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch report", 500);
      }
    }
  );

  public downloadReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Downloading report:", id);

      // Fixed: Use parseToNumber helper method
      const reportId = this.parseToNumber(id);
      if (reportId === undefined) {
        throw new CustomError("Invalid report ID", 400);
      }

      try {
        const rawReport = await database.queryOne<IReportRaw>(
          "SELECT * FROM reports WHERE id = ?",
          [reportId]
        );

        if (!rawReport) {
          throw new CustomError("Report not found", 404);
        }

        const report = this.convertRawReport(rawReport);

        if (!report.file_path || !fs.existsSync(report.file_path)) {
          throw new CustomError("Report file not found", 404);
        }

        // Set appropriate headers based on file type
        const fileExtension = path.extname(report.file_path).toLowerCase();
        let contentType = "application/octet-stream";

        if (fileExtension === ".pdf") {
          contentType = "application/pdf";
        } else if (fileExtension === ".xlsx") {
          contentType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        }

        res.setHeader("Content-Type", contentType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${report.file_name || `report-${reportId}${fileExtension}`}"`
        );

        const fileStream = fs.createReadStream(report.file_path);
        fileStream.pipe(res);

        logger.info(`Report ${id} downloaded successfully`);
      } catch (error) {
        logger.error("Error downloading report:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to download report", 500);
      }
    }
  );

  public getReportStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting report statistics");

      try {
        const [overallStats, reportTypeStats, buildingStats, recentActivity] =
          await Promise.all([
            // Overall statistics
            database.queryOne<any>(
              `SELECT 
              COUNT(*) as total_reports,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_reports,
              COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_reports,
              COUNT(CASE WHEN status = 'generating' THEN 1 END) as generating_reports,
              COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as reports_last_30_days,
              AVG(file_size) as avg_file_size
            FROM reports`
            ),

            // Reports by type
            database.query<any>(
              `SELECT 
              report_type,
              COUNT(*) as count,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
            FROM reports 
            GROUP BY report_type
            ORDER BY count DESC`
            ),

            // Reports by building
            database.query<any>(
              `SELECT 
              b.name as building_name,
              COUNT(r.id) as report_count
            FROM reports r
            LEFT JOIN buildings b ON r.building_id = b.id
            WHERE r.building_id IS NOT NULL
            GROUP BY r.building_id, b.name
            ORDER BY report_count DESC
            LIMIT 10`
            ),

            // Recent activity
            database.query<any>(
              `SELECT 
              DATE(created_at) as date,
              COUNT(*) as reports_generated
            FROM reports 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC`
            ),
          ]);

        const summary = {
          overview: {
            total_reports: overallStats?.total_reports || 0,
            completed_reports: overallStats?.completed_reports || 0,
            failed_reports: overallStats?.failed_reports || 0,
            generating_reports: overallStats?.generating_reports || 0,
            average_file_size_mb: overallStats?.avg_file_size
              ? Math.round((overallStats.avg_file_size / 1024 / 1024) * 100) /
                100
              : 0,
          },
          by_type: reportTypeStats || [],
          by_building: buildingStats || [],
          recent_activity: recentActivity || [],
          performance: {
            success_rate:
              overallStats?.total_reports > 0
                ? Math.round(
                    (overallStats.completed_reports /
                      overallStats.total_reports) *
                      100
                  )
                : 0,
            generation_activity: overallStats?.reports_last_30_days || 0,
            failure_rate:
              overallStats?.total_reports > 0
                ? (overallStats.failed_reports / overallStats.total_reports) *
                  100
                : 0,
          },
        };

        logger.info("Successfully retrieved report statistics");

        const response: ApiResponse<typeof summary> = {
          success: true,
          message: "Report statistics fetched successfully",
          data: summary,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error getting report statistics:", error);
        throw new CustomError("Failed to get report statistics", 500);
      }
    }
  );

  public generateEnergyReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const {
        buildingId,
        startDate,
        endDate,
        title,
        includeComparison,
        includeTrends,
      } = req.body as EnergyReportBody;
      logger.info("🚀 Generating energy report:", title);

      // Validate required fields
      if (!startDate || !endDate || !title) {
        throw new CustomError(
          "startDate, endDate, and title are required",
          400
        );
      }

      try {
        const reportParams: ReportParams = {
          buildingId,
          startDate,
          endDate,
          title,
          generatedBy: req.user!.id,
        };

        const report =
          await reportService.generateEnergyConsumptionReport(reportParams);

        logger.info(`Energy report generated successfully: ${title}`);

        const response: ApiResponse<IReport> = {
          success: true,
          message: "Energy report generated successfully",
          data: report,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error generating energy report:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to generate energy report", 500);
      }
    }
  );

  public generatePowerQualityReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const {
        buildingId,
        startDate,
        endDate,
        title,
        includeEvents,
        includeCompliance,
      } = req.body as PowerQualityReportBody;
      logger.info("🚀 Generating power quality report:", title);

      // Validate required fields
      if (!buildingId || !startDate || !endDate || !title) {
        throw new CustomError(
          "buildingId, startDate, endDate, and title are required",
          400
        );
      }

      try {
        const reportParams: ReportParams = {
          buildingId,
          startDate,
          endDate,
          title,
          generatedBy: req.user!.id,
        };

        const report =
          await reportService.generatePowerQualityReport(reportParams);

        logger.info(`Power quality report generated successfully: ${title}`);

        const response: ApiResponse<IReport> = {
          success: true,
          message: "Power quality report generated successfully",
          data: report,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error generating power quality report:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to generate power quality report", 500);
      }
    }
  );

  /**
   * UPDATED: Enhanced Comprehensive Energy Audit Report Generation
   * Now generates professional energy audit reports following industry standards
   */
  public generateAuditReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const {
        auditId,
        title,
        includeCompliance,
        includeRecommendations,
        includeImplementationPlan,
      } = req.body as AuditReportBody;
      logger.info("🚀 Generating comprehensive energy audit report:", title);

      // Validate required fields
      if (!auditId || !title) {
        throw new CustomError("auditId and title are required", 400);
      }

      try {
        // Validate audit exists and get basic info
        const audit = await database.queryOne(
          `SELECT a.id, a.title, a.building_id, a.status, b.name as building_name 
           FROM audits a 
           JOIN buildings b ON a.building_id = b.id 
           WHERE a.id = ?`,
          [auditId]
        );

        if (!audit) {
          throw new CustomError("Audit not found", 404);
        }

        logger.info(
          `Generating comprehensive energy audit report for: ${audit.title} (${audit.building_name})`
        );

        // Create comprehensive report parameters
        const reportParams: ReportParams = {
          auditId,
          title,
          includeCompliance: includeCompliance !== false, // Default to true
          includeRecommendations: includeRecommendations !== false, // Default to true
          generatedBy: req.user!.id,
        };

        // Generate comprehensive energy audit report using the enhanced service
        const report =
          await reportService.generateAuditSummaryReport(reportParams);

        logger.info(
          `Comprehensive energy audit report generated successfully: ${title} for audit ${audit.title}`
        );
        logger.info(`Report file generated: ${report.file_name}`);
        logger.info(
          `Report size: ${report.file_size ? Math.round(report.file_size / 1024) + " KB" : "Unknown"}`
        );

        const response: ApiResponse<IReport> = {
          success: true,
          message: "Comprehensive energy audit report generated successfully",
          data: report,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error(
          "Error generating comprehensive energy audit report:",
          error
        );
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError(
          "Failed to generate comprehensive energy audit report",
          500
        );
      }
    }
  );

  public generateComplianceReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { auditId, title, standards, includeGapAnalysis } =
        req.body as ComplianceReportBody;
      logger.info("🚀 Generating compliance report:", title);

      // Validate required fields
      if (!auditId || !title) {
        throw new CustomError("auditId and title are required", 400);
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

        const reportParams: ReportParams = {
          auditId,
          title,
          generatedBy: req.user!.id,
        };

        const report =
          await reportService.generateComplianceReport(reportParams);

        logger.info(
          `Compliance report generated successfully: ${title} for audit ${audit.title}`
        );

        const response: ApiResponse<IReport> = {
          success: true,
          message: "Compliance report generated successfully",
          data: report,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error generating compliance report:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to generate compliance report", 500);
      }
    }
  );

  public generateMonitoringReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId, startDate, endDate, title, reportTypes } =
        req.body as MonitoringReportBody;
      logger.info("🚀 Generating monitoring report:", title);

      // Validate required fields
      if (!startDate || !endDate || !title || !reportTypes?.length) {
        throw new CustomError(
          "startDate, endDate, title, and reportTypes are required",
          400
        );
      }

      try {
        // Implementation for monitoring reports would go here
        // For now, throw not implemented error
        throw new CustomError("Monitoring reports not yet implemented", 501);
      } catch (error) {
        logger.error("Error generating monitoring report:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to generate monitoring report", 500);
      }
    }
  );

  public deleteReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Deleting report:", id);

      // Fixed: Use parseToNumber helper method
      const reportId = this.parseToNumber(id);
      if (reportId === undefined) {
        throw new CustomError("Invalid report ID", 400);
      }

      try {
        // Get report to check ownership and file path
        const rawReport = await database.queryOne<IReportRaw>(
          "SELECT * FROM reports WHERE id = ?",
          [reportId]
        );

        if (!rawReport) {
          throw new CustomError("Report not found", 404);
        }

        const report = this.convertRawReport(rawReport);

        // Check if user has permission to delete
        if (
          report.generated_by !== req.user?.id &&
          req.user?.role !== "admin"
        ) {
          throw new CustomError(
            "You can only delete reports you generated",
            403
          );
        }

        // Delete file if exists
        if (report.file_path && fs.existsSync(report.file_path)) {
          try {
            fs.unlinkSync(report.file_path);
            logger.info(`Deleted report file: ${report.file_path}`);
          } catch (fileError) {
            logger.warn(
              `Failed to delete report file: ${report.file_path}`,
              fileError
            );
            // Continue with database deletion even if file deletion fails
          }
        }

        // Delete from database
        await database.execute("DELETE FROM reports WHERE id = ?", [reportId]);

        logger.info(`Report ${id} deleted successfully`);

        const response: ApiResponse<null> = {
          success: true,
          message: "Report deleted successfully",
          data: null,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error deleting report:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to delete report", 500);
      }
    }
  );

  public regenerateReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Regenerating report ID:", id);

      // Fixed: Use parseToNumber helper method
      const reportId = this.parseToNumber(id);
      if (reportId === undefined) {
        throw new CustomError("Invalid report ID", 400);
      }

      try {
        // Get existing report
        const existingRawReport = await database.queryOne<IReportRaw>(
          "SELECT * FROM reports WHERE id = ?",
          [reportId]
        );

        if (!existingRawReport) {
          throw new CustomError("Report not found", 404);
        }

        const existingReport = this.convertRawReport(existingRawReport);

        // Check if user has permission to regenerate
        if (
          existingReport.generated_by !== req.user?.id &&
          req.user?.role !== "admin"
        ) {
          throw new CustomError(
            "You can only regenerate reports you generated",
            403
          );
        }

        // Delete old file if exists
        if (
          existingReport.file_path &&
          fs.existsSync(existingReport.file_path)
        ) {
          try {
            fs.unlinkSync(existingReport.file_path);
          } catch (fileError) {
            logger.warn(
              `Failed to delete old report file: ${existingReport.file_path}`,
              fileError
            );
          }
        }

        // Update status to generating
        await database.execute(
          "UPDATE reports SET status = 'generating', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [reportId]
        );

        // Parse parameters to determine report type and regenerate
        const parameters = existingReport.parameters || {};

        // Create proper ReportParams with required fields
        const reportParams: ReportParams = {
          title: existingReport.title,
          generatedBy: req.user!.id,
          ...parameters,
        };

        let newReport: IReport;

        switch (existingReport.report_type) {
          case "energy_consumption":
            newReport =
              await reportService.generateEnergyConsumptionReport(reportParams);
            break;
          case "power_quality":
            newReport =
              await reportService.generatePowerQualityReport(reportParams);
            break;
          case "audit_summary":
            // Use the enhanced comprehensive energy audit report
            newReport =
              await reportService.generateAuditSummaryReport(reportParams);
            break;
          case "compliance":
            newReport =
              await reportService.generateComplianceReport(reportParams);
            break;
          default:
            throw new CustomError(
              "Unsupported report type for regeneration",
              400
            );
        }

        // Update the existing report record with new data
        await database.execute(
          `UPDATE reports 
           SET file_path = ?, file_name = ?, file_size = ?, status = 'completed', 
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            newReport.file_path,
            newReport.file_name,
            newReport.file_size,
            reportId,
          ]
        );

        // Get updated report
        const rawUpdatedReport = await database.queryOne<IReportRaw>(
          `SELECT 
            r.*,
            b.name as building_name,
            a.title as audit_title,
            u.first_name,
            u.last_name
          FROM reports r
          LEFT JOIN buildings b ON r.building_id = b.id
          LEFT JOIN audits a ON r.audit_id = a.id
          LEFT JOIN users u ON r.generated_by = u.id
          WHERE r.id = ?`,
          [reportId]
        );

        const updatedReport = this.convertRawReport(rawUpdatedReport!);

        logger.info(`Report ${id} regenerated successfully`);

        const response: ApiResponse<IReport> = {
          success: true,
          message: "Report regenerated successfully",
          data: updatedReport,
        };

        res.json(response);
      } catch (error) {
        // Update status to failed on error
        try {
          await database.execute(
            "UPDATE reports SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [reportId]
          );
        } catch (updateError) {
          logger.error(
            "Failed to update report status to failed:",
            updateError
          );
        }

        logger.error("Error regenerating report:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to regenerate report", 500);
      }
    }
  );

  // Private helper methods

  /**
   * Enhance reports with additional statistics
   */
  private async enhanceReportsWithStats(
    reports: IReportDetailed[]
  ): Promise<IReportDetailed[]> {
    if (reports.length === 0) return reports;

    try {
      return reports.map((report) => ({
        ...report,
        generation_time: this.calculateGenerationTime(report),
        status_description: this.getStatusDescription(report),
      }));
    } catch (error) {
      logger.error("Error enhancing reports with stats:", error);
      // Return reports without enhancement rather than failing
      return reports;
    }
  }

  /**
   * Get report summary information (renamed to avoid duplicate)
   */
  private async getReportSummaryData(report: IReportDetailed): Promise<any> {
    try {
      let summary: any = {
        report_type: report.report_type,
        status: report.status,
        generated_at: report.created_at,
        file_available:
          report.file_available ||
          (report.file_path && fs.existsSync(report.file_path)),
      };

      // Add type-specific summary information
      if (report.data) {
        try {
          const reportData =
            typeof report.data === "string"
              ? JSON.parse(report.data)
              : report.data;

          switch (report.report_type) {
            case "energy_consumption":
              summary.energy_summary = {
                total_consumption: reportData.total_consumption || 0,
                period_days: reportData.period_days || 0,
                buildings_analyzed: reportData.buildings_count || 1,
              };
              break;
            case "power_quality":
              summary.power_quality_summary = {
                readings_analyzed: reportData.readings_count || 0,
                violations_found: reportData.violations_count || 0,
                compliance_score: reportData.compliance_score || 0,
              };
              break;
            case "audit_summary":
              // Enhanced summary for comprehensive energy audit reports
              summary.audit_summary = {
                compliance_checks: reportData.compliance_checks_count || 0,
                energy_conservation_opportunities: reportData.total_ecos || 0,
                total_annual_savings_php:
                  reportData.total_annual_savings_php || 0,
                total_implementation_cost_php:
                  reportData.total_implementation_cost_php || 0,
                average_payback_years: reportData.average_payback_years || 0,
                baseline_consumption_kwh:
                  reportData.baseline_consumption_kwh || 0,
                baseline_cost_php: reportData.baseline_cost_php || 0,
                overall_score: reportData.overall_score || 0,
              };
              break;
            case "compliance":
              summary.compliance_summary = {
                compliance_checks: reportData.compliance_checks_count || 0,
                non_compliant_items: reportData.non_compliant_count || 0,
                overall_score: reportData.overall_score || 0,
              };
              break;
          }
        } catch (parseError) {
          logger.warn("Failed to parse report data for summary:", parseError);
        }
      }

      return summary;
    } catch (error) {
      logger.error("Error getting report summary:", error);
      return {
        report_type: report.report_type,
        status: report.status,
        generated_at: report.created_at,
        file_available: false,
      };
    }
  }

  /**
   * Calculate report generation time
   */
  private calculateGenerationTime(report: IReportDetailed): string {
    try {
      const created = new Date(report.created_at);
      const updated = new Date(report.updated_at || report.created_at);

      // Ensure both dates are valid
      if (isNaN(created.getTime()) || isNaN(updated.getTime())) {
        return "Unknown";
      }

      const diffMs = updated.getTime() - created.getTime();

      // Handle negative differences (shouldn't happen but just in case)
      if (diffMs < 0) return "0s";

      if (diffMs < 1000) return "< 1s";
      if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
      if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m`;
      return `${Math.round(diffMs / 3600000)}h`;
    } catch (error) {
      logger.error("Error calculating generation time:", error);
      return "Unknown";
    }
  }

  /**
   * Get human-readable status description
   */
  private getStatusDescription(report: IReportDetailed): string {
    const statusMap: Record<string, string> = {
      generating: "Report is being generated...",
      completed: "Report generated successfully",
      failed: "Report generation failed",
      cancelled: "Report generation was cancelled",
    };

    return statusMap[report.status] || "Unknown status";
  }
}

export default new ReportController();
