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
  limit?: string;
  page?: string;
}

interface PerformanceQuery {
  period?: string;
  start_date?: string;
  end_date?: string;
}

interface MaintenanceLogData {
  maintenance_type: "preventive" | "corrective" | "emergency" | "inspection";
  description: string;
  technician_id?: number;
  scheduled_date?: string;
  completed_date?: string;
  duration_minutes?: number;
  downtime_minutes?: number;
  cost?: number;
  parts_used?: string[];
  notes?: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
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

        // Get equipment data with enhanced information using actual database schema
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
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
          ) mp ON e.id = mp.equipment_id AND mp.rn = 1
          LEFT JOIN (
            SELECT equipment_id, COUNT(*) as active_alerts
            FROM alerts 
            WHERE status IN ('active', 'acknowledged')
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

        // Get performance metrics for the last 30 days
        const performanceMetrics = await this.getEquipmentPerformanceMetrics(
          equipmentId,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0], // 30 days ago
          new Date().toISOString().split("T")[0] // today
        );

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

  // NEW METHOD: Get equipment maintenance history
  public getMaintenanceHistory = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { limit = "20", page = "1" } = req.query as MaintenanceQuery;

      logger.info("🔧 Getting maintenance history for equipment ID:", id);

      const equipmentId = this.parseToNumber(id);
      if (equipmentId === undefined) {
        throw new CustomError("Invalid equipment ID", 400);
      }

      try {
        // Verify equipment exists
        const equipment = await database.queryOne(
          "SELECT id, name FROM equipment WHERE id = ?",
          [equipmentId]
        );

        if (!equipment) {
          throw new CustomError("Equipment not found", 404);
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const offset = (pageNum - 1) * limitNum;

        // Get maintenance history with pagination
        const [maintenanceHistory, countResult] = await Promise.all([
          database.query(
            `SELECT 
              em.*,
              u.first_name as technician_first_name,
              u.last_name as technician_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as technician_name
            FROM equipment_maintenance em
            LEFT JOIN users u ON em.technician_id = u.id
            WHERE em.equipment_id = ?
            ORDER BY em.created_at DESC
            LIMIT ? OFFSET ?`,
            [equipmentId, limitNum, offset]
          ),
          database.queryOne<{ total: number }>(
            "SELECT COUNT(*) as total FROM equipment_maintenance WHERE equipment_id = ?",
            [equipmentId]
          ),
        ]);

        // Get maintenance statistics
        const stats = await database.queryOne(
          `SELECT 
            COUNT(*) as total_maintenance,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
            COUNT(CASE WHEN maintenance_type = 'emergency' THEN 1 END) as emergency,
            AVG(cost) as avg_cost,
            SUM(cost) as total_cost,
            AVG(duration_minutes) as avg_duration,
            SUM(downtime_minutes) as total_downtime
          FROM equipment_maintenance 
          WHERE equipment_id = ?`,
          [equipmentId]
        );

        const totalItems = countResult?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum);

        const response: ApiResponse<{
          maintenance_history: typeof maintenanceHistory;
          statistics: typeof stats;
          pagination: any;
        }> = {
          success: true,
          message: "Maintenance history fetched successfully",
          data: {
            maintenance_history: maintenanceHistory,
            statistics: stats,
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
          `Retrieved ${maintenanceHistory.length} maintenance records`
        );
        res.json(response);
      } catch (error) {
        logger.error("Error fetching maintenance history:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch maintenance history", 500);
      }
    }
  );

  // NEW METHOD: Log equipment maintenance
  public logMaintenance = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const maintenanceData = req.body as MaintenanceLogData;
      const userId = (req as any).user?.id;

      logger.info("📝 Logging maintenance for equipment ID:", id);

      const equipmentId = this.parseToNumber(id);
      if (equipmentId === undefined) {
        throw new CustomError("Invalid equipment ID", 400);
      }

      try {
        // Verify equipment exists
        const equipment = await database.queryOne(
          "SELECT id, name, building_id FROM equipment WHERE id = ?",
          [equipmentId]
        );

        if (!equipment) {
          throw new CustomError("Equipment not found", 404);
        }

        // Insert maintenance record using actual equipment_maintenance table structure
        const insertQuery = `
          INSERT INTO equipment_maintenance 
          (equipment_id, maintenance_type, description, work_performed, technician_id, 
           scheduled_date, completed_date, downtime_minutes, 
           cost, parts_used, maintenance_notes, status, priority) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          equipmentId,
          maintenanceData.maintenance_type,
          maintenanceData.description,
          maintenanceData.notes || null, // Using notes as work_performed
          maintenanceData.technician_id || userId,
          maintenanceData.scheduled_date || null,
          maintenanceData.completed_date || null,
          maintenanceData.downtime_minutes || null,
          maintenanceData.cost || null,
          maintenanceData.parts_used
            ? JSON.stringify(maintenanceData.parts_used)
            : null,
          maintenanceData.notes || null, // maintenance_notes field
          maintenanceData.status || "scheduled",
          "medium", // default priority as per schema
        ];

        const maintenanceId = await database.insert(insertQuery, insertParams);

        // Get the created maintenance record
        const newMaintenance = await database.queryOne(
          `SELECT 
            em.*,
            u.first_name as technician_first_name,
            u.last_name as technician_last_name,
            CONCAT(u.first_name, ' ', u.last_name) as technician_name
          FROM equipment_maintenance em
          LEFT JOIN users u ON em.technician_id = u.id
          WHERE em.id = ?`,
          [maintenanceId]
        );

        // Emit real-time update
        socketManager.emitToBuilding(
          equipment.building_id.toString(),
          "maintenanceLogged",
          {
            equipment_id: equipmentId,
            maintenance: newMaintenance,
          }
        );

        logger.info(
          `Maintenance logged for equipment ${equipment.name}: ${maintenanceData.maintenance_type}`
        );

        const response: ApiResponse<typeof newMaintenance> = {
          success: true,
          message: "Maintenance logged successfully",
          data: newMaintenance,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error logging maintenance:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to log maintenance", 500);
      }
    }
  );

  // NEW METHOD: Get equipment performance analytics
  public getPerformanceAnalytics = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const {
        period = "monthly",
        start_date,
        end_date,
      } = req.query as PerformanceQuery;

      logger.info("📊 Getting performance analytics for equipment ID:", id);

      const equipmentId = this.parseToNumber(id);
      if (equipmentId === undefined) {
        throw new CustomError("Invalid equipment ID", 400);
      }

      try {
        // Verify equipment exists
        const equipment = await database.queryOne(
          "SELECT id, name, building_id FROM equipment WHERE id = ?",
          [equipmentId]
        );

        if (!equipment) {
          throw new CustomError("Equipment not found", 404);
        }

        // Calculate date range based on period
        let dateCondition = "";
        let dateParams: any[] = [];

        if (start_date && end_date) {
          dateCondition = "AND DATE(created_at) BETWEEN ? AND ?";
          dateParams = [start_date, end_date];
        } else {
          const periodMap: Record<string, number> = {
            weekly: 7,
            monthly: 30,
            quarterly: 90,
            yearly: 365,
          };
          const days = periodMap[period] || 30;
          dateCondition = "AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)";
          dateParams = [days];
        }

        // Calculate date range based on period first
        let analysisStartDate: string;
        let analysisEndDate: string;

        if (start_date && end_date) {
          analysisStartDate = start_date;
          analysisEndDate = end_date;
        } else {
          const periodMap: Record<string, number> = {
            weekly: 7,
            monthly: 30,
            quarterly: 90,
            yearly: 365,
          };
          const days = periodMap[period] || 30;
          analysisEndDate = new Date().toISOString().split("T")[0];
          analysisStartDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];
        }

        // Get performance metrics
        const performanceMetrics = await this.getEquipmentPerformanceMetrics(
          equipmentId,
          analysisStartDate,
          analysisEndDate
        );

        // Calculate derived metrics from real data
        const performanceScore = this.calculatePerformanceScore({
          uptime: performanceMetrics.uptime_percentage,
          maintenanceEfficiency: performanceMetrics.maintenance_efficiency,
          alertResponseRate: performanceMetrics.alert_response_efficiency,
          mtbfHours: performanceMetrics.mtbf_hours,
          mttrHours: performanceMetrics.mttr_hours,
          totalOperationalHours: performanceMetrics.total_operational_hours,
          failureCount: performanceMetrics.emergency_maintenance_count,
          criticalAlertCount: performanceMetrics.critical_alerts_count,
          totalMaintenanceCost: performanceMetrics.total_maintenance_cost,
        });

        // Get additional metrics for comprehensive analysis
        const [energyMetrics, costTrendMetrics, reliabilityTrends] =
          await Promise.all([
            // Energy consumption metrics (using actual table: energy_consumption)
            database.queryOne(
              `SELECT 
              COUNT(ec.id) as reading_count,
              COALESCE(AVG(ec.consumption_kwh), 0) as avg_power_consumption,
              COALESCE(MAX(ec.consumption_kwh), 0) as peak_power_consumption,
              COALESCE(MIN(ec.consumption_kwh), 0) as min_power_consumption,
              COALESCE(AVG(ec.power_factor), 0) as avg_power_factor,
              COALESCE(MIN(ec.power_factor), 0) as min_power_factor,
              COALESCE(SUM(ec.consumption_kwh), 0) as total_energy_consumption,
              COALESCE(AVG(ec.cost_php), 0) as avg_energy_cost,
              COALESCE(AVG(ec.demand_kw), 0) as avg_demand_kw,
              COALESCE(MAX(ec.demand_kw), 0) as peak_demand_kw
            FROM energy_consumption ec 
            WHERE ec.building_id = ? 
            AND ec.recorded_at BETWEEN ? AND ?`,
              [equipment.building_id, analysisStartDate, analysisEndDate]
            ),

            // Cost trend analysis (using actual equipment_maintenance table)
            database.query(
              `SELECT 
              YEAR(em.created_at) as year,
              MONTH(em.created_at) as month,
              COALESCE(SUM(em.cost), 0) as monthly_cost,
              COUNT(em.id) as maintenance_events,
              COALESCE(SUM(em.downtime_minutes), 0) as monthly_downtime,
              COUNT(CASE WHEN em.maintenance_type = 'emergency' THEN 1 END) as emergency_events,
              COUNT(CASE WHEN em.maintenance_type = 'corrective' THEN 1 END) as corrective_events,
              COUNT(CASE WHEN em.maintenance_type = 'preventive' THEN 1 END) as preventive_events
            FROM equipment_maintenance em 
            WHERE em.equipment_id = ? 
            AND em.created_at BETWEEN ? AND ?
            GROUP BY YEAR(em.created_at), MONTH(em.created_at)
            ORDER BY year DESC, month DESC
            LIMIT 12`,
              [equipmentId, analysisStartDate, analysisEndDate]
            ),

            // Reliability trends (using actual equipment_maintenance table)
            database.query(
              `SELECT 
              DATE(em.created_at) as date,
              COUNT(CASE WHEN em.maintenance_type = 'emergency' THEN 1 END) as daily_failures,
              COUNT(CASE WHEN em.maintenance_type = 'corrective' THEN 1 END) as daily_corrective,
              COUNT(CASE WHEN em.maintenance_type = 'preventive' THEN 1 END) as daily_preventive,
              COALESCE(SUM(em.downtime_minutes), 0) as daily_downtime,
              COUNT(em.id) as daily_maintenance_events,
              COALESCE(AVG(em.cost), 0) as avg_daily_cost,
              COALESCE(SUM(em.cost), 0) as total_daily_cost
            FROM equipment_maintenance em 
            WHERE em.equipment_id = ? 
            AND em.created_at BETWEEN ? AND ?
            AND em.status IN ('completed', 'in_progress')
            GROUP BY DATE(em.created_at)
            ORDER BY date DESC
            LIMIT 90`,
              [equipmentId, analysisStartDate, analysisEndDate]
            ),
          ]);

        // Calculate additional performance indicators
        const costEfficiency =
          performanceMetrics.total_operational_hours > 0
            ? performanceMetrics.total_maintenance_cost /
              performanceMetrics.total_operational_hours
            : 0;

        const failureRate =
          performanceMetrics.total_operational_hours > 0
            ? (performanceMetrics.emergency_maintenance_count /
                performanceMetrics.total_operational_hours) *
              8760 // failures per year
            : 0;

        const energyEfficiency =
          energyMetrics?.reading_count > 0
            ? {
                building_avg_power_consumption:
                  energyMetrics.avg_power_consumption,
                building_peak_power_consumption:
                  energyMetrics.peak_power_consumption,
                building_min_power_consumption:
                  energyMetrics.min_power_consumption,
                building_avg_power_factor: energyMetrics.avg_power_factor,
                building_min_power_factor: energyMetrics.min_power_factor,
                building_total_energy_consumption:
                  energyMetrics.total_energy_consumption,
                building_avg_energy_cost: energyMetrics.avg_energy_cost,
                building_avg_demand_kw: energyMetrics.avg_demand_kw,
                building_peak_demand_kw: energyMetrics.peak_demand_kw,
                energy_efficiency_score: Math.min(
                  100,
                  energyMetrics.avg_power_factor * 100
                ),
                note: "Energy data is tracked at building level, not individual equipment level",
              }
            : null;

        const analytics = {
          equipment_info: equipment,
          period: {
            type: period,
            start_date: analysisStartDate,
            end_date: analysisEndDate,
            total_days: Math.ceil(
              (new Date(analysisEndDate).getTime() -
                new Date(analysisStartDate).getTime()) /
                (1000 * 60 * 60 * 24)
            ),
          },
          performance_summary: {
            overall_score: performanceScore,
            uptime_percentage: performanceMetrics.uptime_percentage,
            availability_percentage: performanceMetrics.availability_percentage,
            maintenance_efficiency: performanceMetrics.maintenance_efficiency,
            alert_response_rate: performanceMetrics.alert_response_efficiency,
            reliability_score: performanceMetrics.reliability_score,
            cost_efficiency_per_hour: Math.round(costEfficiency * 100) / 100,
            failure_rate_per_year: Math.round(failureRate * 100) / 100,
          },
          maintenance_analytics: {
            total_maintenance_events:
              performanceMetrics.total_maintenance_count,
            preventive_maintenance:
              performanceMetrics.preventive_maintenance_count,
            corrective_maintenance:
              performanceMetrics.corrective_maintenance_count,
            emergency_maintenance:
              performanceMetrics.emergency_maintenance_count,
            inspection_count: performanceMetrics.inspection_count,
            completed_maintenance:
              performanceMetrics.completed_maintenance_count,
            cancelled_maintenance:
              performanceMetrics.cancelled_maintenance_count,
            total_maintenance_cost: performanceMetrics.total_maintenance_cost,
            average_maintenance_cost:
              performanceMetrics.average_maintenance_cost,
            total_downtime_hours: performanceMetrics.total_downtime_hours,
            mtbf_hours: performanceMetrics.mtbf_hours,
            mttr_hours: performanceMetrics.mttr_hours,
            cost_per_operational_hour:
              performanceMetrics.cost_per_operational_hour,
            maintenance_cost_trend: costTrendMetrics,
          },
          alert_analytics: {
            total_alerts: performanceMetrics.total_alerts,
            critical_alerts: performanceMetrics.critical_alerts_count,
            active_alerts: performanceMetrics.active_alerts_count,
            alert_response_efficiency:
              performanceMetrics.alert_response_efficiency,
            avg_acknowledgment_time_minutes:
              performanceMetrics.avg_acknowledgment_time_minutes,
            avg_resolution_time_minutes:
              performanceMetrics.avg_resolution_time_minutes,
          },
          energy_analytics: energyEfficiency,
          operational_analytics: {
            total_operational_hours: performanceMetrics.total_operational_hours,
            total_downtime_hours: performanceMetrics.total_downtime_hours,
            operational_efficiency:
              Math.round(
                ((performanceMetrics.total_operational_hours -
                  performanceMetrics.total_downtime_hours) /
                  performanceMetrics.total_operational_hours) *
                  10000
              ) / 100,
            first_maintenance_date: performanceMetrics.first_maintenance_date,
            last_maintenance_date: performanceMetrics.last_maintenance_date,
          },
          trends: {
            reliability_trends: reliabilityTrends,
            performance_indicators: await this.getDetailedPerformanceIndicators(
              equipmentId,
              period
            ),
            cost_trends: costTrendMetrics,
          },
          benchmarking: {
            industry_comparison: await this.getIndustryBenchmarks(
              equipment.equipment_type,
              equipmentId,
              performanceScore
            ),
            peer_comparison: await this.getPeerComparison(
              equipment.building_id,
              equipment.equipment_type,
              equipmentId,
              performanceScore
            ),
          },
          recommendations: this.generatePerformanceRecommendations({
            performanceScore,
            uptime: performanceMetrics.uptime_percentage,
            maintenanceEfficiency: performanceMetrics.maintenance_efficiency,
            mtbfHours: performanceMetrics.mtbf_hours,
            mttrHours: performanceMetrics.mttr_hours,
            failureCount: performanceMetrics.emergency_maintenance_count,
            criticalAlerts: performanceMetrics.critical_alerts_count,
            totalAlerts: performanceMetrics.total_alerts,
            alertResponseEfficiency:
              performanceMetrics.alert_response_efficiency,
            totalMaintenanceCost: performanceMetrics.total_maintenance_cost,
            totalOperationalHours: performanceMetrics.total_operational_hours,
            emergencyMaintenanceCount:
              performanceMetrics.emergency_maintenance_count,
            preventiveMaintenanceCount:
              performanceMetrics.preventive_maintenance_count,
          }),
        };

        const response: ApiResponse<typeof analytics> = {
          success: true,
          message: "Performance analytics fetched successfully",
          data: analytics,
        };

        logger.info(
          `Performance analytics retrieved for equipment ${equipment.name}`
        );
        res.json(response);
      } catch (error) {
        logger.error("Error fetching performance analytics:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch performance analytics", 500);
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

        // Calculate next maintenance date based on schedule and last maintenance using actual schema
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
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
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
            WHERE status IN ('active', 'acknowledged')
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
   * Get equipment performance metrics with real calculations using actual database schema
   */
  private async getEquipmentPerformanceMetrics(
    equipmentId: number,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    try {
      // Get equipment installation date for accurate calculations
      const equipment = await database.queryOne<any>(
        `SELECT installation_date, created_at, building_id FROM equipment WHERE id = ?`,
        [equipmentId]
      );

      if (!equipment) {
        throw new Error("Equipment not found");
      }

      // Calculate actual operational period
      const installDate = equipment.installation_date
        ? new Date(equipment.installation_date)
        : new Date(equipment.created_at);
      const currentDate = new Date();
      const analysisStartDate = startDate ? new Date(startDate) : installDate;
      const analysisEndDate = endDate ? new Date(endDate) : currentDate;

      // Calculate total operational hours in the analysis period
      const totalOperationalHours = Math.max(
        1,
        (analysisEndDate.getTime() - analysisStartDate.getTime()) /
          (1000 * 60 * 60)
      );

      // Build date condition for analysis period
      let dateCondition = "";
      let dateParams: any[] = [];

      if (startDate && endDate) {
        dateCondition = "AND DATE(em.created_at) BETWEEN ? AND ?";
        dateParams = [startDate, endDate];
      } else {
        dateCondition = "AND em.created_at >= ?";
        dateParams = [analysisStartDate.toISOString().split("T")[0]];
      }

      // Get comprehensive maintenance metrics using actual equipment_maintenance table
      const maintenanceMetrics = await database.queryOne<any>(
        `SELECT 
          COUNT(em.id) as total_maintenance_count,
          COALESCE(SUM(em.downtime_minutes), 0) as total_downtime_minutes,
          COALESCE(AVG(em.cost), 0) as average_maintenance_cost,
          COALESCE(SUM(em.cost), 0) as total_maintenance_cost,
          COUNT(CASE WHEN em.maintenance_type = 'emergency' THEN 1 END) as emergency_maintenance_count,
          COUNT(CASE WHEN em.maintenance_type = 'corrective' THEN 1 END) as corrective_maintenance_count,
          COUNT(CASE WHEN em.maintenance_type = 'preventive' THEN 1 END) as preventive_maintenance_count,
          COUNT(CASE WHEN em.maintenance_type = 'predictive' THEN 1 END) as predictive_maintenance_count,
          COALESCE(AVG(CASE WHEN em.completed_date IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, em.scheduled_date, em.completed_date) END), 0) as average_duration_minutes,
          COALESCE(SUM(CASE WHEN em.completed_date IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, em.scheduled_date, em.completed_date) END), 0) as total_duration_minutes,
          MAX(em.completed_date) as last_maintenance_date,
          MIN(em.completed_date) as first_maintenance_date,
          COUNT(CASE WHEN em.status = 'completed' THEN 1 END) as completed_maintenance_count,
          COUNT(CASE WHEN em.status = 'cancelled' THEN 1 END) as cancelled_maintenance_count,
          COUNT(CASE WHEN em.status = 'scheduled' THEN 1 END) as scheduled_maintenance_count,
          COUNT(CASE WHEN em.status = 'in_progress' THEN 1 END) as in_progress_maintenance_count
        FROM equipment e
        LEFT JOIN equipment_maintenance em ON e.id = em.equipment_id ${dateCondition}
        WHERE e.id = ?
        GROUP BY e.id`,
        [...dateParams, equipmentId]
      );

      // Get alert metrics for the same period using actual alerts table
      const alertMetrics = await database.queryOne<any>(
        `SELECT 
          COUNT(a.id) as total_alerts,
          COUNT(CASE WHEN a.severity = 'critical' THEN 1 END) as critical_alerts_count,
          COUNT(CASE WHEN a.severity = 'high' THEN 1 END) as high_alerts_count,
          COUNT(CASE WHEN a.severity = 'medium' THEN 1 END) as medium_alerts_count,
          COUNT(CASE WHEN a.severity = 'low' THEN 1 END) as low_alerts_count,
          COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_alerts_count,
          COUNT(CASE WHEN a.status = 'resolved' THEN 1 END) as resolved_alerts_count,
          COUNT(CASE WHEN a.status = 'acknowledged' THEN 1 END) as acknowledged_alerts_count,
          COALESCE(AVG(CASE 
            WHEN a.acknowledged_at IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, a.created_at, a.acknowledged_at)
          END), 0) as avg_acknowledgment_time_minutes,
          COALESCE(AVG(CASE 
            WHEN a.resolved_at IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, a.created_at, a.resolved_at)
          END), 0) as avg_resolution_time_minutes,
          MAX(a.created_at) as last_alert_date,
          MIN(a.created_at) as first_alert_date
        FROM alerts a
        WHERE a.equipment_id = ? 
        AND a.created_at BETWEEN ? AND ?`,
        [
          equipmentId,
          analysisStartDate.toISOString(),
          analysisEndDate.toISOString(),
        ]
      );

      // Calculate real uptime based on actual downtime vs operational hours
      const totalDowntimeHours =
        (maintenanceMetrics?.total_downtime_minutes || 0) / 60;
      const actualUptime = Math.max(
        0,
        ((totalOperationalHours - totalDowntimeHours) / totalOperationalHours) *
          100
      );

      // Calculate maintenance efficiency (preventive + predictive vs reactive)
      const totalProactiveMaintenance =
        (maintenanceMetrics?.preventive_maintenance_count || 0) +
        (maintenanceMetrics?.predictive_maintenance_count || 0);
      const totalReactiveMaintenance =
        (maintenanceMetrics?.emergency_maintenance_count || 0) +
        (maintenanceMetrics?.corrective_maintenance_count || 0);
      const totalMaintenance = maintenanceMetrics?.total_maintenance_count || 0;
      const maintenanceEfficiency =
        totalMaintenance > 0
          ? (totalProactiveMaintenance / totalMaintenance) * 100
          : 0;

      // Calculate Mean Time Between Failures (MTBF) - time between emergency maintenance
      const failureCount = maintenanceMetrics?.emergency_maintenance_count || 0;
      const mtbfHours =
        failureCount > 0
          ? totalOperationalHours / failureCount
          : totalOperationalHours;

      // Calculate Mean Time To Repair (MTTR) - average time from scheduled to completed
      const mttrHours =
        (maintenanceMetrics?.average_duration_minutes || 0) / 60;

      // Calculate availability percentage
      const availability =
        mtbfHours > 0 ? (mtbfHours / (mtbfHours + mttrHours)) * 100 : 100;

      // Calculate alert response efficiency
      const alertResponseEfficiency =
        (alertMetrics?.total_alerts || 0) > 0
          ? ((alertMetrics?.resolved_alerts_count || 0) /
              alertMetrics.total_alerts) *
            100
          : 100;

      // Calculate completion rate for maintenance
      const maintenanceCompletionRate =
        totalMaintenance > 0
          ? ((maintenanceMetrics?.completed_maintenance_count || 0) /
              totalMaintenance) *
            100
          : 100;

      // Calculate reliability score based on multiple factors
      const reliabilityScore = this.calculateReliabilityScore({
        uptime: actualUptime,
        maintenanceEfficiency,
        alertResponseEfficiency,
        mtbfHours,
        failureCount,
        totalAlerts: alertMetrics?.total_alerts || 0,
        criticalAlerts: alertMetrics?.critical_alerts_count || 0,
      });

      return {
        // Basic metrics
        total_maintenance_count:
          maintenanceMetrics?.total_maintenance_count || 0,
        total_downtime_minutes: maintenanceMetrics?.total_downtime_minutes || 0,
        total_downtime_hours: totalDowntimeHours,
        total_operational_hours: totalOperationalHours,

        // Financial metrics
        average_maintenance_cost:
          maintenanceMetrics?.average_maintenance_cost || 0,
        total_maintenance_cost: maintenanceMetrics?.total_maintenance_cost || 0,
        cost_per_operational_hour:
          totalOperationalHours > 0
            ? (maintenanceMetrics?.total_maintenance_cost || 0) /
              totalOperationalHours
            : 0,

        // Maintenance breakdown
        emergency_maintenance_count:
          maintenanceMetrics?.emergency_maintenance_count || 0,
        corrective_maintenance_count:
          maintenanceMetrics?.corrective_maintenance_count || 0,
        preventive_maintenance_count:
          maintenanceMetrics?.preventive_maintenance_count || 0,
        predictive_maintenance_count:
          maintenanceMetrics?.predictive_maintenance_count || 0,
        completed_maintenance_count:
          maintenanceMetrics?.completed_maintenance_count || 0,
        cancelled_maintenance_count:
          maintenanceMetrics?.cancelled_maintenance_count || 0,
        scheduled_maintenance_count:
          maintenanceMetrics?.scheduled_maintenance_count || 0,
        in_progress_maintenance_count:
          maintenanceMetrics?.in_progress_maintenance_count || 0,

        // Performance metrics
        uptime_percentage: Math.round(actualUptime * 100) / 100,
        availability_percentage: Math.round(availability * 100) / 100,
        maintenance_efficiency: Math.round(maintenanceEfficiency * 100) / 100,
        maintenance_completion_rate:
          Math.round(maintenanceCompletionRate * 100) / 100,
        mtbf_hours: Math.round(mtbfHours * 100) / 100,
        mttr_hours: Math.round(mttrHours * 100) / 100,
        reliability_score: Math.round(reliabilityScore * 100) / 100,

        // Alert metrics
        total_alerts: alertMetrics?.total_alerts || 0,
        critical_alerts_count: alertMetrics?.critical_alerts_count || 0,
        high_alerts_count: alertMetrics?.high_alerts_count || 0,
        medium_alerts_count: alertMetrics?.medium_alerts_count || 0,
        low_alerts_count: alertMetrics?.low_alerts_count || 0,
        active_alerts_count: alertMetrics?.active_alerts_count || 0,
        resolved_alerts_count: alertMetrics?.resolved_alerts_count || 0,
        acknowledged_alerts_count: alertMetrics?.acknowledged_alerts_count || 0,
        alert_response_efficiency:
          Math.round(alertResponseEfficiency * 100) / 100,
        avg_acknowledgment_time_minutes:
          Math.round(
            (alertMetrics?.avg_acknowledgment_time_minutes || 0) * 100
          ) / 100,
        avg_resolution_time_minutes:
          Math.round((alertMetrics?.avg_resolution_time_minutes || 0) * 100) /
          100,

        // Time-based metrics
        last_maintenance_date: maintenanceMetrics?.last_maintenance_date,
        first_maintenance_date: maintenanceMetrics?.first_maintenance_date,
        last_alert_date: alertMetrics?.last_alert_date,
        first_alert_date: alertMetrics?.first_alert_date,
        analysis_period: {
          start_date: analysisStartDate.toISOString().split("T")[0],
          end_date: analysisEndDate.toISOString().split("T")[0],
          total_days: Math.ceil(
            (analysisEndDate.getTime() - analysisStartDate.getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        },
      };
    } catch (error) {
      logger.error("Error getting equipment performance metrics:", error);
      throw error;
    }
  }

  /**
   * Calculate reliability score based on real performance data
   */
  private calculateReliabilityScore(metrics: {
    uptime: number;
    maintenanceEfficiency: number;
    alertResponseEfficiency: number;
    mtbfHours: number;
    failureCount: number;
    totalAlerts: number;
    criticalAlerts: number;
  }): number {
    let score = 0;

    // Uptime contribution (40% of score)
    score += (metrics.uptime / 100) * 40;

    // Maintenance efficiency contribution (25% of score)
    score += (metrics.maintenanceEfficiency / 100) * 25;

    // Alert response efficiency contribution (15% of score)
    score += (metrics.alertResponseEfficiency / 100) * 15;

    // MTBF contribution (20% of score)
    // Normalize MTBF: 8760 hours (1 year) = 100%, with logarithmic scaling
    const mtbfScore =
      metrics.mtbfHours > 0
        ? Math.min(
            100,
            (Math.log10(metrics.mtbfHours + 1) / Math.log10(8760 + 1)) * 100
          )
        : 0;
    score += (mtbfScore / 100) * 20;

    // Apply penalties for poor performance indicators
    if (metrics.failureCount > 5) score -= 10; // Frequent failures
    if (metrics.criticalAlerts > 3) score -= 10; // Too many critical alerts
    if (metrics.totalAlerts > 20) score -= 5; // Alert fatigue
    if (metrics.uptime < 85) score -= 15; // Poor uptime
    if (metrics.maintenanceEfficiency < 50) score -= 10; // Reactive maintenance

    // Apply bonuses for excellent performance
    if (metrics.uptime > 98) score += 5;
    if (metrics.failureCount === 0) score += 5;
    if (metrics.criticalAlerts === 0) score += 3;
    if (metrics.maintenanceEfficiency > 80) score += 3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate performance score based on real metrics
   */
  private calculatePerformanceScore(metrics: {
    uptime: number;
    maintenanceEfficiency: number;
    alertResponseRate: number;
    mtbfHours: number;
    mttrHours: number;
    totalOperationalHours: number;
    failureCount: number;
    criticalAlertCount: number;
    totalMaintenanceCost: number;
  }): number {
    let score = 0;

    // Uptime score (35% weight) - exponential scaling for high uptime importance
    const uptimeScore = Math.pow(metrics.uptime / 100, 2) * 100;
    score += (uptimeScore / 100) * 35;

    // Maintenance efficiency score (25% weight)
    score += (metrics.maintenanceEfficiency / 100) * 25;

    // Alert response rate (20% weight)
    score += (metrics.alertResponseRate / 100) * 20;

    // Availability score based on MTBF/MTTR (15% weight)
    const availability =
      metrics.mtbfHours > 0
        ? (metrics.mtbfHours / (metrics.mtbfHours + metrics.mttrHours)) * 100
        : 100;
    score += (availability / 100) * 15;

    // Cost efficiency (5% weight) - lower cost per operational hour is better
    if (metrics.totalOperationalHours > 0) {
      const costPerHour =
        metrics.totalMaintenanceCost / metrics.totalOperationalHours;
      // Normalize cost efficiency (assuming $50/hour is baseline, $10/hour is excellent)
      const costEfficiency = Math.max(
        0,
        Math.min(100, ((50 - costPerHour) / 40) * 100)
      );
      score += (costEfficiency / 100) * 5;
    }

    // Performance penalties
    if (metrics.failureCount > 3) score -= 10;
    if (metrics.criticalAlertCount > 2) score -= 8;
    if (metrics.uptime < 90) score -= 15;
    if (metrics.mttrHours > 48) score -= 5; // Long repair times

    // Performance bonuses
    if (metrics.uptime > 99) score += 5;
    if (metrics.failureCount === 0) score += 5;
    if (metrics.criticalAlertCount === 0) score += 3;
    if (metrics.maintenanceEfficiency > 90) score += 3;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get detailed performance indicators for trending analysis using actual database schema
   */
  private async getDetailedPerformanceIndicators(
    equipmentId: number,
    period: string
  ): Promise<any[]> {
    try {
      const days =
        period === "weekly"
          ? 7
          : period === "quarterly"
            ? 90
            : period === "yearly"
              ? 365
              : 30;

      return await database.query(
        `SELECT 
          DATE(em.created_at) as date,
          COUNT(CASE WHEN em.maintenance_type = 'emergency' THEN 1 END) as emergency_count,
          COUNT(CASE WHEN em.maintenance_type = 'preventive' THEN 1 END) as preventive_count,
          COUNT(CASE WHEN em.maintenance_type = 'corrective' THEN 1 END) as corrective_count,
          COUNT(CASE WHEN em.maintenance_type = 'predictive' THEN 1 END) as predictive_count,
          COALESCE(SUM(em.downtime_minutes), 0) as downtime_minutes,
          COALESCE(AVG(em.cost), 0) as avg_cost,
          COALESCE(SUM(em.cost), 0) as total_cost,
          COUNT(DISTINCT a.id) as alert_count,
          COUNT(CASE WHEN a.severity = 'critical' THEN 1 END) as critical_alerts,
          COUNT(CASE WHEN a.severity = 'high' THEN 1 END) as high_alerts,
          -- Get building-level energy data since energy_consumption is linked to buildings, not equipment
          COALESCE(AVG(ec.power_factor), 0) as avg_power_factor,
          COALESCE(AVG(ec.consumption_kwh), 0) as avg_power_consumption,
          COALESCE(AVG(ec.demand_kw), 0) as avg_demand_kw
        FROM equipment_maintenance em 
        LEFT JOIN alerts a ON em.equipment_id = a.equipment_id AND DATE(em.created_at) = DATE(a.created_at)
        LEFT JOIN equipment e ON em.equipment_id = e.id
        LEFT JOIN energy_consumption ec ON e.building_id = ec.building_id AND DATE(em.created_at) = DATE(ec.recorded_at)
        WHERE em.equipment_id = ? AND em.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(em.created_at)
        ORDER BY date DESC`,
        [equipmentId, days]
      );
    } catch (error) {
      logger.error("Error getting detailed performance indicators:", error);
      return [];
    }
  }

  /**
   * Get industry benchmarks for comparison using actual database schema
   */
  private async getIndustryBenchmarks(
    equipmentType: string,
    equipmentId: number,
    currentScore: number
  ): Promise<any> {
    try {
      // Get benchmarks from similar equipment in the database using actual table structure
      const benchmarks = await database.queryOne(
        `SELECT 
          COUNT(*) as sample_size,
          AVG(
            CASE 
              WHEN em_stats.total_downtime > 0 AND em_stats.total_operational_hours > 0
              THEN ((em_stats.total_operational_hours - (em_stats.total_downtime/60)) / em_stats.total_operational_hours) * 100
              ELSE 95 
            END
          ) as industry_avg_uptime,
          AVG(
            CASE 
              WHEN em_stats.total_maintenance > 0
              THEN ((em_stats.preventive_maintenance + em_stats.predictive_maintenance) / em_stats.total_maintenance) * 100
              ELSE 70
            END
          ) as industry_avg_maintenance_efficiency,
          AVG(em_stats.avg_cost) as industry_avg_maintenance_cost,
          AVG(em_stats.emergency_rate) as industry_avg_emergency_rate
        FROM (
          SELECT 
            e.id,
            COUNT(em.id) as total_maintenance,
            COUNT(CASE WHEN em.maintenance_type = 'preventive' THEN 1 END) as preventive_maintenance,
            COUNT(CASE WHEN em.maintenance_type = 'predictive' THEN 1 END) as predictive_maintenance,
            COUNT(CASE WHEN em.maintenance_type = 'emergency' THEN 1 END) as emergency_maintenance,
            COALESCE(SUM(em.downtime_minutes), 0) as total_downtime,
            COALESCE(AVG(em.cost), 0) as avg_cost,
            TIMESTAMPDIFF(HOUR, 
              COALESCE(e.installation_date, e.created_at), 
              NOW()
            ) as total_operational_hours,
            CASE 
              WHEN COUNT(em.id) > 0 
              THEN (COUNT(CASE WHEN em.maintenance_type = 'emergency' THEN 1 END) / COUNT(em.id)) * 100
              ELSE 0
            END as emergency_rate
          FROM equipment e
          LEFT JOIN equipment_maintenance em ON e.id = em.equipment_id 
            AND em.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
            AND em.status IN ('completed', 'in_progress')
          WHERE e.equipment_type = ? AND e.id != ? AND e.status = 'active'
          GROUP BY e.id
          HAVING total_maintenance > 0
        ) em_stats`,
        [equipmentType, equipmentId]
      );

      const performanceRanking =
        currentScore > (benchmarks?.industry_avg_uptime || 85)
          ? "above_average"
          : currentScore > 90
            ? "average"
            : "below_average";

      return {
        equipment_type: equipmentType,
        sample_size: benchmarks?.sample_size || 0,
        industry_avg_uptime:
          Math.round((benchmarks?.industry_avg_uptime || 85) * 100) / 100,
        industry_avg_maintenance_efficiency:
          Math.round(
            (benchmarks?.industry_avg_maintenance_efficiency || 70) * 100
          ) / 100,
        industry_avg_maintenance_cost:
          Math.round((benchmarks?.industry_avg_maintenance_cost || 25) * 100) /
          100,
        industry_avg_emergency_rate:
          Math.round((benchmarks?.industry_avg_emergency_rate || 10) * 100) /
          100,
        performance_ranking: performanceRanking,
        comparison_notes: this.generateBenchmarkNotes(currentScore, benchmarks),
      };
    } catch (error) {
      logger.error("Error getting industry benchmarks:", error);
      return {
        equipment_type: equipmentType,
        sample_size: 0,
        industry_avg_uptime: 85,
        industry_avg_maintenance_efficiency: 70,
        industry_avg_maintenance_cost: 25,
        industry_avg_emergency_rate: 10,
        performance_ranking: "unknown",
        comparison_notes: "Insufficient data for benchmarking",
      };
    }
  }

  /**
   * Get peer comparison within the same building using actual database schema
   */
  private async getPeerComparison(
    buildingId: number,
    equipmentType: string,
    equipmentId: number,
    currentScore: number
  ): Promise<any> {
    try {
      const peerStats = await database.query(
        `SELECT 
          e.id,
          e.name,
          COUNT(em.id) as total_maintenance,
          COUNT(CASE WHEN em.maintenance_type = 'preventive' THEN 1 END) as preventive_maintenance,
          COUNT(CASE WHEN em.maintenance_type = 'predictive' THEN 1 END) as predictive_maintenance,
          COUNT(CASE WHEN em.maintenance_type = 'emergency' THEN 1 END) as emergency_maintenance,
          COUNT(CASE WHEN em.maintenance_type = 'corrective' THEN 1 END) as corrective_maintenance,
          COALESCE(SUM(em.downtime_minutes), 0) as total_downtime,
          COALESCE(AVG(em.cost), 0) as avg_maintenance_cost,
          COALESCE(SUM(em.cost), 0) as total_maintenance_cost,
          TIMESTAMPDIFF(HOUR, 
            COALESCE(e.installation_date, e.created_at), 
            NOW()
          ) as operational_hours,
          COUNT(DISTINCT a.id) as total_alerts,
          COUNT(CASE WHEN a.severity = 'critical' THEN 1 END) as critical_alerts,
          e.status as equipment_status,
          e.installation_date
        FROM equipment e
        LEFT JOIN equipment_maintenance em ON e.id = em.equipment_id 
          AND em.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
          AND em.status IN ('completed', 'in_progress')
        LEFT JOIN alerts a ON e.id = a.equipment_id 
          AND a.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
        WHERE e.building_id = ? AND e.equipment_type = ? AND e.id != ? AND e.status = 'active'
        GROUP BY e.id, e.name, e.status, e.installation_date
        HAVING operational_hours > 0
        ORDER BY 
          CASE 
            WHEN operational_hours > 0 AND total_downtime > 0
            THEN ((operational_hours - (total_downtime/60)) / operational_hours)
            ELSE 0.95 
          END DESC`,
        [buildingId, equipmentType, equipmentId]
      );

      const calculations = peerStats.map((peer) => {
        const uptime =
          peer.operational_hours > 0 && peer.total_downtime > 0
            ? ((peer.operational_hours - peer.total_downtime / 60) /
                peer.operational_hours) *
              100
            : 95;
        const proactiveMaintenance =
          (peer.preventive_maintenance || 0) +
          (peer.predictive_maintenance || 0);
        const maintenanceEfficiency =
          peer.total_maintenance > 0
            ? (proactiveMaintenance / peer.total_maintenance) * 100
            : 70;
        const costPerHour =
          peer.operational_hours > 0
            ? peer.total_maintenance_cost / peer.operational_hours
            : 0;
        const emergencyRate =
          peer.total_maintenance > 0
            ? (peer.emergency_maintenance / peer.total_maintenance) * 100
            : 0;

        return {
          ...peer,
          uptime_percentage: Math.round(uptime * 100) / 100,
          maintenance_efficiency: Math.round(maintenanceEfficiency * 100) / 100,
          cost_per_operational_hour: Math.round(costPerHour * 100) / 100,
          emergency_rate: Math.round(emergencyRate * 100) / 100,
          age_years: peer.installation_date
            ? Math.floor(
                (Date.now() - new Date(peer.installation_date).getTime()) /
                  (1000 * 60 * 60 * 24 * 365)
              )
            : null,
        };
      });

      const avgPeerUptime =
        calculations.length > 0
          ? calculations.reduce(
              (sum, peer) => sum + peer.uptime_percentage,
              0
            ) / calculations.length
          : 85;

      const avgPeerEfficiency =
        calculations.length > 0
          ? calculations.reduce(
              (sum, peer) => sum + peer.maintenance_efficiency,
              0
            ) / calculations.length
          : 70;

      return {
        peer_count: calculations.length,
        peer_equipment: calculations.slice(0, 5), // Top 5 performers
        avg_peer_uptime: Math.round(avgPeerUptime * 100) / 100,
        avg_peer_efficiency: Math.round(avgPeerEfficiency * 100) / 100,
        ranking_position: this.calculateRankingPosition(
          currentScore,
          calculations
        ),
        performance_gap: Math.round((currentScore - avgPeerUptime) * 100) / 100,
        efficiency_gap:
          Math.round((currentScore - avgPeerEfficiency) * 100) / 100,
      };
    } catch (error) {
      logger.error("Error getting peer comparison:", error);
      return {
        peer_count: 0,
        peer_equipment: [],
        avg_peer_uptime: 85,
        avg_peer_efficiency: 70,
        ranking_position: "unknown",
        performance_gap: 0,
        efficiency_gap: 0,
      };
    }
  }

  /**
   * Generate benchmark comparison notes
   */
  private generateBenchmarkNotes(
    currentScore: number,
    benchmarks: any
  ): string {
    if (!benchmarks || benchmarks.sample_size === 0) {
      return "Insufficient industry data for meaningful comparison";
    }

    const industryAvg = benchmarks.industry_avg_uptime || 85;
    const gap = currentScore - industryAvg;

    if (gap > 10) {
      return `Excellent performance - ${Math.round(gap)}% above industry average. This equipment is a top performer.`;
    } else if (gap > 5) {
      return `Good performance - ${Math.round(gap)}% above industry average. Room for optimization to reach top quartile.`;
    } else if (gap > -5) {
      return `Average performance - within ${Math.abs(Math.round(gap))}% of industry average. Consider improvement initiatives.`;
    } else {
      return `Below average performance - ${Math.abs(Math.round(gap))}% below industry average. Immediate attention required.`;
    }
  }

  /**
   * Calculate ranking position among peers
   */
  private calculateRankingPosition(currentScore: number, peers: any[]): string {
    if (peers.length === 0) return "No peers available";

    const betterPeers = peers.filter(
      (peer) => peer.uptime_percentage > currentScore
    ).length;
    const totalPeers = peers.length + 1; // Include current equipment
    const position = betterPeers + 1;

    const percentile = Math.round(((totalPeers - position) / totalPeers) * 100);

    if (percentile >= 90) return `Top 10% (${position} of ${totalPeers})`;
    if (percentile >= 75) return `Top 25% (${position} of ${totalPeers})`;
    if (percentile >= 50) return `Top 50% (${position} of ${totalPeers})`;
    if (percentile >= 25) return `Bottom 50% (${position} of ${totalPeers})`;
    return `Bottom 25% (${position} of ${totalPeers})`;
  }

  /**
   * Generate intelligent performance recommendations based on real data
   */
  private generatePerformanceRecommendations(metrics: {
    performanceScore: number;
    uptime: number;
    maintenanceEfficiency: number;
    mtbfHours: number;
    mttrHours: number;
    failureCount: number;
    criticalAlerts: number;
    totalAlerts: number;
    alertResponseEfficiency: number;
    totalMaintenanceCost: number;
    totalOperationalHours: number;
    emergencyMaintenanceCount: number;
    preventiveMaintenanceCount: number;
  }): Array<{
    category: string;
    priority: "low" | "medium" | "high" | "critical";
    recommendation: string;
    impact: string;
    estimated_savings?: number;
    implementation_effort: "low" | "medium" | "high";
  }> {
    const recommendations: Array<{
      category: string;
      priority: "low" | "medium" | "high" | "critical";
      recommendation: string;
      impact: string;
      estimated_savings?: number;
      implementation_effort: "low" | "medium" | "high";
    }> = [];

    // Critical performance issues
    if (metrics.uptime < 85) {
      recommendations.push({
        category: "Reliability",
        priority: "critical",
        recommendation:
          "Immediate investigation required for poor uptime performance. Consider equipment replacement or major overhaul.",
        impact: "High risk of production losses and safety concerns",
        implementation_effort: "high",
      });
    }

    if (metrics.failureCount > 5) {
      recommendations.push({
        category: "Maintenance Strategy",
        priority: "critical",
        recommendation:
          "Excessive failure rate indicates need for comprehensive maintenance strategy review and possible equipment upgrade.",
        impact: "Significant operational disruption and increased costs",
        implementation_effort: "high",
      });
    }

    // High priority recommendations
    if (metrics.maintenanceEfficiency < 60) {
      const potentialSavings = metrics.emergencyMaintenanceCount * 1500 * 0.4; // Assume 40% reduction in emergency costs
      recommendations.push({
        category: "Maintenance Planning",
        priority: "high",
        recommendation: `Increase preventive maintenance frequency. Current ratio is ${Math.round(metrics.maintenanceEfficiency)}% preventive vs reactive.`,
        impact: "Reduce emergency maintenance costs and improve reliability",
        estimated_savings: potentialSavings,
        implementation_effort: "medium",
      });
    }

    if (metrics.mttrHours > 24) {
      recommendations.push({
        category: "Repair Efficiency",
        priority: "high",
        recommendation: `Mean Time To Repair (${Math.round(metrics.mttrHours)} hours) is excessive. Improve spare parts inventory and technician training.`,
        impact: "Reduce downtime and improve availability",
        implementation_effort: "medium",
      });
    }

    if (metrics.criticalAlerts > 3) {
      recommendations.push({
        category: "Monitoring",
        priority: "high",
        recommendation:
          "Multiple critical alerts indicate potential systemic issues. Review alert thresholds and implement predictive monitoring.",
        impact: "Prevent equipment failures and improve safety",
        implementation_effort: "medium",
      });
    }

    // Medium priority recommendations
    if (metrics.alertResponseEfficiency < 80) {
      recommendations.push({
        category: "Response Management",
        priority: "medium",
        recommendation: `Alert response rate is ${Math.round(metrics.alertResponseEfficiency)}%. Improve response procedures and staff training.`,
        impact: "Faster issue resolution and reduced escalation",
        implementation_effort: "low",
      });
    }

    if (metrics.mtbfHours < 2190) {
      // Less than 3 months
      recommendations.push({
        category: "Reliability Enhancement",
        priority: "medium",
        recommendation: `Mean Time Between Failures (${Math.round(metrics.mtbfHours)} hours) is below optimal. Consider condition-based monitoring.`,
        impact: "Extend equipment life and reduce failure frequency",
        implementation_effort: "medium",
      });
    }

    // Cost optimization recommendations
    if (metrics.totalOperationalHours > 0) {
      const costPerHour =
        metrics.totalMaintenanceCost / metrics.totalOperationalHours;
      if (costPerHour > 30) {
        const potentialSavings =
          (costPerHour - 25) * metrics.totalOperationalHours;
        recommendations.push({
          category: "Cost Optimization",
          priority: "medium",
          recommendation: `Maintenance cost per operational hour (${costPerHour.toFixed(2)}) is high. Review contractor rates and parts sourcing.`,
          impact: "Reduce operational costs while maintaining reliability",
          estimated_savings: potentialSavings,
          implementation_effort: "low",
        });
      }
    }

    // Performance optimization recommendations
    if (metrics.uptime >= 95 && metrics.uptime < 99) {
      recommendations.push({
        category: "Performance Optimization",
        priority: "medium",
        recommendation:
          "Good uptime performance. Consider implementing predictive analytics to achieve excellence (>99% uptime).",
        impact: "Achieve world-class equipment performance",
        implementation_effort: "medium",
      });
    }

    // Low priority recommendations for good performance
    if (metrics.performanceScore >= 85) {
      recommendations.push({
        category: "Continuous Improvement",
        priority: "low",
        recommendation:
          "Equipment performance is excellent. Focus on maintaining current practices and knowledge sharing.",
        impact: "Sustain high performance levels",
        implementation_effort: "low",
      });
    }

    if (
      metrics.preventiveMaintenanceCount > 0 &&
      metrics.emergencyMaintenanceCount === 0
    ) {
      recommendations.push({
        category: "Best Practice",
        priority: "low",
        recommendation:
          "Excellent preventive maintenance strategy. Consider this equipment as a benchmark for other assets.",
        impact: "Apply successful practices to other equipment",
        implementation_effort: "low",
      });
    }

    // If no specific issues found but score is low
    if (recommendations.length === 0 && metrics.performanceScore < 70) {
      recommendations.push({
        category: "General Performance",
        priority: "medium",
        recommendation:
          "Overall performance needs improvement. Conduct comprehensive equipment assessment to identify specific issues.",
        impact: "Improve overall equipment effectiveness",
        implementation_effort: "medium",
      });
    }

    // If performance is excellent but can be optimized
    if (metrics.performanceScore >= 90 && metrics.uptime > 98) {
      recommendations.push({
        category: "Excellence Maintenance",
        priority: "low",
        recommendation:
          "Outstanding performance! Consider extending maintenance intervals slightly to optimize costs while monitoring closely.",
        impact: "Optimize maintenance costs without compromising reliability",
        implementation_effort: "low",
      });
    }

    return recommendations;
  }

  /**
   * Get maintenance summary statistics using actual database schema
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
          COUNT(CASE WHEN alert_count.active_alerts > 0 THEN 1 END) as equipment_with_alerts,
          COUNT(CASE WHEN mp.risk_level = 'critical' THEN 1 END) as critical_maintenance_risk,
          COUNT(CASE WHEN mp.risk_level = 'high' THEN 1 END) as high_maintenance_risk
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
          WHERE status IN ('active', 'acknowledged')
          GROUP BY equipment_id
        ) alert_count ON e.id = alert_count.equipment_id
        LEFT JOIN (
          SELECT equipment_id, risk_level,
                 ROW_NUMBER() OVER (PARTITION BY equipment_id ORDER BY created_at DESC) as rn
          FROM maintenance_predictions
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        ) mp ON e.id = mp.equipment_id AND mp.rn = 1
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
          critical_maintenance_risk: 0,
          high_maintenance_risk: 0,
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
        critical_maintenance_risk: 0,
        high_maintenance_risk: 0,
      };
    }
  }
}

export default new EquipmentController();
