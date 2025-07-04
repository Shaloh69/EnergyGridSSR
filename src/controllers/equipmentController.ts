import { Request, Response } from "express";
import {
  IEquipment,
  IEquipmentDetailed,
  IEquipmentCreate,
  IEquipmentUpdate,
} from "@/interfaces/IEquipment";
import { ApiResponse } from "@/interfaces/IResponse";
import {
  PaginatedResponse,
  PaginationQuery,
  FilterQuery,
} from "@/types/common";
import { database } from "@/config/database";
import { socketManager } from "@/config/socket";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";
import { generateQRCode } from "@/utils/helpers";

interface EquipmentQuery extends PaginationQuery, FilterQuery {
  buildingId?: string;
  equipmentType?: string;
  status?: string;
}

interface MaintenanceQuery {
  upcoming?: string;
  overdue?: string;
}

class EquipmentController {
  /**
   * Helper method to safely parse string to number
   */
  private parseToNumber(value: string | undefined): number | undefined {
    if (!value || typeof value !== "string") return undefined;
    const trimmed = value.trim();
    const parsed = parseInt(trimmed);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Helper method to safely trim string
   */
  private safelyTrimString(value: string | undefined): string | undefined {
    if (!value || typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  public getEquipment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Starting getEquipment request");

      const {
        page = 1,
        limit = 20,
        sortBy = "name",
        sortOrder = "ASC",
        buildingId,
        equipmentType,
        status,
        search,
      } = req.query as EquipmentQuery;

      // Parse and validate pagination
      const pageNum = Math.max(1, parseInt(page.toString()) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit.toString()) || 20)
      );
      const offset = (pageNum - 1) * limitNum;

      // Validate sortBy
      const allowedSortFields = [
        "name",
        "equipment_type",
        "status",
        "power_rating_kw",
        "installation_date",
        "maintenance_schedule",
        "location",
        "created_at",
        "updated_at",
      ];
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "name";
      const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

      try {
        // Build WHERE conditions with proper parameterization
        const conditions: string[] = [];
        const params: any[] = [];

        // Fixed: Use parseToNumber helper method
        const parsedBuildingId = this.parseToNumber(buildingId);
        if (parsedBuildingId !== undefined) {
          conditions.push("e.building_id = ?");
          params.push(parsedBuildingId);
        }

        const trimmedEquipmentType = this.safelyTrimString(equipmentType);
        if (trimmedEquipmentType !== undefined) {
          conditions.push("e.equipment_type = ?");
          params.push(trimmedEquipmentType);
        }

        const trimmedStatus = this.safelyTrimString(status);
        if (trimmedStatus !== undefined) {
          conditions.push("e.status = ?");
          params.push(trimmedStatus);
        }

        const trimmedSearch = this.safelyTrimString(search);
        if (trimmedSearch !== undefined) {
          conditions.push(
            "(e.name LIKE ? OR e.model LIKE ? OR e.manufacturer LIKE ? OR e.location LIKE ? OR e.qr_code LIKE ?)"
          );
          const searchPattern = `%${trimmedSearch}%`;
          params.push(
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern
          );
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as total FROM equipment e ${whereClause}`;
        const countResult = await database.queryOne<{ total: number }>(
          countQuery,
          params
        );
        const totalItems = countResult?.total || 0;

        // Get equipment data with enhanced information
        const dataQuery = `
          SELECT 
            e.*,
            b.name as building_name,
            b.code as building_code,
            b.building_type,
            CASE 
              WHEN e.installation_date IS NOT NULL 
              THEN TIMESTAMPDIFF(YEAR, e.installation_date, CURDATE())
              ELSE NULL
            END as age_years,
            CASE 
              WHEN e.maintenance_schedule = 'weekly' THEN 7
              WHEN e.maintenance_schedule = 'monthly' THEN 30
              WHEN e.maintenance_schedule = 'quarterly' THEN 90
              WHEN e.maintenance_schedule = 'annually' THEN 365
              ELSE 30
            END as maintenance_interval_days,
            em_next.scheduled_date as next_maintenance_date,
            em_last.completed_date as last_maintenance_date,
            mp.predicted_date as predicted_maintenance_date,
            mp.risk_level as maintenance_risk_level,
            alert_count.active_alerts
          FROM equipment e
          LEFT JOIN buildings b ON e.building_id = b.id
          LEFT JOIN (
            SELECT equipment_id, MIN(scheduled_date) as scheduled_date
            FROM equipment_maintenance 
            WHERE status = 'scheduled' AND scheduled_date >= CURDATE()
            GROUP BY equipment_id
          ) em_next ON e.id = em_next.equipment_id
          LEFT JOIN (
            SELECT equipment_id, MAX(completed_date) as completed_date
            FROM equipment_maintenance 
            WHERE status = 'completed'
            GROUP BY equipment_id
          ) em_last ON e.id = em_last.equipment_id
          LEFT JOIN (
            SELECT equipment_id, predicted_date, risk_level,
                   ROW_NUMBER() OVER (PARTITION BY equipment_id ORDER BY created_at DESC) as rn
            FROM maintenance_predictions
          ) mp ON e.id = mp.equipment_id AND mp.rn = 1
          LEFT JOIN (
            SELECT equipment_id, COUNT(*) as active_alerts
            FROM alerts 
            WHERE status = 'active'
            GROUP BY equipment_id
          ) alert_count ON e.id = alert_count.equipment_id
          ${whereClause}
          ORDER BY e.${safeSortBy} ${safeSortOrder}
          LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limitNum, offset];
        const equipment = await database.query<IEquipmentDetailed>(
          dataQuery,
          dataParams
        );

        // Enhance equipment with additional statistics
        const enhancedEquipment =
          await this.enhanceEquipmentWithStats(equipment);

        // Build response
        const totalPages = Math.ceil(totalItems / limitNum);

        const response: ApiResponse<PaginatedResponse<IEquipmentDetailed>> = {
          success: true,
          message: "Equipment fetched successfully",
          data: {
            data: enhancedEquipment,
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

        logger.info(
          `Successfully returned ${enhancedEquipment.length} equipment items`
        );
        res.json(response);
      } catch (error) {
        logger.error("Error fetching equipment:", error);
        throw new CustomError("Failed to fetch equipment", 500);
      }
    }
  );

  public getEquipmentById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Getting equipment by ID:", id);

      // Fixed: Use parseToNumber helper method
      const equipmentId = this.parseToNumber(id);
      if (equipmentId === undefined) {
        throw new CustomError("Invalid equipment ID", 400);
      }

      try {
        const equipment = await database.queryOne<IEquipmentDetailed>(
          `SELECT 
            e.*,
            b.name as building_name,
            b.code as building_code,
            b.building_type,
            b.area_sqm as building_area,
            CASE 
              WHEN e.installation_date IS NOT NULL 
              THEN TIMESTAMPDIFF(YEAR, e.installation_date, CURDATE())
              ELSE NULL
            END as age_years
          FROM equipment e
          LEFT JOIN buildings b ON e.building_id = b.id
          WHERE e.id = ?`,
          [equipmentId]
        );

        if (!equipment) {
          throw new CustomError("Equipment not found", 404);
        }

        // Get maintenance history
        const maintenanceHistory = await database.query(
          `SELECT 
            em.*,
            u.first_name as technician_first_name,
            u.last_name as technician_last_name,
            CONCAT(u.first_name, ' ', u.last_name) as technician_name
          FROM equipment_maintenance em
          LEFT JOIN users u ON em.technician_id = u.id
          WHERE em.equipment_id = ?
          ORDER BY em.scheduled_date DESC
          LIMIT 10`,
          [equipmentId]
        );

        // Get maintenance predictions
        const maintenancePredictions = await database.query(
          `SELECT *
          FROM maintenance_predictions
          WHERE equipment_id = ?
          ORDER BY created_at DESC
          LIMIT 5`,
          [equipmentId]
        );

        // Get related alerts
        const relatedAlerts = await database.query(
          `SELECT 
            a.*,
            TIMESTAMPDIFF(MINUTE, a.created_at, NOW()) as age_minutes
          FROM alerts a
          WHERE a.equipment_id = ? AND a.status = 'active'
          ORDER BY a.created_at DESC
          LIMIT 5`,
          [equipmentId]
        );

        // Get performance metrics
        const performanceMetrics =
          await this.getEquipmentPerformanceMetrics(equipmentId);

        const enhancedEquipment = {
          ...equipment,
          maintenance_history: maintenanceHistory,
          maintenance_predictions: maintenancePredictions,
          related_alerts: relatedAlerts,
          performance_metrics: performanceMetrics,
          health_status: this.calculateHealthStatus(
            equipment,
            relatedAlerts.length
          ),
        };

        const response: ApiResponse<typeof enhancedEquipment> = {
          success: true,
          message: "Equipment fetched successfully",
          data: enhancedEquipment,
        };

        logger.info("Successfully retrieved equipment:", equipment.name);
        res.json(response);
      } catch (error) {
        logger.error("Error fetching equipment by ID:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch equipment", 500);
      }
    }
  );

  public getEquipmentByQR = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { qrCode } = req.params;
      logger.info("🚀 Getting equipment by QR code:", qrCode);

      const trimmedQRCode = this.safelyTrimString(qrCode);
      if (!trimmedQRCode) {
        throw new CustomError("Invalid QR code", 400);
      }

      try {
        const equipment = await database.queryOne<IEquipmentDetailed>(
          `SELECT 
            e.*,
            b.name as building_name,
            b.code as building_code,
            b.building_type
          FROM equipment e
          LEFT JOIN buildings b ON e.building_id = b.id
          WHERE e.qr_code = ?`,
          [trimmedQRCode]
        );

        if (!equipment) {
          throw new CustomError("Equipment not found", 404);
        }

        const response: ApiResponse<IEquipmentDetailed> = {
          success: true,
          message: "Equipment fetched successfully",
          data: equipment,
        };

        logger.info("Successfully retrieved equipment by QR:", equipment.name);
        res.json(response);
      } catch (error) {
        logger.error("Error fetching equipment by QR:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch equipment", 500);
      }
    }
  );

  public createEquipment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const equipmentData = req.body as IEquipmentCreate;
      logger.info("🚀 Creating equipment:", equipmentData.name);

      // Validate required fields
      if (
        !equipmentData.building_id ||
        !equipmentData.name ||
        !equipmentData.equipment_type
      ) {
        throw new CustomError(
          "building_id, name, and equipment_type are required",
          400
        );
      }

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name FROM buildings WHERE id = ? AND status = 'active'",
          [equipmentData.building_id]
        );

        if (!building) {
          throw new CustomError("Building not found or inactive", 404);
        }

        // Generate QR code if not provided
        let qrCode = equipmentData.qr_code;
        if (!qrCode) {
          // Fixed: Generate QR code manually with custom format
          qrCode = `EQ-${equipmentData.building_id}-${Date.now()}`;
        }

        // Check for duplicate QR code
        if (qrCode) {
          const existingEquipment = await database.queryOne(
            "SELECT id FROM equipment WHERE qr_code = ?",
            [qrCode]
          );

          if (existingEquipment) {
            throw new CustomError("QR code already exists", 409);
          }
        }

        // Insert new equipment
        const insertQuery = `
          INSERT INTO equipment 
          (building_id, name, equipment_type, model, manufacturer, power_rating_kw,
           voltage_rating, installation_date, maintenance_schedule, status, 
           location, qr_code, notes) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          equipmentData.building_id,
          equipmentData.name,
          equipmentData.equipment_type,
          equipmentData.model || null,
          equipmentData.manufacturer || null,
          equipmentData.power_rating_kw || null,
          equipmentData.voltage_rating || null,
          equipmentData.installation_date || null,
          equipmentData.maintenance_schedule || "monthly",
          equipmentData.status || "active",
          equipmentData.location || null,
          qrCode,
          equipmentData.notes || null,
        ];

        const insertId = await database.insert(insertQuery, insertParams);
        logger.info("Equipment created with ID:", insertId);

        // Get the created equipment with enhanced information
        const newEquipment = await database.queryOne<IEquipmentDetailed>(
          `SELECT 
            e.*,
            b.name as building_name,
            b.code as building_code
          FROM equipment e
          LEFT JOIN buildings b ON e.building_id = b.id
          WHERE e.id = ?`,
          [insertId]
        );

        if (!newEquipment) {
          throw new CustomError("Failed to retrieve created equipment", 500);
        }

        // Emit real-time update
        socketManager.emitToBuilding(
          equipmentData.building_id.toString(),
          "newEquipment",
          newEquipment
        );

        logger.info(
          `Equipment created for building ${building.name}: ${equipmentData.name}`
        );

        const response: ApiResponse<IEquipmentDetailed> = {
          success: true,
          message: "Equipment created successfully",
          data: newEquipment,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error creating equipment:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to create equipment", 500);
      }
    }
  );

  public updateEquipment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updateData = req.body as IEquipmentUpdate;
      logger.info("🚀 Updating equipment ID:", id);

      // Fixed: Use parseToNumber helper method
      const equipmentId = this.parseToNumber(id);
      if (equipmentId === undefined) {
        throw new CustomError("Invalid equipment ID", 400);
      }

      try {
        // Check if equipment exists
        const existingEquipment = await database.queryOne<IEquipment>(
          "SELECT * FROM equipment WHERE id = ?",
          [equipmentId]
        );

        if (!existingEquipment) {
          throw new CustomError("Equipment not found", 404);
        }

        // Build update query dynamically
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        const allowedFields = [
          "name",
          "equipment_type",
          "model",
          "manufacturer",
          "power_rating_kw",
          "voltage_rating",
          "installation_date",
          "maintenance_schedule",
          "status",
          "location",
          "notes",
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

        // Add equipment ID to parameters
        updateValues.push(equipmentId);

        const updateQuery = `
          UPDATE equipment 
          SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;

        const affectedRows = await database.execute(updateQuery, updateValues);
        logger.info("Update affected rows:", affectedRows);

        if (affectedRows === 0) {
          throw new CustomError("Failed to update equipment", 500);
        }

        // Get updated equipment with enhanced information
        const updatedEquipment = await database.queryOne<IEquipmentDetailed>(
          `SELECT 
            e.*,
            b.name as building_name,
            b.code as building_code
          FROM equipment e
          LEFT JOIN buildings b ON e.building_id = b.id
          WHERE e.id = ?`,
          [equipmentId]
        );

        // Emit real-time update
        socketManager.emitToBuilding(
          existingEquipment.building_id.toString(),
          "equipmentUpdated",
          updatedEquipment
        );

        logger.info(
          `Equipment ${id} updated successfully: ${updateData.name || existingEquipment.name}`
        );

        const response: ApiResponse<IEquipmentDetailed> = {
          success: true,
          message: "Equipment updated successfully",
          data: updatedEquipment!,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error updating equipment:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to update equipment", 500);
      }
    }
  );

  public deleteEquipment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Deleting equipment ID:", id);

      // Fixed: Use parseToNumber helper method
      const equipmentId = this.parseToNumber(id);
      if (equipmentId === undefined) {
        throw new CustomError("Invalid equipment ID", 400);
      }

      try {
        // Check if equipment exists
        const existingEquipment = await database.queryOne<IEquipment>(
          "SELECT * FROM equipment WHERE id = ?",
          [equipmentId]
        );

        if (!existingEquipment) {
          throw new CustomError("Equipment not found", 404);
        }

        // Check for dependent records
        const [alertCount, maintenanceCount] = await Promise.all([
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM alerts WHERE equipment_id = ?",
            [equipmentId]
          ),
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM equipment_maintenance WHERE equipment_id = ?",
            [equipmentId]
          ),
        ]);

        if (
          (alertCount?.count || 0) > 0 ||
          (maintenanceCount?.count || 0) > 0
        ) {
          throw new CustomError(
            "Cannot delete equipment with associated alerts or maintenance records. Consider setting status to 'decommissioned' instead.",
            400
          );
        }

        // Delete equipment
        const affectedRows = await database.execute(
          "DELETE FROM equipment WHERE id = ?",
          [equipmentId]
        );

        if (affectedRows === 0) {
          throw new CustomError("Failed to delete equipment", 500);
        }

        // Emit real-time update
        socketManager.emitToBuilding(
          existingEquipment.building_id.toString(),
          "equipmentDeleted",
          { id: equipmentId, name: existingEquipment.name }
        );

        logger.info(
          `Equipment ${id} (${existingEquipment.name}) deleted successfully`
        );

        const response: ApiResponse = {
          success: true,
          message: "Equipment deleted successfully",
        };

        res.json(response);
      } catch (error) {
        logger.error("Error deleting equipment:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to delete equipment", 500);
      }
    }
  );

  public getMaintenanceSchedule = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      const { upcoming, overdue } = req.query as MaintenanceQuery;
      logger.info("🚀 Getting maintenance schedule for building:", buildingId);

      try {
        const conditions: string[] = ["e.status = 'active'"];
        const params: any[] = [];

        // Fixed: Use parseToNumber and return undefined instead of null
        const parsedBuildingId = this.parseToNumber(buildingId);
        if (parsedBuildingId !== undefined) {
          // Validate building exists
          const building = await database.queryOne(
            "SELECT id, name FROM buildings WHERE id = ?",
            [parsedBuildingId]
          );

          if (!building) {
            throw new CustomError("Building not found", 404);
          }

          conditions.push("e.building_id = ?");
          params.push(parsedBuildingId);
        }

        // Calculate next maintenance date based on schedule and last maintenance
        const scheduleQuery = `
          SELECT 
            e.*,
            b.name as building_name,
            b.code as building_code,
            em_last.completed_date as last_maintenance,
            CASE e.maintenance_schedule
              WHEN 'weekly' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 7 DAY)
              WHEN 'monthly' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 1 MONTH)
              WHEN 'quarterly' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 3 MONTH)
              WHEN 'annually' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 1 YEAR)
            END as next_maintenance_date,
            mp.predicted_date as predicted_maintenance_date,
            mp.risk_level as maintenance_risk_level,
            mp.confidence_score,
            em_scheduled.scheduled_date as scheduled_maintenance_date,
            em_scheduled.status as scheduled_maintenance_status,
            CASE 
              WHEN em_scheduled.scheduled_date < CURDATE() THEN 'overdue'
              WHEN em_scheduled.scheduled_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'due_soon'
              WHEN CASE e.maintenance_schedule
                WHEN 'weekly' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 7 DAY)
                WHEN 'monthly' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 1 MONTH)
                WHEN 'quarterly' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 3 MONTH)
                WHEN 'annually' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 1 YEAR)
              END < CURDATE() THEN 'overdue_by_schedule'
              WHEN CASE e.maintenance_schedule
                WHEN 'weekly' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 7 DAY)
                WHEN 'monthly' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 1 MONTH)
                WHEN 'quarterly' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 3 MONTH)
                WHEN 'annually' THEN DATE_ADD(COALESCE(em_last.completed_date, e.installation_date, CURDATE()), INTERVAL 1 YEAR)
              END <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'due_soon_by_schedule'
              ELSE 'current'
            END as maintenance_status,
            alert_count.active_alerts
          FROM equipment e
          LEFT JOIN buildings b ON e.building_id = b.id
          LEFT JOIN (
            SELECT equipment_id, MAX(completed_date) as completed_date
            FROM equipment_maintenance 
            WHERE status = 'completed'
            GROUP BY equipment_id
          ) em_last ON e.id = em_last.equipment_id
          LEFT JOIN (
            SELECT equipment_id, predicted_date, risk_level, confidence_score,
                   ROW_NUMBER() OVER (PARTITION BY equipment_id ORDER BY created_at DESC) as rn
            FROM maintenance_predictions
          ) mp ON e.id = mp.equipment_id AND mp.rn = 1
          LEFT JOIN (
            SELECT equipment_id, MIN(scheduled_date) as scheduled_date, status
            FROM equipment_maintenance 
            WHERE status = 'scheduled' AND scheduled_date >= CURDATE()
            GROUP BY equipment_id, status
          ) em_scheduled ON e.id = em_scheduled.equipment_id
          LEFT JOIN (
            SELECT equipment_id, COUNT(*) as active_alerts
            FROM alerts 
            WHERE status = 'active'
            GROUP BY equipment_id
          ) alert_count ON e.id = alert_count.equipment_id
          WHERE ${conditions.join(" AND ")}
          ORDER BY 
            FIELD(maintenance_status, 'overdue', 'overdue_by_schedule', 'due_soon', 'due_soon_by_schedule', 'current'),
            next_maintenance_date ASC
        `;

        const schedule = await database.query<any>(scheduleQuery, params);

        // Get summary statistics
        const summaryStats =
          await this.getMaintenanceSummaryStats(parsedBuildingId);

        const enhancedSchedule = schedule.map((item) => ({
          ...item,
          urgency_score: this.calculateMaintenanceUrgency(item),
          days_until_due: this.calculateDaysUntilDue(item),
        }));

        logger.info(
          `Maintenance schedule retrieved: ${schedule.length} equipment items`
        );

        const response: ApiResponse<{
          schedule: typeof enhancedSchedule;
          summary: typeof summaryStats;
        }> = {
          success: true,
          message: "Maintenance schedule fetched successfully",
          data: {
            schedule: enhancedSchedule,
            summary: summaryStats,
          },
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching maintenance schedule:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch maintenance schedule", 500);
      }
    }
  );

  // Private helper methods

  /**
   * Enhance equipment with additional statistics
   */
  private async enhanceEquipmentWithStats(
    equipment: IEquipmentDetailed[]
  ): Promise<IEquipmentDetailed[]> {
    if (equipment.length === 0) return equipment;

    try {
      // Add computed fields and health status
      return equipment.map((item) => ({
        ...item,
        health_status: this.calculateHealthStatus(
          item,
          item.active_alerts || 0 // Fixed: Now properly typed as number
        ),
        maintenance_urgency: this.calculateMaintenanceUrgency(item),
      }));
    } catch (error) {
      logger.error("Error enhancing equipment with stats:", error);
      // Return equipment without enhancement rather than failing
      return equipment;
    }
  }

  /**
   * Calculate equipment health status
   */
  private calculateHealthStatus(
    equipment: any,
    alertCount: number
  ): "excellent" | "good" | "fair" | "poor" | "critical" {
    // Critical if faulty or has critical alerts
    if (equipment.status === "faulty" || alertCount > 2) {
      return "critical";
    }

    // Poor if in maintenance or has alerts
    if (equipment.status === "maintenance" || alertCount > 0) {
      return "poor";
    }

    // Fair if overdue for maintenance
    if (
      equipment.maintenance_status === "overdue" ||
      equipment.maintenance_status === "overdue_by_schedule"
    ) {
      return "fair";
    }

    // Good if due soon for maintenance
    if (
      equipment.maintenance_status === "due_soon" ||
      equipment.maintenance_status === "due_soon_by_schedule"
    ) {
      return "good";
    }

    // Excellent otherwise
    return "excellent";
  }

  /**
   * Calculate maintenance urgency score
   */
  private calculateMaintenanceUrgency(equipment: any): number {
    let urgency = 0;

    // Status-based urgency
    if (equipment.status === "faulty") urgency += 50;
    else if (equipment.status === "maintenance") urgency += 30;

    // Maintenance status urgency
    if (equipment.maintenance_status === "overdue") urgency += 40;
    else if (equipment.maintenance_status === "overdue_by_schedule")
      urgency += 35;
    else if (equipment.maintenance_status === "due_soon") urgency += 20;
    else if (equipment.maintenance_status === "due_soon_by_schedule")
      urgency += 15;

    // Risk level urgency
    if (equipment.maintenance_risk_level === "critical") urgency += 30;
    else if (equipment.maintenance_risk_level === "high") urgency += 20;
    else if (equipment.maintenance_risk_level === "medium") urgency += 10;

    // Alert-based urgency
    urgency += (equipment.active_alerts || 0) * 5;

    return Math.min(100, urgency);
  }

  /**
   * Calculate days until due for maintenance
   */
  private calculateDaysUntilDue(equipment: any): number {
    const today = new Date();
    const dates = [
      equipment.scheduled_maintenance_date,
      equipment.next_maintenance_date,
      equipment.predicted_maintenance_date,
    ].filter((date) => date);

    if (dates.length === 0) return 999;

    const earliestDate = new Date(
      Math.min(...dates.map((d) => new Date(d).getTime()))
    );
    const diffTime = earliestDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get equipment performance metrics
   */
  private async getEquipmentPerformanceMetrics(
    equipmentId: number
  ): Promise<any> {
    try {
      const metrics = await database.queryOne<any>(
        `SELECT 
          COUNT(em.id) as total_maintenance_count,
          SUM(em.downtime_minutes) as total_downtime_minutes,
          AVG(em.cost) as average_maintenance_cost,
          SUM(em.cost) as total_maintenance_cost,
          COUNT(CASE WHEN em.maintenance_type = 'emergency' THEN 1 END) as emergency_maintenance_count,
          COUNT(CASE WHEN em.maintenance_type = 'preventive' THEN 1 END) as preventive_maintenance_count,
          MAX(em.completed_date) as last_maintenance_date,
          COUNT(CASE WHEN a.severity = 'critical' THEN 1 END) as critical_alerts_count,
          COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_alerts_count
        FROM equipment e
        LEFT JOIN equipment_maintenance em ON e.id = em.equipment_id AND em.status = 'completed'
        LEFT JOIN alerts a ON e.id = a.equipment_id AND a.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
        WHERE e.id = ?
        GROUP BY e.id`,
        [equipmentId]
      );

      const uptime = metrics?.total_downtime_minutes
        ? Math.max(
            0,
            100 - (metrics.total_downtime_minutes / (365 * 24 * 60)) * 100
          )
        : 100;

      return {
        ...metrics,
        uptime_percentage: Math.round(uptime * 100) / 100,
        maintenance_efficiency:
          metrics?.total_maintenance_count > 0
            ? (metrics.preventive_maintenance_count /
                metrics.total_maintenance_count) *
              100
            : 100,
        reliability_score: this.calculateReliabilityScore(metrics),
      };
    } catch (error) {
      logger.error("Error getting equipment performance metrics:", error);
      return {
        total_maintenance_count: 0,
        total_downtime_minutes: 0,
        uptime_percentage: 100,
        maintenance_efficiency: 100,
        reliability_score: 50,
      };
    }
  }

  /**
   * Calculate reliability score
   */
  private calculateReliabilityScore(metrics: any): number {
    if (!metrics) return 50;

    let score = 100;

    // Penalize for emergency maintenance
    if (metrics.emergency_maintenance_count > 0) {
      score -= metrics.emergency_maintenance_count * 15;
    }

    // Penalize for critical alerts
    if (metrics.critical_alerts_count > 0) {
      score -= metrics.critical_alerts_count * 10;
    }

    // Penalize for active alerts
    if (metrics.active_alerts_count > 0) {
      score -= metrics.active_alerts_count * 5;
    }

    // Bonus for regular preventive maintenance
    if (
      metrics.preventive_maintenance_count > metrics.emergency_maintenance_count
    ) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get maintenance summary statistics
   */
  private async getMaintenanceSummaryStats(buildingId?: number): Promise<any> {
    try {
      const conditions = ["e.status = 'active'"];
      const params: any[] = [];

      if (buildingId) {
        conditions.push("e.building_id = ?");
        params.push(buildingId);
      }

      const whereClause = `WHERE ${conditions.join(" AND ")}`;

      const stats = await database.queryOne<any>(
        `SELECT 
          COUNT(e.id) as total_equipment,
          COUNT(CASE WHEN em_next.scheduled_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as due_soon,
          COUNT(CASE WHEN em_next.scheduled_date < CURDATE() THEN 1 END) as overdue,
          COUNT(CASE WHEN e.status = 'faulty' THEN 1 END) as faulty_equipment,
          COUNT(CASE WHEN e.status = 'maintenance' THEN 1 END) as in_maintenance,
          COUNT(CASE WHEN alert_count.active_alerts > 0 THEN 1 END) as equipment_with_alerts
        FROM equipment e
        LEFT JOIN (
          SELECT equipment_id, MIN(scheduled_date) as scheduled_date
          FROM equipment_maintenance 
          WHERE status = 'scheduled'
          GROUP BY equipment_id
        ) em_next ON e.id = em_next.equipment_id
        LEFT JOIN (
          SELECT equipment_id, COUNT(*) as active_alerts
          FROM alerts 
          WHERE status = 'active'
          GROUP BY equipment_id
        ) alert_count ON e.id = alert_count.equipment_id
        ${whereClause}`,
        params
      );

      return (
        stats || {
          total_equipment: 0,
          due_soon: 0,
          overdue: 0,
          faulty_equipment: 0,
          in_maintenance: 0,
          equipment_with_alerts: 0,
        }
      );
    } catch (error) {
      logger.error("Error getting maintenance summary stats:", error);
      return {
        total_equipment: 0,
        due_soon: 0,
        overdue: 0,
        faulty_equipment: 0,
        in_maintenance: 0,
        equipment_with_alerts: 0,
      };
    }
  }
}

export default new EquipmentController();
