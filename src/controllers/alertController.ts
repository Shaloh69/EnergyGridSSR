import { Request, Response } from "express";
import { ApiResponse } from "@/interfaces/IResponse";
import {
  IAlert,
  IAlertRaw,
  IAlertCreate,
  IAlertUpdate,
  IAlertThreshold,
  IAlertThresholdCreate,
  AlertType,
  AlertSeverity,
  AlertStatus,
  BackgroundJobInfo,
  PowerQualityEventInfo,
  MaintenancePredictionInfo,
  MonitoringTestResult,
  AlertStatistics,
  EnhancedMonitoringTestResult,
} from "@/interfaces/IAlert";
import { PaginatedResponse, PaginationQuery } from "@/types/common";
import alertService from "@/services/alertService";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";
import { database } from "@/config/database";

interface AlertQuery extends PaginationQuery {
  building_id?: string;
  equipment_id?: string;
  type?: string;
  severity?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

interface ThresholdQuery extends PaginationQuery {
  building_id?: string;
  equipment_id?: string;
  parameter_type?: string;
  enabled?: string;
}

class AlertController {
  /**
   * Helper method to convert raw alert to typed alert
   */
  private convertRawAlert(rawAlert: IAlertRaw): IAlert {
    return {
      ...rawAlert,
      metadata: rawAlert.metadata ? JSON.parse(rawAlert.metadata) : undefined,
    };
  }

  /**
   * Get alerts with filtering and pagination
   */
  public getAlerts = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Starting getAlerts request");

      const {
        page = 1,
        limit = 20,
        building_id,
        equipment_id,
        type,
        severity,
        status = "active",
        start_date,
        end_date,
      } = req.query as AlertQuery;

      // Parse and validate pagination
      const pageNum = Math.max(1, parseInt(page.toString()) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit.toString()) || 20)
      );
      const offset = (pageNum - 1) * limitNum;

      try {
        // Build WHERE conditions with proper parameterization
        const conditions: string[] = [];
        const params: any[] = [];

        if (building_id && !isNaN(parseInt(building_id))) {
          conditions.push("a.building_id = ?");
          params.push(parseInt(building_id));
        }

        if (equipment_id && !isNaN(parseInt(equipment_id))) {
          conditions.push("a.equipment_id = ?");
          params.push(parseInt(equipment_id));
        }

        if (type && Object.values(AlertType).includes(type as AlertType)) {
          conditions.push("a.type = ?");
          params.push(type);
        }

        if (
          severity &&
          Object.values(AlertSeverity).includes(severity as AlertSeverity)
        ) {
          conditions.push("a.severity = ?");
          params.push(severity);
        }

        if (
          status !== "all" &&
          Object.values(AlertStatus).includes(status as AlertStatus)
        ) {
          conditions.push("a.status = ?");
          params.push(status);
        }

        if (start_date) {
          conditions.push("a.created_at >= ?");
          params.push(start_date);
        }

        if (end_date) {
          conditions.push("a.created_at <= ?");
          params.push(end_date);
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as total FROM alerts a ${whereClause}`;
        const countResult = await database.queryOne<{ total: number }>(
          countQuery,
          params
        );
        const totalItems = countResult?.total || 0;

        // Get alerts data
        const dataQuery = `
          SELECT 
            a.*,
            b.name as building_name,
            b.code as building_code,
            e.name as equipment_name,
            e.equipment_type,
            u1.first_name as acknowledged_by_name,
            u1.last_name as acknowledged_by_lastname,
            u2.first_name as resolved_by_name,
            u2.last_name as resolved_by_lastname,
            TIMESTAMPDIFF(MINUTE, a.created_at, NOW()) as age_minutes
          FROM alerts a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN equipment e ON a.equipment_id = e.id
          LEFT JOIN users u1 ON a.acknowledged_by = u1.id
          LEFT JOIN users u2 ON a.resolved_by = u2.id
          ${whereClause}
          ORDER BY a.created_at DESC
          LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limitNum, offset];
        logger.info("Executing data query with params:", {
          query: dataQuery.substring(0, 100),
          paramsCount: dataParams.length,
        });

        const rawAlerts = await database.query<IAlertRaw>(
          dataQuery,
          dataParams
        );
        const alerts = rawAlerts.map((rawAlert) =>
          this.convertRawAlert(rawAlert)
        );
        logger.info("Alerts retrieved:", alerts.length);

        // Enhance alerts with additional statistics
        const enhancedAlerts = await this.enhanceAlertsWithStats(alerts);

        // Build response
        const totalPages = Math.ceil(totalItems / limitNum);

        const response: ApiResponse<PaginatedResponse<IAlert>> = {
          success: true,
          message: "Alerts retrieved successfully",
          data: {
            data: enhancedAlerts,
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

        logger.info(`Successfully returned ${enhancedAlerts.length} alerts`);
        res.json(response);
      } catch (error) {
        logger.error("Error fetching alerts:", error);
        throw new CustomError("Failed to fetch alerts", 500);
      }
    }
  );

  /**
   * Get alert by ID
   */
  public getAlertById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Getting alert by ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid alert ID", 400);
      }

      const alertId = parseInt(id);

      try {
        const rawAlert = await database.queryOne<IAlertRaw>(
          `SELECT 
            a.*,
            b.name as building_name,
            b.code as building_code,
            e.name as equipment_name,
            e.equipment_type,
            u1.first_name as acknowledged_by_name,
            u1.last_name as acknowledged_by_lastname,
            u2.first_name as resolved_by_name,
            u2.last_name as resolved_by_lastname,
            TIMESTAMPDIFF(MINUTE, a.created_at, NOW()) as age_minutes
          FROM alerts a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN equipment e ON a.equipment_id = e.id
          LEFT JOIN users u1 ON a.acknowledged_by = u1.id
          LEFT JOIN users u2 ON a.resolved_by = u2.id
          WHERE a.id = ?`,
          [alertId]
        );

        if (!rawAlert) {
          throw new CustomError("Alert not found", 404);
        }

        const alert = this.convertRawAlert(rawAlert);

        const response: ApiResponse<IAlert> = {
          success: true,
          message: "Alert retrieved successfully",
          data: alert,
        };

        logger.info("Successfully retrieved alert:", alert.title);
        res.json(response);
      } catch (error) {
        logger.error("Error fetching alert by ID:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch alert", 500);
      }
    }
  );

  /**
   * Create manual alert
   */
  public createAlert = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const alertData = req.body as IAlertCreate;
      logger.info("🚀 Creating alert:", alertData.title);

      // Validate required fields
      if (
        !alertData.type ||
        !alertData.severity ||
        !alertData.title ||
        !alertData.message
      ) {
        throw new CustomError(
          "type, severity, title, and message are required",
          400
        );
      }

      try {
        // Validate building exists if provided
        if (alertData.building_id) {
          const building = await database.queryOne(
            "SELECT id FROM buildings WHERE id = ?",
            [alertData.building_id]
          );
          if (!building) {
            throw new CustomError("Building not found", 404);
          }
        }

        // Validate equipment exists if provided
        if (alertData.equipment_id) {
          const equipment = await database.queryOne(
            "SELECT id FROM equipment WHERE id = ?",
            [alertData.equipment_id]
          );
          if (!equipment) {
            throw new CustomError("Equipment not found", 404);
          }
        }

        // Insert new alert using specialized insert method
        const insertQuery = `
          INSERT INTO alerts 
          (type, severity, status, title, message, building_id, equipment_id, 
           audit_id, detected_value, threshold_value, metadata) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          alertData.type,
          alertData.severity,
          alertData.status || AlertStatus.ACTIVE,
          alertData.title,
          alertData.message,
          alertData.building_id || null,
          alertData.equipment_id || null,
          alertData.audit_id || null,
          alertData.detected_value || null,
          alertData.threshold_value || null,
          alertData.metadata ? JSON.stringify(alertData.metadata) : null,
        ];

        const insertId = await database.insert(insertQuery, insertParams);
        logger.info("Alert created with ID:", insertId);

        // Get the created alert with enhanced information
        const rawNewAlert = await database.queryOne<IAlertRaw>(
          `SELECT 
            a.*,
            b.name as building_name,
            b.code as building_code,
            e.name as equipment_name,
            e.equipment_type
          FROM alerts a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN equipment e ON a.equipment_id = e.id
          WHERE a.id = ?`,
          [insertId]
        );

        if (!rawNewAlert) {
          throw new CustomError("Failed to retrieve created alert", 500);
        }

        const newAlert = this.convertRawAlert(rawNewAlert);

        logger.info(
          `Manual alert created by user ${req.user?.id}: ${alertData.title}`
        );

        const response: ApiResponse<IAlert> = {
          success: true,
          message: "Alert created successfully",
          data: newAlert,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error creating alert:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to create alert", 500);
      }
    }
  );

  /**
   * Update alert (acknowledge, resolve, etc.)
   */
  public updateAlert = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updateData = req.body as IAlertUpdate;
      logger.info("🚀 Updating alert ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid alert ID", 400);
      }

      const alertId = parseInt(id);

      try {
        // Check if alert exists
        const existingRawAlert = await database.queryOne<IAlertRaw>(
          "SELECT * FROM alerts WHERE id = ?",
          [alertId]
        );

        if (!existingRawAlert) {
          throw new CustomError("Alert not found", 404);
        }

        // Add user information for acknowledgment/resolution
        if (updateData.status === AlertStatus.ACKNOWLEDGED) {
          updateData.acknowledged_by = req.user?.id;
        }
        if (updateData.status === AlertStatus.RESOLVED) {
          updateData.resolved_by = req.user?.id;
        }

        // Build update query dynamically
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        const allowedFields = [
          "status",
          "acknowledged_by",
          "resolved_by",
          "metadata",
          "escalation_level",
          "notification_sent",
        ];

        Object.entries(updateData).forEach(([key, value]) => {
          if (allowedFields.includes(key) && value !== undefined) {
            updateFields.push(`${key} = ?`);
            if (key === "metadata" && typeof value === "object") {
              updateValues.push(JSON.stringify(value));
            } else {
              updateValues.push(value);
            }
          }
        });

        // Add timestamp fields based on status
        if (updateData.status === AlertStatus.ACKNOWLEDGED) {
          updateFields.push("acknowledged_at = CURRENT_TIMESTAMP");
        }
        if (updateData.status === AlertStatus.RESOLVED) {
          updateFields.push("resolved_at = CURRENT_TIMESTAMP");
        }

        if (updateFields.length === 0) {
          throw new CustomError("No valid fields to update", 400);
        }

        // Add alert ID to parameters
        updateValues.push(alertId);

        const updateQuery = `
          UPDATE alerts 
          SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;

        const affectedRows = await database.execute(updateQuery, updateValues);
        logger.info("Update affected rows:", affectedRows);

        // Get updated alert
        const rawUpdatedAlert = await database.queryOne<IAlertRaw>(
          `SELECT 
            a.*,
            b.name as building_name,
            b.code as building_code,
            e.name as equipment_name,
            e.equipment_type,
            u1.first_name as acknowledged_by_name,
            u1.last_name as acknowledged_by_lastname,
            u2.first_name as resolved_by_name,
            u2.last_name as resolved_by_lastname
          FROM alerts a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN equipment e ON a.equipment_id = e.id
          LEFT JOIN users u1 ON a.acknowledged_by = u1.id
          LEFT JOIN users u2 ON a.resolved_by = u2.id
          WHERE a.id = ?`,
          [alertId]
        );

        const updatedAlert = this.convertRawAlert(rawUpdatedAlert!);

        logger.info(
          `Alert ${id} updated by user ${req.user?.id}: status changed to ${updateData.status}`
        );

        const response: ApiResponse<IAlert> = {
          success: true,
          message: "Alert updated successfully",
          data: updatedAlert,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error updating alert:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to update alert", 500);
      }
    }
  );

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Acknowledging alert ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid alert ID", 400);
      }

      const alertId = parseInt(id);

      try {
        // Check if alert exists and is in active status
        const existingRawAlert = await database.queryOne<IAlertRaw>(
          "SELECT * FROM alerts WHERE id = ? AND status = ?",
          [alertId, AlertStatus.ACTIVE]
        );

        if (!existingRawAlert) {
          throw new CustomError("Alert not found or already acknowledged", 404);
        }

        const updateQuery = `
          UPDATE alerts 
          SET status = ?, acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        const affectedRows = await database.execute(updateQuery, [
          AlertStatus.ACKNOWLEDGED,
          req.user?.id,
          alertId,
        ]);

        if (affectedRows === 0) {
          throw new CustomError("Failed to acknowledge alert", 500);
        }

        // Get updated alert
        const rawAlert = await database.queryOne<IAlertRaw>(
          `SELECT 
            a.*,
            b.name as building_name,
            b.code as building_code,
            e.name as equipment_name,
            e.equipment_type,
            u1.first_name as acknowledged_by_name,
            u1.last_name as acknowledged_by_lastname
          FROM alerts a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN equipment e ON a.equipment_id = e.id
          LEFT JOIN users u1 ON a.acknowledged_by = u1.id
          WHERE a.id = ?`,
          [alertId]
        );

        const alert = this.convertRawAlert(rawAlert!);

        logger.info(`Alert ${id} acknowledged by user ${req.user?.id}`);

        const response: ApiResponse<IAlert> = {
          success: true,
          message: "Alert acknowledged successfully",
          data: alert,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error acknowledging alert:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to acknowledge alert", 500);
      }
    }
  );

  /**
   * Resolve alert
   */
  public resolveAlert = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { resolution_notes } = req.body;
      logger.info("🚀 Resolving alert ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid alert ID", 400);
      }

      const alertId = parseInt(id);

      try {
        // Check if alert exists
        const existingRawAlert = await database.queryOne<IAlertRaw>(
          "SELECT * FROM alerts WHERE id = ?",
          [alertId]
        );

        if (!existingRawAlert) {
          throw new CustomError("Alert not found", 404);
        }

        // Fixed: Properly handle metadata parsing
        let metadata: Record<string, any>;
        if (existingRawAlert.metadata) {
          const parsedMetadata = JSON.parse(existingRawAlert.metadata);
          metadata = { ...parsedMetadata, resolution_notes };
        } else {
          metadata = { resolution_notes };
        }

        const updateQuery = `
          UPDATE alerts 
          SET status = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, 
              metadata = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        const affectedRows = await database.execute(updateQuery, [
          AlertStatus.RESOLVED,
          req.user?.id,
          JSON.stringify(metadata),
          alertId,
        ]);

        if (affectedRows === 0) {
          throw new CustomError("Failed to resolve alert", 500);
        }

        // Get updated alert
        const rawAlert = await database.queryOne<IAlertRaw>(
          `SELECT 
            a.*,
            b.name as building_name,
            b.code as building_code,
            e.name as equipment_name,
            e.equipment_type,
            u2.first_name as resolved_by_name,
            u2.last_name as resolved_by_lastname
          FROM alerts a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN equipment e ON a.equipment_id = e.id
          LEFT JOIN users u2 ON a.resolved_by = u2.id
          WHERE a.id = ?`,
          [alertId]
        );

        const alert = this.convertRawAlert(rawAlert!);

        logger.info(`Alert ${id} resolved by user ${req.user?.id}`);

        const response: ApiResponse<IAlert> = {
          success: true,
          message: "Alert resolved successfully",
          data: alert,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error resolving alert:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to resolve alert", 500);
      }
    }
  );

  /**
   * Get alert statistics
   */
  public getAlertStatistics = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { building_id, days = "30" } = req.query;
      logger.info("🚀 Getting alert statistics");

      try {
        const conditions: string[] = [];
        const params: any[] = [];

        if (building_id && !isNaN(parseInt(building_id as string))) {
          conditions.push("building_id = ?");
          params.push(parseInt(building_id as string));
        }

        const daysBack = parseInt(days as string);
        conditions.push("created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)");
        params.push(daysBack);

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Get comprehensive statistics
        const [
          totalStats,
          severityStats,
          typeStats,
          statusStats,
          responseTimeStats,
        ] = await Promise.all([
          // Total counts
          database.queryOne<any>(
            `SELECT 
              COUNT(*) as total_alerts,
              COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as alerts_today,
              COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as alerts_this_week
            FROM alerts ${whereClause}`,
            params
          ),

          // By severity
          database.query<any>(
            `SELECT severity, COUNT(*) as count 
            FROM alerts ${whereClause} 
            GROUP BY severity`,
            params
          ),

          // By type
          database.query<any>(
            `SELECT type, COUNT(*) as count 
            FROM alerts ${whereClause} 
            GROUP BY type`,
            params
          ),

          // By status
          database.query<any>(
            `SELECT status, COUNT(*) as count 
            FROM alerts ${whereClause} 
            GROUP BY status`,
            params
          ),

          // Response time statistics
          database.queryOne<any>(
            `SELECT 
              AVG(TIMESTAMPDIFF(MINUTE, created_at, acknowledged_at)) as avg_acknowledgment_time,
              AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at)) as avg_resolution_time
            FROM alerts 
            ${whereClause} AND acknowledged_at IS NOT NULL`,
            params
          ),
        ]);

        // Calculate trends
        const trends = await this.calculateAlertTrends(params, whereClause);

        const statistics: AlertStatistics = {
          total: totalStats || {
            total_alerts: 0,
            alerts_today: 0,
            alerts_this_week: 0,
          },
          by_severity: this.formatStatsByKey(severityStats, "severity"),
          by_type: this.formatStatsByKey(typeStats, "type"),
          by_status: this.formatStatsByKey(statusStats, "status"),
          response_times: responseTimeStats || {
            avg_acknowledgment_time: 0,
            avg_resolution_time: 0,
          },
          trends,
        };

        const response: ApiResponse<AlertStatistics> = {
          success: true,
          message: "Alert statistics retrieved successfully",
          data: statistics,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching alert statistics:", error);
        throw new CustomError("Failed to fetch alert statistics", 500);
      }
    }
  );

  /**
   * Get alert thresholds with filtering
   */
  public getThresholds = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting alert thresholds");

      const {
        page = 1,
        limit = 20,
        building_id,
        equipment_id,
        parameter_type,
        enabled,
      } = req.query as ThresholdQuery;

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

        if (building_id && !isNaN(parseInt(building_id))) {
          conditions.push("at.building_id = ?");
          params.push(parseInt(building_id));
        }

        if (equipment_id && !isNaN(parseInt(equipment_id))) {
          conditions.push("at.equipment_id = ?");
          params.push(parseInt(equipment_id));
        }

        if (
          parameter_type &&
          ["energy", "power_quality", "equipment"].includes(parameter_type)
        ) {
          conditions.push("at.parameter_type = ?");
          params.push(parameter_type);
        }

        if (enabled && ["true", "false"].includes(enabled)) {
          conditions.push("at.enabled = ?");
          params.push(enabled === "true");
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM alert_thresholds at ${whereClause}`;
        const countResult = await database.queryOne<{ total: number }>(
          countQuery,
          params
        );
        const totalItems = countResult?.total || 0;

        // Get thresholds data
        const dataQuery = `
          SELECT 
            at.*,
            b.name as building_name,
            b.code as building_code,
            e.name as equipment_name,
            e.equipment_type,
            COUNT(a.id) as alerts_generated,
            MAX(a.created_at) as last_alert_time
          FROM alert_thresholds at
          LEFT JOIN buildings b ON at.building_id = b.id
          LEFT JOIN equipment e ON at.equipment_id = e.id
          LEFT JOIN alerts a ON JSON_EXTRACT(a.metadata, '$.threshold_id') = at.id
          ${whereClause}
          GROUP BY at.id, b.name, b.code, e.name, e.equipment_type
          ORDER BY at.created_at DESC
          LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limitNum, offset];
        const rawThresholds = await database.query<any>(dataQuery, dataParams);

        // Process notification_emails and metadata fields with proper type handling
        const processedThresholds = rawThresholds.map((threshold: any) => {
          // Safe parsing of JSON fields
          let parsedEmails: string[] = [];
          let parsedMetadata: Record<string, any> = {};

          try {
            if (threshold.notification_emails) {
              if (typeof threshold.notification_emails === "string") {
                parsedEmails = JSON.parse(threshold.notification_emails);
              } else if (Array.isArray(threshold.notification_emails)) {
                parsedEmails = threshold.notification_emails;
              }
            }
          } catch (error) {
            logger.warn(
              `Failed to parse notification_emails for threshold ${threshold.id}`
            );
            parsedEmails = [];
          }

          try {
            if (threshold.metadata) {
              if (typeof threshold.metadata === "string") {
                parsedMetadata = JSON.parse(threshold.metadata);
              } else if (typeof threshold.metadata === "object") {
                parsedMetadata = threshold.metadata;
              }
            }
          } catch (error) {
            logger.warn(
              `Failed to parse metadata for threshold ${threshold.id}`
            );
            parsedMetadata = {};
          }

          return {
            ...threshold,
            notification_emails: parsedEmails,
            metadata: parsedMetadata,
          } as IAlertThreshold;
        });

        const totalPages = Math.ceil(totalItems / limitNum);

        const response: ApiResponse<PaginatedResponse<IAlertThreshold>> = {
          success: true,
          message: "Alert thresholds retrieved successfully",
          data: {
            data: processedThresholds,
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

        res.json(response);
      } catch (error) {
        logger.error("Error fetching alert thresholds:", error);
        throw new CustomError("Failed to fetch alert thresholds", 500);
      }
    }
  );

  /**
   * Create alert threshold
   */
  public createThreshold = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const thresholdData = req.body as IAlertThresholdCreate;
      logger.info("🚀 Creating alert threshold:", thresholdData.parameter_name);

      // Validate required fields
      if (
        !thresholdData.parameter_name ||
        !thresholdData.parameter_type ||
        !thresholdData.threshold_type ||
        !thresholdData.severity
      ) {
        throw new CustomError(
          "parameter_name, parameter_type, threshold_type, and severity are required",
          400
        );
      }

      // Validate that at least one threshold value is provided
      if (!thresholdData.min_value && !thresholdData.max_value) {
        throw new CustomError(
          "At least one of min_value or max_value must be provided",
          400
        );
      }

      try {
        // Validate building exists if provided
        if (thresholdData.building_id) {
          const building = await database.queryOne(
            "SELECT id FROM buildings WHERE id = ? AND status = 'active'",
            [thresholdData.building_id]
          );
          if (!building) {
            throw new CustomError("Building not found or inactive", 404);
          }
        }

        // Validate equipment exists if provided
        if (thresholdData.equipment_id) {
          const equipment = await database.queryOne(
            "SELECT id FROM equipment WHERE id = ? AND status = 'active'",
            [thresholdData.equipment_id]
          );
          if (!equipment) {
            throw new CustomError("Equipment not found or inactive", 404);
          }
        }

        // Check for duplicate thresholds
        const existingThreshold = await database.queryOne(
          `SELECT id FROM alert_thresholds 
           WHERE parameter_name = ? AND parameter_type = ? 
           AND building_id = ? AND equipment_id = ? AND enabled = true`,
          [
            thresholdData.parameter_name,
            thresholdData.parameter_type,
            thresholdData.building_id || null,
            thresholdData.equipment_id || null,
          ]
        );

        if (existingThreshold) {
          throw new CustomError(
            "A threshold for this parameter already exists for the specified building/equipment",
            409
          );
        }

        // Safely stringify JSON fields
        const notificationEmailsJson = thresholdData.notification_emails
          ? JSON.stringify(thresholdData.notification_emails)
          : null;
        const metadataJson = thresholdData.metadata
          ? JSON.stringify(thresholdData.metadata)
          : null;

        // Insert new threshold
        const insertQuery = `
          INSERT INTO alert_thresholds 
          (building_id, equipment_id, parameter_name, parameter_type, min_value, max_value,
           threshold_type, severity, enabled, escalation_minutes, notification_emails, metadata) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          thresholdData.building_id || null,
          thresholdData.equipment_id || null,
          thresholdData.parameter_name,
          thresholdData.parameter_type,
          thresholdData.min_value || null,
          thresholdData.max_value || null,
          thresholdData.threshold_type,
          thresholdData.severity,
          thresholdData.enabled ?? true,
          thresholdData.escalation_minutes || null,
          notificationEmailsJson,
          metadataJson,
        ];

        const insertId = await database.insert(insertQuery, insertParams);

        // Get the created threshold with enhanced information
        const rawNewThreshold = await database.queryOne<any>(
          `SELECT 
            at.*,
            b.name as building_name,
            b.code as building_code,
            e.name as equipment_name,
            e.equipment_type
          FROM alert_thresholds at
          LEFT JOIN buildings b ON at.building_id = b.id
          LEFT JOIN equipment e ON at.equipment_id = e.id
          WHERE at.id = ?`,
          [insertId]
        );

        if (!rawNewThreshold) {
          throw new CustomError("Failed to retrieve created threshold", 500);
        }

        // Process JSON fields with proper type handling
        let parsedEmails: string[] = [];
        let parsedMetadata: Record<string, any> = {};

        try {
          if (rawNewThreshold.notification_emails) {
            if (typeof rawNewThreshold.notification_emails === "string") {
              parsedEmails = JSON.parse(rawNewThreshold.notification_emails);
            } else if (Array.isArray(rawNewThreshold.notification_emails)) {
              parsedEmails = rawNewThreshold.notification_emails;
            }
          }
        } catch (error) {
          logger.warn(
            `Failed to parse notification_emails for new threshold ${insertId}`
          );
          parsedEmails = [];
        }

        try {
          if (rawNewThreshold.metadata) {
            if (typeof rawNewThreshold.metadata === "string") {
              parsedMetadata = JSON.parse(rawNewThreshold.metadata);
            } else if (typeof rawNewThreshold.metadata === "object") {
              parsedMetadata = rawNewThreshold.metadata;
            }
          }
        } catch (error) {
          logger.warn(`Failed to parse metadata for new threshold ${insertId}`);
          parsedMetadata = {};
        }

        const processedThreshold: IAlertThreshold = {
          ...rawNewThreshold,
          notification_emails: parsedEmails,
          metadata: parsedMetadata,
        };

        logger.info(
          `Alert threshold created: ${thresholdData.parameter_name} for ${thresholdData.parameter_type}`
        );

        const response: ApiResponse<IAlertThreshold> = {
          success: true,
          message: "Alert threshold created successfully",
          data: processedThreshold,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error creating alert threshold:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to create alert threshold", 500);
      }
    }
  );

  /**
   * Test alert monitoring for building - ENHANCED with background jobs integration
   */
  public testMonitoring = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      const { monitoring_type, test_data, async_processing = false } = req.body;
      logger.info("🚀 Testing monitoring for building:", buildingId);

      if (!buildingId || isNaN(parseInt(buildingId))) {
        throw new CustomError("Invalid building ID", 400);
      }

      if (
        !monitoring_type ||
        !["energy", "power_quality", "equipment"].includes(monitoring_type)
      ) {
        throw new CustomError(
          "Invalid monitoring type. Must be: energy, power_quality, or equipment",
          400
        );
      }

      if (!test_data || typeof test_data !== "object") {
        throw new CustomError("test_data object is required", 400);
      }

      const buildingIdNum = parseInt(buildingId);

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name FROM buildings WHERE id = ? AND status = 'active'",
          [buildingIdNum]
        );

        if (!building) {
          throw new CustomError("Building not found or inactive", 404);
        }

        let testResults: EnhancedMonitoringTestResult; // Changed type
        let backgroundJobId: number | null = null;

        // 🔧 ENHANCEMENT 1: Background Jobs Integration
        if (async_processing || test_data.complex_analysis) {
          // Create background job for heavy processing
          backgroundJobId = await this.createBackgroundJob(
            monitoring_type,
            buildingIdNum,
            test_data
          );

          testResults = {
            background_job_id: backgroundJobId,
            status: "processing",
            message: "Complex analysis started in background",
            estimated_completion: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            success: true,
            alerts_generated: 0,
            processing_time: 0,
            test_results: {},
            alerts: [],
            compliance_status: "compliant",
          } as any;
        } else {
          // Immediate processing for simple tests
          switch (monitoring_type) {
            case "energy":
              testResults = await this.testEnergyMonitoringEnhanced(
                buildingIdNum,
                test_data
              );
              break;

            case "power_quality":
              testResults = await this.testPowerQualityMonitoringEnhanced(
                buildingIdNum,
                test_data
              );
              break;

            case "equipment":
              testResults = await this.testEquipmentMonitoringEnhanced(
                buildingIdNum,
                test_data
              );
              break;

            default:
              throw new CustomError("Unsupported monitoring type", 400);
          }
        }

        // Enhanced logging with background job reference
        await database.query(
          `INSERT INTO system_monitoring_logs 
           (monitoring_type, building_id, check_result, details, alerts_generated, processing_time_ms)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            monitoring_type,
            buildingIdNum,
            testResults.success ? "passed" : "failed",
            JSON.stringify({
              test_data,
              results: testResults,
              background_job_id: backgroundJobId,
              processing_mode: async_processing ? "async" : "sync",
            }),
            testResults.alerts_generated || 0,
            testResults.processing_time || 0,
          ]
        );

        const response: ApiResponse<any> = {
          success: true,
          message: `${monitoring_type} monitoring test ${async_processing ? "queued for" : "completed"} successfully`,
          data: {
            building_id: buildingIdNum,
            building_name: building.name,
            monitoring_type,
            test_results: testResults,
            background_job_id: backgroundJobId,
            processing_mode: async_processing ? "async" : "sync",
            timestamp: new Date(),
          },
        };

        res.json(response);
      } catch (error) {
        logger.error("Error testing monitoring:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to test monitoring", 500);
      }
    }
  );

  /**
   * Process escalations manually - for critical compliance issues per research objectives
   */
  public processEscalations = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Processing alert escalations manually");

      try {
        const startTime = Date.now();

        // Get unacknowledged critical and high severity alerts
        const unacknowledgedAlerts = await database.query<IAlert>(
          `SELECT * FROM alerts 
           WHERE status = 'active' 
           AND acknowledged_at IS NULL 
           AND severity IN ('critical', 'high')
           AND created_at <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
           ORDER BY 
             FIELD(severity, 'critical', 'high'),
             created_at ASC
           LIMIT 50`
        );

        const escalationResults = {
          processed: 0,
          escalated: 0,
          failed: 0,
          errors: [] as string[],
        };

        for (const alert of unacknowledgedAlerts) {
          try {
            escalationResults.processed++;

            // Determine escalation level
            const currentLevel = (alert.escalation_level || 0) + 1;
            const maxEscalationLevel = alert.severity === "critical" ? 3 : 2;

            if (currentLevel <= maxEscalationLevel) {
              // Update alert with escalation
              await database.execute(
                `UPDATE alerts 
                 SET status = 'escalated', 
                     escalation_level = ?,
                     escalated_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [currentLevel, alert.id]
              );

              // Log escalation
              await database.query(
                `INSERT INTO system_monitoring_logs 
                 (monitoring_type, building_id, equipment_id, check_result, details, alerts_generated)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  "alert_escalation",
                  alert.building_id,
                  alert.equipment_id,
                  "escalated",
                  JSON.stringify({
                    alert_id: alert.id,
                    escalation_level: currentLevel,
                    severity: alert.severity,
                    title: alert.title,
                  }),
                  1,
                ]
              );

              escalationResults.escalated++;
              logger.info(
                `Alert ${alert.id} escalated to level ${currentLevel}`
              );
            }
          } catch (error) {
            escalationResults.failed++;
            const errorMsg = `Failed to escalate alert ${alert.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
            escalationResults.errors.push(errorMsg);
            logger.error(errorMsg);
          }
        }

        const processingTime = Date.now() - startTime;

        // Update system statistics
        await database.query(
          `INSERT INTO system_monitoring_logs 
           (monitoring_type, check_result, details, processing_time_ms)
           VALUES (?, ?, ?, ?)`,
          [
            "escalation_processing",
            "completed",
            JSON.stringify(escalationResults),
            processingTime,
          ]
        );

        logger.info(
          `Escalation processing completed: ${escalationResults.escalated} alerts escalated out of ${escalationResults.processed} processed`
        );

        const response: ApiResponse<any> = {
          success: true,
          message: "Alert escalation processing completed",
          data: {
            ...escalationResults,
            processing_time_ms: processingTime,
            timestamp: new Date(),
          },
        };

        res.json(response);
      } catch (error) {
        logger.error("Error processing escalations:", error);
        throw new CustomError("Failed to process escalations", 500);
      }
    }
  );

  // Private helper methods

  /**
   * Enhance alerts with additional statistics
   */
  private async enhanceAlertsWithStats(alerts: IAlert[]): Promise<IAlert[]> {
    if (alerts.length === 0) return alerts;

    try {
      // Add any additional enhancement logic here
      return alerts.map((alert) => ({
        ...alert,
        // Add computed fields if needed
      }));
    } catch (error) {
      logger.error("Error enhancing alerts with stats:", error);
      // Return alerts without enhancement rather than failing
      return alerts;
    }
  }

  /**
   * Format statistics by key
   */
  private formatStatsByKey(stats: any[], key: string): Record<string, number> {
    const result: Record<string, number> = {};
    stats.forEach((stat) => {
      result[stat[key]] = stat.count;
    });
    return result;
  }

  /**
   * Calculate alert trends
   */
  private async calculateAlertTrends(
    params: any[],
    whereClause: string
  ): Promise<any> {
    try {
      const trendData = await database.query<any>(
        `SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM alerts 
        ${whereClause} AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC`,
        params
      );

      // Calculate escalation rate
      const escalationData = await database.queryOne<any>(
        `SELECT 
          COUNT(*) as total_alerts,
          COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated_alerts
        FROM alerts 
        ${whereClause}`,
        params
      );

      const escalationRate =
        escalationData?.total_alerts > 0
          ? (escalationData.escalated_alerts / escalationData.total_alerts) *
            100
          : 0;

      return {
        daily_alerts_last_week: trendData,
        escalation_rate: Math.round(escalationRate * 100) / 100,
      };
    } catch (error) {
      logger.error("Error calculating alert trends:", error);
      return {
        daily_alerts_last_week: [],
        escalation_rate: 0,
      };
    }
  }

  // 🔧 ENHANCEMENT 1: Background Jobs Integration
  /**
   * Create background job for complex monitoring analysis
   */
  private async createBackgroundJob(
    monitoringType: string,
    buildingId: number,
    testData: any
  ): Promise<number> {
    try {
      const jobParameters = {
        monitoring_type: monitoringType,
        building_id: buildingId,
        test_data: testData,
        analysis_depth: "comprehensive",
        include_predictions: true,
        include_baseline_comparison: true,
        start_date: new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        end_date: new Date().toISOString(),
      };

      const insertQuery = `
        INSERT INTO background_jobs 
        (job_type, building_id, job_parameters, status) 
        VALUES (?, ?, ?, ?)
      `;

      // Map monitoring type to job type
      const jobType =
        monitoringType === "energy"
          ? "analytics_processing"
          : monitoringType === "power_quality"
            ? "analytics_processing"
            : "maintenance_prediction";

      const insertId = await database.insert(insertQuery, [
        jobType,
        buildingId,
        JSON.stringify(jobParameters),
        "pending",
      ]);

      logger.info(
        `Background job created for ${monitoringType} monitoring: ${insertId}`
      );
      return insertId;
    } catch (error) {
      logger.error("Error creating background job:", error);
      throw new CustomError("Failed to create background job", 500);
    }
  }

  /**
   * Enhanced energy monitoring with background processing capabilities
   */
  private async testEnergyMonitoringEnhanced(
    buildingId: number,
    testData: any
  ): Promise<EnhancedMonitoringTestResult> {
    const startTime = Date.now();
    const alerts: any[] = [];
    const backgroundJobs: BackgroundJobInfo[] = [];

    try {
      // Original energy tests
      if (testData.consumption_kwh > 1000) {
        alerts.push({
          type: "energy_anomaly",
          severity: "high",
          message: `High consumption detected: ${testData.consumption_kwh} kWh`,
        });
      }

      if (testData.power_factor && testData.power_factor < 0.85) {
        alerts.push({
          type: "threshold_exceeded",
          severity: testData.power_factor < 0.8 ? "critical" : "medium",
          message: `Low power factor: ${testData.power_factor}`,
        });
      }

      // 🔧 ENHANCEMENT: Anomaly Detection Background Job
      if (testData.enable_anomaly_detection) {
        const anomalyJobId = await this.createBackgroundJob(
          "anomaly_detection",
          buildingId,
          {
            analysis_type: "energy_consumption",
            lookback_days: 30,
            anomaly_threshold: 2.0,
            baseline_method: "seasonal",
          }
        );
        backgroundJobs.push({
          type: "anomaly_detection",
          job_id: anomalyJobId,
        });
      }

      // 🔧 ENHANCEMENT: Efficiency Analysis Background Job
      if (testData.enable_efficiency_analysis) {
        const efficiencyJobId = await this.createBackgroundJob(
          "efficiency_analysis",
          buildingId,
          {
            analysis_type: "comprehensive",
            include_weather_normalization: true,
            include_occupancy_adjustment: true,
            benchmark_buildings: true,
          }
        );
        backgroundJobs.push({
          type: "efficiency_analysis",
          job_id: efficiencyJobId,
        });
      }

      // Enhanced baseline comparison
      const baseline = await this.getEnergyBaseline(buildingId, "monthly");
      const baselineDeviation = baseline
        ? Math.abs(
            ((testData.consumption_kwh - baseline.baseline_consumption) /
              baseline.baseline_consumption) *
              100
          )
        : 0;

      if (baselineDeviation > 20) {
        alerts.push({
          type: "energy_anomaly",
          severity: baselineDeviation > 50 ? "critical" : "high",
          message: `Consumption deviates ${baselineDeviation.toFixed(1)}% from baseline`,
        });
      }

      return {
        success: true,
        alerts_generated: alerts.length,
        processing_time: Date.now() - startTime,
        test_results: {
          consumption_check: testData.consumption_kwh <= 1000,
          power_factor_check:
            !testData.power_factor || testData.power_factor >= 0.85,
          demand_check: !testData.demand_kw || testData.demand_kw <= 500,
          baseline_deviation: baselineDeviation,
          baseline_status: baselineDeviation <= 20 ? "normal" : "anomaly",
        },
        alerts,
        background_jobs: backgroundJobs,
        baseline_info: baseline,
        compliance_status: alerts.length === 0 ? "compliant" : "non_compliant",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processing_time: Date.now() - startTime,
        background_jobs: backgroundJobs,
        alerts_generated: alerts.length,
        test_results: {},
        alerts,
        compliance_status: "non_compliant",
      };
    }
  }

  /**
   * Enhanced power quality monitoring with PQ events tracking
   */
  private async testPowerQualityMonitoringEnhanced(
    buildingId: number,
    testData: any
  ): Promise<EnhancedMonitoringTestResult> {
    const startTime = Date.now();
    const alerts: any[] = [];
    const pqEvents: PowerQualityEventInfo[] = [];

    try {
      // Original PQ tests
      const voltages = [
        testData.voltage_l1,
        testData.voltage_l2,
        testData.voltage_l3,
      ].filter((v) => v !== undefined);
      for (let i = 0; i < voltages.length; i++) {
        const voltage = voltages[i];
        if (voltage < 207 || voltage > 253) {
          const severity =
            Math.abs(voltage - 230) / 230 > 0.15 ? "critical" : "high";
          alerts.push({
            type: "power_quality",
            severity,
            message: `Voltage out of range on L${i + 1}: ${voltage}V`,
          });

          // 🔧 ENHANCEMENT 2: Create Power Quality Event
          const estimatedCost = this.calculatePQEventCost(
            severity,
            testData.affected_equipment?.length || 0
          );
          const pqEventId = await this.createPowerQualityEvent(buildingId, {
            event_type: voltage < 207 ? "sag" : "swell",
            severity: severity === "critical" ? "critical" : "severe",
            magnitude: Math.abs(voltage - 230),
            itic_curve_violation: Math.abs(voltage - 230) / 230 > 0.1,
            ieee519_violation: false,
            affected_equipment: testData.affected_equipment || [],
            estimated_cost: estimatedCost,
          });
          pqEvents.push({
            event_id: pqEventId,
            type: "voltage_deviation",
            phase: `L${i + 1}`,
            estimated_cost: estimatedCost,
          });
        }
      }

      // Enhanced THD analysis with IEEE 519 compliance
      if (testData.thd_voltage && testData.thd_voltage > 8) {
        const severity = testData.thd_voltage > 12 ? "critical" : "high";
        alerts.push({
          type: "power_quality",
          severity,
          message: `High voltage THD: ${testData.thd_voltage}%`,
        });

        // Create harmonic distortion event
        const harmonicCost = this.calculateHarmonicCost(testData.thd_voltage);
        const thdEventId = await this.createPowerQualityEvent(buildingId, {
          event_type: "harmonic",
          severity: severity === "critical" ? "critical" : "severe",
          magnitude: testData.thd_voltage,
          itic_curve_violation: false,
          ieee519_violation: testData.thd_voltage > 8,
          affected_equipment: testData.sensitive_equipment || [],
          estimated_cost: harmonicCost,
        });
        pqEvents.push({
          event_id: thdEventId,
          type: "harmonic_distortion",
          estimated_cost: harmonicCost,
        });
      }

      // Enhanced frequency stability analysis
      if (
        testData.frequency &&
        (testData.frequency < 49.5 || testData.frequency > 50.5)
      ) {
        alerts.push({
          type: "power_quality",
          severity: "critical",
          message: `Frequency deviation: ${testData.frequency} Hz`,
        });

        // Create frequency event
        const frequencyCost = this.calculateFrequencyEventCost();
        const freqEventId = await this.createPowerQualityEvent(buildingId, {
          event_type: "frequency_deviation",
          severity: "critical",
          magnitude: Math.abs(testData.frequency - 50),
          itic_curve_violation: true,
          ieee519_violation: true,
          affected_equipment: ["all_equipment"],
          estimated_cost: frequencyCost,
        });
        pqEvents.push({
          event_id: freqEventId,
          type: "frequency_deviation",
          estimated_cost: frequencyCost,
        });
      }

      // 🔧 ENHANCEMENT: Power Quality Trend Analysis
      const pqTrends = await this.analyzePowerQualityTrends(buildingId);

      return {
        success: true,
        alerts_generated: alerts.length,
        processing_time: Date.now() - startTime,
        test_results: {
          voltage_check: voltages.every((v) => v >= 207 && v <= 253),
          thd_check: !testData.thd_voltage || testData.thd_voltage <= 8,
          frequency_check:
            !testData.frequency ||
            (testData.frequency >= 49.5 && testData.frequency <= 50.5),
          ieee519_compliance: this.checkIEEE519Compliance(testData),
          itic_curve_compliance: this.checkITICCompliance(testData, voltages),
        },
        alerts,
        power_quality_events: pqEvents,
        trends_analysis: pqTrends,
        compliance_status: alerts.length === 0 ? "compliant" : "non_compliant",
        cost_impact: pqEvents.reduce(
          (sum, event) => sum + (event.estimated_cost || 0),
          0
        ),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processing_time: Date.now() - startTime,
        power_quality_events: pqEvents,
        alerts_generated: alerts.length,
        test_results: {},
        alerts,
        compliance_status: "non_compliant",
      };
    }
  }

  /**
   * Enhanced equipment monitoring with maintenance predictions
   */
  private async testEquipmentMonitoringEnhanced(
    buildingId: number,
    testData: any
  ): Promise<EnhancedMonitoringTestResult> {
    const startTime = Date.now();
    const alerts: any[] = [];
    const maintenancePredictions: MaintenancePredictionInfo[] = [];

    try {
      // Original equipment tests
      if (testData.status === "faulty") {
        alerts.push({
          type: "equipment_failure",
          severity: "critical",
          message: `Equipment failure detected: ${testData.name || "Unknown equipment"}`,
        });
      }

      if (testData.maintenance_overdue) {
        alerts.push({
          type: "maintenance_due",
          severity: "high",
          message: `Maintenance overdue for equipment: ${testData.name || "Unknown equipment"}`,
        });
      }

      // 🔧 ENHANCEMENT 3: Maintenance Predictions Integration
      if (testData.equipment_id) {
        const prediction = await this.generateMaintenancePrediction(
          testData.equipment_id,
          testData
        );
        if (prediction) {
          maintenancePredictions.push(prediction);

          // Create alert if high risk predicted
          if (
            prediction.risk_level === "critical" ||
            prediction.risk_level === "high"
          ) {
            alerts.push({
              type: "maintenance_due",
              severity:
                prediction.risk_level === "critical" ? "critical" : "high",
              message: `Predictive maintenance alert: ${prediction.prediction_type} predicted for ${prediction.predicted_date}`,
            });
          }
        }
      }

      // Enhanced temperature and vibration analysis
      if (testData.temperature && testData.temperature > 80) {
        alerts.push({
          type: "equipment_failure",
          severity: testData.temperature > 100 ? "critical" : "high",
          message: `High equipment temperature: ${testData.temperature}°C`,
        });
      }

      if (testData.vibration_level && testData.vibration_level > 7.1) {
        alerts.push({
          type: "equipment_failure",
          severity: "medium",
          message: `High vibration detected: ${testData.vibration_level} mm/s RMS`,
        });
      }

      // 🔧 ENHANCEMENT: Equipment Performance Trending
      const performanceTrends = await this.analyzeEquipmentPerformance(
        buildingId,
        testData.equipment_id
      );

      // 🔧 ENHANCEMENT: Energy Efficiency Impact Assessment
      const efficiencyImpact =
        await this.assessEquipmentEfficiencyImpact(testData);

      return {
        success: true,
        alerts_generated: alerts.length,
        processing_time: Date.now() - startTime,
        test_results: {
          status_check: testData.status !== "faulty",
          maintenance_check: !testData.maintenance_overdue,
          temperature_check:
            !testData.temperature || testData.temperature <= 80,
          vibration_check:
            !testData.vibration_level || testData.vibration_level <= 7.1,
          performance_score: this.calculateEquipmentPerformanceScore(testData),
        },
        alerts,
        maintenance_predictions: maintenancePredictions,
        performance_trends: performanceTrends,
        efficiency_impact: efficiencyImpact,
        compliance_status: alerts.length === 0 ? "compliant" : "non_compliant",
        recommended_actions: this.generateMaintenanceRecommendations(
          testData,
          maintenancePredictions
        ),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processing_time: Date.now() - startTime,
        maintenance_predictions: maintenancePredictions,
        alerts_generated: alerts.length,
        test_results: {},
        alerts,
        compliance_status: "non_compliant",
      };
    }
  }

  // 🔧 ENHANCEMENT 2: Power Quality Events Helper Methods

  /**
   * Create detailed power quality event record
   */
  private async createPowerQualityEvent(
    buildingId: number,
    eventData: any
  ): Promise<number> {
    try {
      // First insert a dummy PQ reading if not provided
      let pqReadingId = eventData.pq_reading_id;
      if (!pqReadingId) {
        const pqInsertId = await database.insert(
          `INSERT INTO power_quality (building_id, recorded_at) VALUES (?, NOW())`,
          [buildingId]
        );
        pqReadingId = pqInsertId;
      }

      const insertQuery = `
        INSERT INTO power_quality_events 
        (building_id, pq_reading_id, event_type, severity, start_time, end_time, 
         duration_ms, magnitude, itic_curve_violation, ieee519_violation, 
         affected_equipment, estimated_cost, metadata) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const startTime = new Date();
      const endTime = eventData.duration_ms
        ? new Date(startTime.getTime() + eventData.duration_ms)
        : startTime;

      const insertId = await database.insert(insertQuery, [
        buildingId,
        pqReadingId,
        eventData.event_type,
        eventData.severity,
        startTime,
        endTime,
        eventData.duration_ms || 0,
        eventData.magnitude || 0,
        eventData.itic_curve_violation || false,
        eventData.ieee519_violation || false,
        JSON.stringify(eventData.affected_equipment || []),
        eventData.estimated_cost || 0,
        JSON.stringify({
          test_generated: true,
          analysis_timestamp: new Date(),
          event_source: "monitoring_test",
        }),
      ]);

      logger.info(
        `Power quality event created: ${insertId} for building ${buildingId}`
      );
      return insertId;
    } catch (error) {
      logger.error("Error creating power quality event:", error);
      throw new CustomError("Failed to create power quality event", 500);
    }
  }

  /**
   * Calculate estimated cost for power quality events
   */
  private calculatePQEventCost(
    severity: string,
    affectedEquipmentCount: number
  ): number {
    const baseCosts = {
      minor: 500,
      moderate: 2000,
      severe: 10000,
      critical: 50000,
    };

    const baseCost = baseCosts[severity as keyof typeof baseCosts] || 1000;
    const equipmentMultiplier = Math.max(1, affectedEquipmentCount * 0.5);

    return Math.round(baseCost * equipmentMultiplier);
  }

  /**
   * Calculate cost impact of harmonic distortion
   */
  private calculateHarmonicCost(thdVoltage: number): number {
    if (thdVoltage <= 5) return 0;
    if (thdVoltage <= 8) return 1500;
    if (thdVoltage <= 12) return 5000;
    return 15000; // Critical THD levels
  }

  /**
   * Calculate cost impact of frequency events
   */
  private calculateFrequencyEventCost(): number {
    return 25000; // Frequency events typically affect all equipment
  }

  /**
   * Check IEEE 519 compliance
   */
  private checkIEEE519Compliance(testData: any): boolean {
    const thdVoltageCompliant =
      !testData.thd_voltage || testData.thd_voltage <= 8.0;
    const thdCurrentCompliant =
      !testData.thd_current || testData.thd_current <= 15.0;
    const frequencyCompliant =
      !testData.frequency ||
      (testData.frequency >= 49.5 && testData.frequency <= 50.5);

    return thdVoltageCompliant && thdCurrentCompliant && frequencyCompliant;
  }

  /**
   * Check ITIC curve compliance
   */
  private checkITICCompliance(testData: any, voltages: number[]): boolean {
    // ITIC curve - simplified check for voltage tolerance
    const nominalVoltage = 230;
    const voltageCompliant = voltages.every((voltage) => {
      const deviation = Math.abs(voltage - nominalVoltage) / nominalVoltage;
      return deviation <= 0.1; // ±10% tolerance
    });

    return voltageCompliant;
  }

  /**
   * Analyze power quality trends
   */
  private async analyzePowerQualityTrends(buildingId: number): Promise<any> {
    try {
      const trends = await database.query(
        `
        SELECT 
          DATE(recorded_at) as date,
          AVG(thd_voltage) as avg_thd_voltage,
          AVG(voltage_unbalance) as avg_voltage_unbalance,
          COUNT(*) as readings_count,
          MAX(thd_voltage) as max_thd_voltage
        FROM power_quality 
        WHERE building_id = ? 
        AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(recorded_at)
        ORDER BY date DESC
        LIMIT 30
      `,
        [buildingId]
      );

      const eventCounts = await database.query(
        `
        SELECT 
          event_type,
          COUNT(*) as event_count,
          AVG(magnitude) as avg_magnitude
        FROM power_quality_events 
        WHERE building_id = ?
        AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY event_type
      `,
        [buildingId]
      );

      return {
        daily_trends: trends,
        event_summary: eventCounts,
        trend_analysis: {
          deteriorating: trends.length > 0 && trends[0].max_thd_voltage > 8,
          stable:
            trends.length > 5 &&
            Math.abs(trends[0].avg_thd_voltage - trends[4].avg_thd_voltage) < 1,
          improving:
            trends.length > 1 &&
            trends[0].avg_thd_voltage < trends[1].avg_thd_voltage,
        },
      };
    } catch (error) {
      logger.error("Error analyzing PQ trends:", error);
      return { error: "Failed to analyze trends" };
    }
  }

  // 🔧 ENHANCEMENT 3: Maintenance Predictions Helper Methods

  /**
   * Generate maintenance prediction for equipment
   */
  private async generateMaintenancePrediction(
    equipmentId: number,
    testData: any
  ): Promise<MaintenancePredictionInfo | null> {
    try {
      // Get equipment information
      const equipment = await database.queryOne(
        "SELECT * FROM equipment WHERE id = ?",
        [equipmentId]
      );

      if (!equipment) {
        return null;
      }

      // Calculate risk factors
      const riskFactors = this.calculateRiskFactors(equipment, testData);

      // Determine prediction type and date
      const predictionType = this.determinePredictionType(riskFactors);
      const predictedDate = this.calculatePredictedDate(equipment, riskFactors);
      const confidenceScore = this.calculateConfidenceScore(riskFactors);
      const riskLevel = this.determineRiskLevel(riskFactors, predictedDate);

      // Generate recommendations
      const recommendations = this.generateMaintenanceRecommendations(
        testData,
        []
      );

      // Insert maintenance prediction
      const insertQuery = `
        INSERT INTO maintenance_predictions 
        (equipment_id, prediction_type, predicted_date, confidence_score, risk_level,
         contributing_factors, recommended_actions, estimated_cost, model_version, last_calculated, metadata) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `;

      const estimatedCost = this.estimateMaintenanceCost(
        equipment,
        predictionType
      );

      const insertId = await database.insert(insertQuery, [
        equipmentId,
        predictionType,
        predictedDate,
        confidenceScore,
        riskLevel,
        JSON.stringify(riskFactors.factors),
        JSON.stringify(recommendations),
        estimatedCost,
        "v2.0-enhanced",
        JSON.stringify({
          test_data_source: true,
          calculation_method: "enhanced_algorithm",
          factors_considered: Object.keys(riskFactors.factors),
        }),
      ]);

      return {
        prediction_id: insertId,
        equipment_id: equipmentId,
        equipment_name: equipment.name,
        prediction_type: predictionType,
        predicted_date: predictedDate,
        confidence_score: confidenceScore,
        risk_level: riskLevel,
        contributing_factors: riskFactors.factors,
        recommended_actions: recommendations,
        estimated_cost: estimatedCost,
        days_until_action: Math.ceil(
          (new Date(predictedDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        ),
      };
    } catch (error) {
      logger.error("Error generating maintenance prediction:", error);
      return null;
    }
  }

  /**
   * Calculate equipment risk factors
   */
  private calculateRiskFactors(equipment: any, testData: any): any {
    const factors: Record<string, number> = {};
    let totalRisk = 0;

    // Age factor
    if (equipment.installation_date) {
      const ageYears =
        (Date.now() - new Date(equipment.installation_date).getTime()) /
        (1000 * 60 * 60 * 24 * 365);
      factors.age_risk = Math.min(ageYears / 15, 1); // 15 years expected life
      totalRisk += factors.age_risk * 0.3;
    }

    // Temperature factor
    if (testData.temperature) {
      factors.temperature_risk = Math.max(0, (testData.temperature - 70) / 30); // Risk starts at 70°C
      totalRisk += factors.temperature_risk * 0.25;
    }

    // Vibration factor
    if (testData.vibration_level) {
      factors.vibration_risk = Math.max(
        0,
        (testData.vibration_level - 4.5) / 10
      ); // ISO 10816 standards
      totalRisk += factors.vibration_risk * 0.2;
    }

    // Operating hours factor
    if (testData.operating_hours) {
      const expectedHours = 8760; // Hours per year
      factors.usage_risk = Math.min(
        testData.operating_hours / (expectedHours * 10),
        1
      );
      totalRisk += factors.usage_risk * 0.15;
    }

    // Maintenance history factor
    if (testData.last_maintenance_days) {
      const maintenanceIntervals = {
        weekly: 7,
        monthly: 30,
        quarterly: 90,
        annually: 365,
      };
      const expectedInterval =
        maintenanceIntervals[
          equipment.maintenance_schedule as keyof typeof maintenanceIntervals
        ] || 90;
      factors.maintenance_overdue_risk = Math.max(
        0,
        (testData.last_maintenance_days - expectedInterval) / expectedInterval
      );
      totalRisk += factors.maintenance_overdue_risk * 0.1;
    }

    return {
      factors,
      total_risk: Math.min(totalRisk, 1),
      severity:
        totalRisk > 0.8
          ? "critical"
          : totalRisk > 0.6
            ? "high"
            : totalRisk > 0.3
              ? "medium"
              : "low",
    };
  }

  /**
   * Determine prediction type based on risk factors
   */
  private determinePredictionType(riskFactors: any): string {
    if (riskFactors.total_risk > 0.8) return "failure";
    if (riskFactors.total_risk > 0.4) return "maintenance";
    return "replacement";
  }

  /**
   * Calculate predicted maintenance date
   */
  private calculatePredictedDate(equipment: any, riskFactors: any): string {
    const baseTime = Date.now();
    const riskMultiplier = 1 - riskFactors.total_risk;

    // Base intervals in days
    const intervals = {
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      annually: 365,
    };

    const baseInterval =
      intervals[equipment.maintenance_schedule as keyof typeof intervals] || 90;
    const predictedDays = Math.max(
      1,
      Math.round(baseInterval * riskMultiplier)
    );

    const predictedDate = new Date(
      baseTime + predictedDays * 24 * 60 * 60 * 1000
    );
    return predictedDate.toISOString().split("T")[0]; // Return date only
  }

  /**
   * Calculate confidence score for prediction
   */
  private calculateConfidenceScore(riskFactors: any): number {
    const factorCount = Object.keys(riskFactors.factors).length;
    const dataQuality = Math.min(factorCount / 5, 1); // 5 factors = 100% confidence
    const algorithmConfidence = 0.85; // Base algorithm confidence

    return Math.round(dataQuality * algorithmConfidence * 100);
  }

  /**
   * Determine risk level based on factors and timing
   */
  private determineRiskLevel(riskFactors: any, predictedDate: string): string {
    const daysUntil = Math.ceil(
      (new Date(predictedDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (riskFactors.total_risk > 0.8 || daysUntil <= 7) return "critical";
    if (riskFactors.total_risk > 0.6 || daysUntil <= 30) return "high";
    if (riskFactors.total_risk > 0.3 || daysUntil <= 90) return "medium";
    return "low";
  }

  /**
   * Generate maintenance recommendations
   */
  private generateMaintenanceRecommendations(
    testData: any,
    predictions: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (testData.temperature && testData.temperature > 80) {
      recommendations.push("Inspect cooling systems and clean heat exchangers");
      recommendations.push("Check for blocked air vents and clean filters");
    }

    if (testData.vibration_level && testData.vibration_level > 7.1) {
      recommendations.push(
        "Perform vibration analysis and balance rotating components"
      );
      recommendations.push("Check and tighten mechanical connections");
    }

    if (testData.status === "faulty") {
      recommendations.push("Immediate inspection and repair required");
      recommendations.push("Implement temporary safety measures");
    }

    if (testData.maintenance_overdue) {
      recommendations.push("Schedule overdue maintenance immediately");
      recommendations.push(
        "Update maintenance schedule to prevent future delays"
      );
    }

    // Default recommendations if none specific
    if (recommendations.length === 0) {
      recommendations.push("Continue regular maintenance schedule");
      recommendations.push("Monitor equipment performance trends");
    }

    return recommendations;
  }

  /**
   * Estimate maintenance cost
   */
  private estimateMaintenanceCost(
    equipment: any,
    predictionType: string
  ): number {
    const baseCosts = {
      maintenance: 2000,
      failure: 15000,
      replacement: 50000,
    };

    const equipmentMultipliers = {
      hvac: 2.0,
      generator: 3.0,
      transformer: 4.0,
      motor: 1.5,
      ups: 2.5,
      panel: 1.0,
      lighting: 0.5,
      others: 1.0,
    };

    const baseCost =
      baseCosts[predictionType as keyof typeof baseCosts] || 5000;
    const multiplier =
      equipmentMultipliers[
        equipment.equipment_type as keyof typeof equipmentMultipliers
      ] || 1.0;
    const powerRatingMultiplier = equipment.power_rating_kw
      ? Math.sqrt(equipment.power_rating_kw / 100)
      : 1;

    return Math.round(baseCost * multiplier * powerRatingMultiplier);
  }

  /**
   * Analyze equipment performance trends
   */
  private async analyzeEquipmentPerformance(
    buildingId: number,
    equipmentId?: number
  ): Promise<any> {
    try {
      if (!equipmentId)
        return { message: "No equipment ID provided for performance analysis" };

      // Get recent maintenance history
      const maintenanceHistory = await database.query(
        `
        SELECT 
          DATE(completed_date) as date,
          maintenance_type,
          cost,
          downtime_minutes,
          description
        FROM equipment_maintenance 
        WHERE equipment_id = ? 
        AND completed_date IS NOT NULL
        AND completed_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
        ORDER BY completed_date DESC
      `,
        [equipmentId]
      );

      // Get alert history for this equipment
      const alertHistory = await database.query(
        `
        SELECT 
          DATE(created_at) as date,
          type,
          severity,
          COUNT(*) as alert_count
        FROM alerts 
        WHERE equipment_id = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY DATE(created_at), type, severity
        ORDER BY date DESC
      `,
        [equipmentId]
      );

      return {
        maintenance_history: maintenanceHistory,
        alert_trends: alertHistory,
        performance_score: this.calculateEquipmentPerformanceScore({
          maintenance_count: maintenanceHistory.length,
          alert_count: alertHistory.reduce(
            (sum, alert) => sum + alert.alert_count,
            0
          ),
          downtime_hours:
            maintenanceHistory.reduce(
              (sum, maint) => sum + (maint.downtime_minutes || 0),
              0
            ) / 60,
        }),
        reliability_trend:
          maintenanceHistory.length > 2
            ? maintenanceHistory[0].downtime_minutes <
              maintenanceHistory[1].downtime_minutes
              ? "improving"
              : "declining"
            : "insufficient_data",
      };
    } catch (error) {
      logger.error("Error analyzing equipment performance:", error);
      return { error: "Failed to analyze performance" };
    }
  }

  /**
   * Assess equipment efficiency impact
   */
  private async assessEquipmentEfficiencyImpact(testData: any): Promise<any> {
    try {
      let efficiencyImpact = 100; // Start with 100% efficiency

      // Temperature impact
      if (testData.temperature) {
        if (testData.temperature > 80) efficiencyImpact -= 15;
        else if (testData.temperature > 70) efficiencyImpact -= 5;
      }

      // Vibration impact
      if (testData.vibration_level && testData.vibration_level > 7.1) {
        efficiencyImpact -= 10;
      }

      // Status impact
      if (testData.status === "faulty") efficiencyImpact = 0;
      else if (testData.status === "maintenance") efficiencyImpact -= 20;

      // Maintenance overdue impact
      if (testData.maintenance_overdue) efficiencyImpact -= 25;

      efficiencyImpact = Math.max(0, efficiencyImpact);

      return {
        current_efficiency_percentage: efficiencyImpact,
        efficiency_category:
          efficiencyImpact >= 90
            ? "excellent"
            : efficiencyImpact >= 75
              ? "good"
              : efficiencyImpact >= 50
                ? "fair"
                : "poor",
        estimated_energy_waste_percentage: Math.max(0, 100 - efficiencyImpact),
        annual_cost_impact: this.calculateAnnualCostImpact(
          efficiencyImpact,
          testData.power_rating_kw
        ),
        improvement_potential: 100 - efficiencyImpact,
      };
    } catch (error) {
      logger.error("Error assessing efficiency impact:", error);
      return { error: "Failed to assess efficiency impact" };
    }
  }

  /**
   * Calculate equipment performance score
   */
  private calculateEquipmentPerformanceScore(data: any): number {
    let score = 100;

    // Deduct points for maintenance frequency
    if (data.maintenance_count > 6)
      score -= 30; // More than 6 maintenance in a year
    else if (data.maintenance_count > 3) score -= 15;

    // Deduct points for alerts
    if (data.alert_count > 10) score -= 25;
    else if (data.alert_count > 5) score -= 10;

    // Deduct points for downtime
    if (data.downtime_hours > 48)
      score -= 20; // More than 48 hours downtime
    else if (data.downtime_hours > 24) score -= 10;

    return Math.max(0, score);
  }

  /**
   * Calculate annual cost impact of efficiency loss
   */
  private calculateAnnualCostImpact(
    efficiencyPercentage: number,
    powerRatingKw?: number
  ): number {
    if (!powerRatingKw) return 0;

    const efficiencyLoss = (100 - efficiencyPercentage) / 100;
    const annualOperatingHours = 8760; // Assume continuous operation
    const energyRate = 12.0; // PHP per kWh (average Philippines rate)

    const wastedEnergyKwh =
      powerRatingKw * annualOperatingHours * efficiencyLoss;
    const annualCostImpact = wastedEnergyKwh * energyRate;

    return Math.round(annualCostImpact);
  }

  /**
   * Get energy baseline for comparison
   */
  private async getEnergyBaseline(
    buildingId: number,
    baselineType: string
  ): Promise<any> {
    try {
      const baseline = await database.queryOne(
        `
        SELECT * FROM energy_baselines 
        WHERE building_id = ? AND baseline_type = ?
        ORDER BY created_at DESC 
        LIMIT 1
      `,
        [buildingId, baselineType]
      );

      return baseline;
    } catch (error) {
      logger.error("Error getting energy baseline:", error);
      return null;
    }
  }
}

export default new AlertController();
