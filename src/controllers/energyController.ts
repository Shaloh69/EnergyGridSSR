import { Request, Response } from "express";
import {
  IEnergyConsumption,
  IEnergyConsumptionCreate,
  IEnergyConsumptionUpdate,
  IEnergyStats,
  IEnergyTrend,
} from "@/interfaces/IEnergyConsumption";
import { ApiResponse } from "@/interfaces/IResponse";
import {
  PaginatedResponse,
  PaginationQuery,
  DateRangeQuery,
} from "@/types/common";
import { database } from "@/config/database";
import { socketManager } from "@/config/socket";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";

interface EnergyQuery extends PaginationQuery, DateRangeQuery {
  buildingId?: string;
  energyType?: string;
}

interface EnergyTrendsQuery extends DateRangeQuery {
  interval?: string;
}

class EnergyController {
  /**
   * Helper method to safely parse string to number
   */
  private parseToNumber(value: string | undefined): number | null {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    const parsed = parseInt(trimmed);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Helper method to safely trim string and return valid string or null
   */
  private safelyTrimString(value: string | undefined): string | null {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Helper method to safely add string parameter to params array
   */
  private addStringParam(
    params: any[],
    condition: string,
    conditions: string[],
    value: string | undefined
  ): void {
    const trimmed = this.safelyTrimString(value);
    if (trimmed) {
      conditions.push(condition);
      params.push(trimmed);
    }
  }

  /**
   * Helper method to safely add number parameter to params array
   */
  private addNumberParam(
    params: any[],
    condition: string,
    conditions: string[],
    value: string | undefined
  ): void {
    const parsed = this.parseToNumber(value);
    if (parsed !== null) {
      conditions.push(condition);
      params.push(parsed);
    }
  }

  public getEnergyConsumption = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Starting getEnergyConsumption request");

      const {
        page = 1,
        limit = 20,
        sortBy = "recorded_at",
        sortOrder = "DESC",
        buildingId,
        energyType,
        startDate,
        endDate,
      } = req.query as EnergyQuery;

      // Parse and validate pagination
      const pageNum = Math.max(1, parseInt(page.toString()) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit.toString()) || 20)
      );
      const offset = (pageNum - 1) * limitNum;

      // Validate sortBy
      const allowedSortFields = [
        "recorded_at",
        "consumption_kwh",
        "cost_php",
        "demand_kw",
        "power_factor",
        "energy_type",
        "created_at",
      ];
      const safeSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "recorded_at";
      const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

      try {
        // Build query conditions
        const conditions: string[] = [];
        const params: any[] = [];

        // Fixed: Use helper methods to safely add parameters
        this.addNumberParam(
          params,
          "ec.building_id = ?",
          conditions,
          buildingId
        );
        this.addStringParam(
          params,
          "ec.energy_type = ?",
          conditions,
          energyType
        );
        this.addStringParam(
          params,
          "ec.recorded_at >= ?",
          conditions,
          startDate
        );
        this.addStringParam(params, "ec.recorded_at <= ?", conditions, endDate);

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM energy_consumption ec ${whereClause}`;
        logger.info("Executing count query with params:", {
          query: countQuery.substring(0, 100),
          paramsCount: params.length,
        });

        const countResult = await database.queryOne<{ total: number }>(
          countQuery,
          params
        );
        const totalItems = countResult?.total || 0;
        logger.info("Total energy records found:", totalItems);

        // Get data with enhanced information
        const dataQuery = `
          SELECT 
            ec.*,
            b.name as building_name,
            b.code as building_code,
            b.area_sqm as building_area,
            u.first_name,
            u.last_name,
            CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
            CASE 
              WHEN ec.power_factor >= 0.95 THEN 'excellent'
              WHEN ec.power_factor >= 0.90 THEN 'good'
              WHEN ec.power_factor >= 0.85 THEN 'fair'
              ELSE 'poor'
            END as power_factor_rating,
            CASE 
              WHEN b.area_sqm > 0 THEN ec.consumption_kwh / b.area_sqm
              ELSE NULL
            END as consumption_per_sqm
          FROM energy_consumption ec
          LEFT JOIN buildings b ON ec.building_id = b.id
          LEFT JOIN users u ON ec.created_by = u.id
          ${whereClause}
          ORDER BY ec.${safeSortBy} ${safeSortOrder}
          LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limitNum, offset];
        logger.info("Executing data query with params:", {
          query: dataQuery.substring(0, 100),
          paramsCount: dataParams.length,
        });

        const energyData = await database.query<IEnergyConsumption>(
          dataQuery,
          dataParams
        );
        logger.info("Energy records retrieved:", energyData.length);

        // Enhance energy data with additional statistics
        const enhancedData = await this.enhanceEnergyDataWithStats(energyData);

        // Build response
        const totalPages = Math.ceil(totalItems / limitNum);

        const response: ApiResponse<PaginatedResponse<IEnergyConsumption>> = {
          success: true,
          message: "Energy consumption data fetched successfully",
          data: {
            data: enhancedData,
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
          `Successfully returned ${enhancedData.length} energy records`
        );
        res.json(response);
      } catch (error) {
        logger.error("Error fetching energy consumption data:", error);
        throw new CustomError("Failed to fetch energy consumption data", 500);
      }
    }
  );

  public createEnergyReading = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const energyData = req.body as IEnergyConsumptionCreate;
      logger.info(
        "🚀 Creating energy reading for building:",
        energyData.building_id
      );

      // Validate required fields
      if (
        !energyData.building_id ||
        !energyData.consumption_kwh ||
        !energyData.recorded_at
      ) {
        throw new CustomError(
          "building_id, consumption_kwh, and recorded_at are required",
          400
        );
      }

      // Validate numeric values
      if (isNaN(energyData.building_id) || energyData.consumption_kwh < 0) {
        throw new CustomError("Invalid building_id or consumption_kwh", 400);
      }

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name, area_sqm FROM buildings WHERE id = ? AND status = 'active'",
          [energyData.building_id]
        );

        if (!building) {
          throw new CustomError("Building not found or inactive", 404);
        }

        // Check for duplicate readings (same building, same timestamp)
        const existingReading = await database.queryOne(
          "SELECT id FROM energy_consumption WHERE building_id = ? AND recorded_at = ?",
          [energyData.building_id, energyData.recorded_at]
        );

        if (existingReading) {
          throw new CustomError(
            "Energy reading for this timestamp already exists",
            409
          );
        }

        // Insert new energy reading
        const insertQuery = `
          INSERT INTO energy_consumption 
          (building_id, consumption_kwh, cost_php, recorded_at, meter_reading,
           demand_kw, power_factor, energy_type, created_by) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          energyData.building_id,
          energyData.consumption_kwh,
          energyData.cost_php || null,
          energyData.recorded_at,
          energyData.meter_reading || null,
          energyData.demand_kw || null,
          energyData.power_factor || null,
          energyData.energy_type || "electrical",
          req.user?.id || null,
        ];

        const insertId = await database.insert(insertQuery, insertParams);
        logger.info("Energy reading created with ID:", insertId);

        // Get the created energy reading with enhanced information
        const newReading = await database.queryOne<IEnergyConsumption>(
          `SELECT 
            ec.*,
            b.name as building_name,
            b.code as building_code,
            u.first_name,
            u.last_name,
            CONCAT(u.first_name, ' ', u.last_name) as created_by_name
          FROM energy_consumption ec
          LEFT JOIN buildings b ON ec.building_id = b.id
          LEFT JOIN users u ON ec.created_by = u.id
          WHERE ec.id = ?`,
          [insertId]
        );

        if (!newReading) {
          throw new CustomError(
            "Failed to retrieve created energy reading",
            500
          );
        }

        // Emit real-time update
        socketManager.emitToBuilding(
          energyData.building_id.toString(),
          "newEnergyReading",
          newReading
        );

        logger.info(
          `Energy reading created for building ${building.name}: ${energyData.consumption_kwh} kWh`
        );

        const response: ApiResponse<IEnergyConsumption> = {
          success: true,
          message: "Energy reading created successfully",
          data: newReading,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error creating energy reading:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to create energy reading", 500);
      }
    }
  );

  public updateEnergyReading = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updateData = req.body as IEnergyConsumptionUpdate;
      logger.info("🚀 Updating energy reading ID:", id);

      // Fixed: Properly parse and validate ID
      const readingId = this.parseToNumber(id);
      if (readingId === null) {
        throw new CustomError("Invalid energy reading ID", 400);
      }

      try {
        // Check if energy reading exists
        const existingReading = await database.queryOne<IEnergyConsumption>(
          "SELECT * FROM energy_consumption WHERE id = ?",
          [readingId]
        );

        if (!existingReading) {
          throw new CustomError("Energy reading not found", 404);
        }

        // Build update query dynamically
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        const allowedFields = [
          "consumption_kwh",
          "cost_php",
          "recorded_at",
          "meter_reading",
          "demand_kw",
          "power_factor",
          "energy_type",
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

        // Validate numeric values if being updated
        if (
          updateData.consumption_kwh !== undefined &&
          updateData.consumption_kwh < 0
        ) {
          throw new CustomError("consumption_kwh cannot be negative", 400);
        }

        if (
          updateData.power_factor !== undefined &&
          (updateData.power_factor < 0 || updateData.power_factor > 1)
        ) {
          throw new CustomError("power_factor must be between 0 and 1", 400);
        }

        // Check for duplicate timestamp if being updated
        if (
          updateData.recorded_at &&
          updateData.recorded_at !== existingReading.recorded_at
        ) {
          const duplicateReading = await database.queryOne(
            "SELECT id FROM energy_consumption WHERE building_id = ? AND recorded_at = ? AND id != ?",
            [existingReading.building_id, updateData.recorded_at, readingId]
          );

          if (duplicateReading) {
            throw new CustomError(
              "Energy reading for this timestamp already exists",
              409
            );
          }
        }

        // Add reading ID to parameters
        updateValues.push(readingId);

        const updateQuery = `
          UPDATE energy_consumption 
          SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;

        const affectedRows = await database.execute(updateQuery, updateValues);
        logger.info("Update affected rows:", affectedRows);

        if (affectedRows === 0) {
          throw new CustomError("Failed to update energy reading", 500);
        }

        // Fetch updated record with enhanced information
        const updatedReading = await database.queryOne<IEnergyConsumption>(
          `SELECT 
            ec.*,
            b.name as building_name,
            b.code as building_code,
            u.first_name,
            u.last_name,
            CONCAT(u.first_name, ' ', u.last_name) as created_by_name
          FROM energy_consumption ec
          LEFT JOIN buildings b ON ec.building_id = b.id
          LEFT JOIN users u ON ec.created_by = u.id
          WHERE ec.id = ?`,
          [readingId]
        );

        // Emit real-time update
        socketManager.emitToBuilding(
          existingReading.building_id.toString(),
          "energyReadingUpdated",
          updatedReading
        );

        logger.info(
          `Energy reading ${id} updated successfully: ${updateData.consumption_kwh || existingReading.consumption_kwh} kWh`
        );

        const response: ApiResponse<IEnergyConsumption> = {
          success: true,
          message: "Energy reading updated successfully",
          data: updatedReading!,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error updating energy reading:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to update energy reading", 500);
      }
    }
  );

  public deleteEnergyReading = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Deleting energy reading ID:", id);

      // Fixed: Properly parse and validate ID
      const readingId = this.parseToNumber(id);
      if (readingId === null) {
        throw new CustomError("Invalid energy reading ID", 400);
      }

      try {
        // Check if energy reading exists
        const existingReading = await database.queryOne<IEnergyConsumption>(
          "SELECT * FROM energy_consumption WHERE id = ?",
          [readingId]
        );

        if (!existingReading) {
          throw new CustomError("Energy reading not found", 404);
        }

        // Check if this reading is referenced in any alerts or analysis
        const dependentRecords = await database.queryOne<{ count: number }>(
          "SELECT COUNT(*) as count FROM alerts WHERE energy_reading_id = ?",
          [readingId]
        );

        if ((dependentRecords?.count || 0) > 0) {
          throw new CustomError(
            "Cannot delete energy reading that is referenced by alerts or analysis. Consider marking it as invalid instead.",
            400
          );
        }

        // Delete reading
        const affectedRows = await database.execute(
          "DELETE FROM energy_consumption WHERE id = ?",
          [readingId]
        );

        if (affectedRows === 0) {
          throw new CustomError("Failed to delete energy reading", 500);
        }

        // Emit real-time update
        socketManager.emitToBuilding(
          existingReading.building_id.toString(),
          "energyReadingDeleted",
          { id: readingId, building_id: existingReading.building_id }
        );

        logger.info(
          `Energy reading ${id} deleted successfully (${existingReading.consumption_kwh} kWh)`
        );

        const response: ApiResponse = {
          success: true,
          message: "Energy reading deleted successfully",
        };

        res.json(response);
      } catch (error) {
        logger.error("Error deleting energy reading:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to delete energy reading", 500);
      }
    }
  );

  public getEnergyStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      const { startDate, endDate } = req.query as DateRangeQuery;
      logger.info("🚀 Getting energy statistics for building:", buildingId);

      // Fixed: Properly parse and validate buildingId
      const id = this.parseToNumber(buildingId);
      if (id === null) {
        throw new CustomError("Invalid building ID", 400);
      }

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name, area_sqm FROM buildings WHERE id = ?",
          [id]
        );

        if (!building) {
          throw new CustomError("Building not found", 404);
        }

        // Build query conditions
        const conditions = ["building_id = ?"];
        const params = [id];

        // Fixed: Use helper methods to safely add date parameters
        this.addStringParam(params, "recorded_at >= ?", conditions, startDate);
        this.addStringParam(params, "recorded_at <= ?", conditions, endDate);

        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        // Get comprehensive energy statistics
        const [basicStats, trendData, performanceMetrics] = await Promise.all([
          // Basic statistics
          database.queryOne<any>(
            `SELECT 
              SUM(consumption_kwh) as total_consumption,
              AVG(consumption_kwh) as average_consumption,
              MIN(consumption_kwh) as min_consumption,
              MAX(consumption_kwh) as max_consumption,
              MAX(demand_kw) as peak_demand,
              SUM(cost_php) as total_cost,
              AVG(power_factor) as average_power_factor,
              MIN(power_factor) as min_power_factor,
              MAX(power_factor) as max_power_factor,
              COUNT(*) as reading_count,
              MIN(recorded_at) as period_start,
              MAX(recorded_at) as period_end
            FROM energy_consumption 
            ${whereClause}`,
            params
          ),

          // Trend data (last 30 days)
          database.query<any>(
            `SELECT 
              DATE(recorded_at) as date,
              SUM(consumption_kwh) as consumption,
              AVG(power_factor) as avg_power_factor,
              COUNT(*) as readings
            FROM energy_consumption 
            ${whereClause} AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(recorded_at)
            ORDER BY date ASC`,
            params
          ),

          // Performance metrics
          this.calculatePerformanceMetrics(id, params, whereClause),
        ]);

        // Calculate efficiency score
        const efficiencyScore = this.calculateEfficiencyScore(basicStats);

        // Calculate consumption per square meter
        const consumptionPerSqm =
          building.area_sqm && basicStats?.total_consumption
            ? basicStats.total_consumption / building.area_sqm
            : null;

        const stats: IEnergyStats & any = {
          total_consumption: basicStats?.total_consumption || 0,
          average_consumption: basicStats?.average_consumption || 0,
          min_consumption: basicStats?.min_consumption || 0,
          max_consumption: basicStats?.max_consumption || 0,
          peak_demand: basicStats?.peak_demand || 0,
          total_cost: basicStats?.total_cost || 0,
          average_power_factor: basicStats?.average_power_factor || 0,
          min_power_factor: basicStats?.min_power_factor || 0,
          max_power_factor: basicStats?.max_power_factor || 0,
          efficiency_score: efficiencyScore,
          consumption_per_sqm: consumptionPerSqm,
          reading_count: basicStats?.reading_count,
          period: {
            start: basicStats?.period_start,
            end: basicStats?.period_end,
          },
          trends: trendData,
          performance_metrics: performanceMetrics,
          building_info: {
            id: building.id,
            name: building.name,
            area_sqm: building.area_sqm,
          },
        };

        logger.info(
          `Energy statistics calculated for building ${building.name}: ${basicStats?.reading_count} readings`
        );

        const response: ApiResponse<typeof stats> = {
          success: true,
          message: "Energy statistics fetched successfully",
          data: stats,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching energy statistics:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch energy statistics", 500);
      }
    }
  );

  public getEnergyTrends = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      const {
        startDate,
        endDate,
        interval = "daily",
      } = req.query as EnergyTrendsQuery;
      logger.info("🚀 Getting energy trends for building:", buildingId);

      // Fixed: Properly parse and validate buildingId
      const id = this.parseToNumber(buildingId);
      if (id === null) {
        throw new CustomError("Invalid building ID", 400);
      }

      // Validate interval
      const validIntervals = ["hourly", "daily", "weekly", "monthly"];
      if (!validIntervals.includes(interval)) {
        throw new CustomError(
          "Invalid interval. Use: hourly, daily, weekly, or monthly",
          400
        );
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

        let dateFormat: string;
        let groupBy: string;

        switch (interval) {
          case "hourly":
            dateFormat = "%Y-%m-%d %H:00:00";
            groupBy = 'DATE_FORMAT(recorded_at, "%Y-%m-%d %H:00:00")';
            break;
          case "daily":
            dateFormat = "%Y-%m-%d";
            groupBy = "DATE(recorded_at)";
            break;
          case "weekly":
            dateFormat = "%Y-%u";
            groupBy = "YEARWEEK(recorded_at)";
            break;
          case "monthly":
            dateFormat = "%Y-%m";
            groupBy = 'DATE_FORMAT(recorded_at, "%Y-%m")';
            break;
          default:
            dateFormat = "%Y-%m-%d";
            groupBy = "DATE(recorded_at)";
        }

        const conditions = ["building_id = ?"];
        const params = [id];

        // Fixed: Use helper methods to safely add date parameters
        this.addStringParam(params, "recorded_at >= ?", conditions, startDate);
        this.addStringParam(params, "recorded_at <= ?", conditions, endDate);

        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        const trends = await database.query<IEnergyTrend>(
          `SELECT 
            DATE_FORMAT(recorded_at, '${dateFormat}') as date,
            SUM(consumption_kwh) as consumption,
            SUM(cost_php) as cost,
            MAX(demand_kw) as demand,
            AVG(power_factor) as avg_power_factor,
            COUNT(*) as reading_count
          FROM energy_consumption 
          ${whereClause}
          GROUP BY ${groupBy}
          ORDER BY recorded_at ASC`,
          params
        );

        // Calculate additional trend metrics
        const enhancedTrends = trends.map((trend, index) => ({
          ...trend,
          period_type: interval,
          growth_rate:
            index > 0 && trends[index - 1].consumption > 0
              ? ((trend.consumption - trends[index - 1].consumption) /
                  trends[index - 1].consumption) *
                100
              : 0,
        }));

        logger.info(
          `Energy trends calculated for building ${building.name}: ${trends.length} data points (${interval})`
        );

        const response: ApiResponse<typeof enhancedTrends> = {
          success: true,
          message: "Energy trends fetched successfully",
          data: enhancedTrends,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching energy trends:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch energy trends", 500);
      }
    }
  );

  public getBuildingComparison = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { startDate, endDate } = req.query as DateRangeQuery;
      logger.info("🚀 Getting building energy comparison");

      try {
        const conditions: string[] = [];
        const params: any[] = [];

        // Fixed: Use helper methods to safely add date parameters
        this.addStringParam(
          params,
          "ec.recorded_at >= ?",
          conditions,
          startDate
        );
        this.addStringParam(params, "ec.recorded_at <= ?", conditions, endDate);

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const comparison = await database.query<any>(
          `SELECT 
            b.id,
            b.name as building_name,
            b.code as building_code,
            b.area_sqm,
            b.building_type,
            SUM(ec.consumption_kwh) as total_consumption,
            AVG(ec.consumption_kwh) as avg_consumption,
            SUM(ec.cost_php) as total_cost,
            AVG(ec.power_factor) as avg_power_factor,
            MAX(ec.demand_kw) as peak_demand,
            COUNT(ec.id) as reading_count,
            CASE 
              WHEN b.area_sqm > 0 THEN SUM(ec.consumption_kwh) / b.area_sqm
              ELSE NULL
            END as consumption_per_sqm
          FROM buildings b
          LEFT JOIN energy_consumption ec ON b.id = ec.building_id
          ${whereClause}
          GROUP BY b.id, b.name, b.code, b.area_sqm, b.building_type
          HAVING total_consumption > 0
          ORDER BY total_consumption DESC`,
          params
        );

        // Calculate efficiency rankings
        const enhancedComparison = comparison.map((building, index) => ({
          ...building,
          rank: index + 1,
          efficiency_score: this.calculateEfficiencyScore(building),
        }));

        logger.info(
          `Building energy comparison generated: ${enhancedComparison.length} buildings`
        );

        const response: ApiResponse<typeof enhancedComparison> = {
          success: true,
          message: "Building energy comparison fetched successfully",
          data: enhancedComparison,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching building energy comparison:", error);
        throw new CustomError(
          "Failed to fetch building energy comparison",
          500
        );
      }
    }
  );

  // Private helper methods

  /**
   * Enhance energy data with additional statistics
   */
  private async enhanceEnergyDataWithStats(
    energyData: IEnergyConsumption[]
  ): Promise<IEnergyConsumption[]> {
    if (energyData.length === 0) return energyData;

    try {
      return energyData.map((reading) => ({
        ...reading,
        // Add computed fields if needed
      }));
    } catch (error) {
      logger.error("Error enhancing energy data with stats:", error);
      return energyData;
    }
  }

  /**
   * Calculate efficiency score based on various metrics
   */
  private calculateEfficiencyScore(stats: any): number {
    if (!stats) return 0;

    let score = 0;

    // Power factor score (40% weight)
    if (stats.average_power_factor) {
      if (stats.average_power_factor >= 0.95) score += 40;
      else if (stats.average_power_factor >= 0.9) score += 35;
      else if (stats.average_power_factor >= 0.85) score += 30;
      else if (stats.average_power_factor >= 0.8) score += 20;
      else score += 10;
    }

    // Demand consistency score (30% weight)
    if (stats.peak_demand && stats.average_consumption) {
      const demandRatio = stats.peak_demand / stats.average_consumption;
      if (demandRatio <= 1.2) score += 30;
      else if (demandRatio <= 1.5) score += 25;
      else if (demandRatio <= 2.0) score += 20;
      else score += 10;
    }

    // Consumption variance score (30% weight)
    if (
      stats.min_consumption &&
      stats.max_consumption &&
      stats.average_consumption
    ) {
      const variance =
        (stats.max_consumption - stats.min_consumption) /
        stats.average_consumption;
      if (variance <= 0.2) score += 30;
      else if (variance <= 0.5) score += 25;
      else if (variance <= 1.0) score += 20;
      else score += 10;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(
    buildingId: number,
    params: any[],
    whereClause: string
  ): Promise<any> {
    try {
      const metrics = await database.queryOne<any>(
        `SELECT 
          STDDEV(consumption_kwh) as consumption_variance,
          STDDEV(power_factor) as power_factor_variance,
          COUNT(CASE WHEN power_factor < 0.85 THEN 1 END) as poor_power_factor_count,
          COUNT(CASE WHEN power_factor >= 0.95 THEN 1 END) as excellent_power_factor_count
        FROM energy_consumption 
        ${whereClause}`,
        params
      );

      return {
        consumption_stability: metrics?.consumption_variance
          ? Math.max(0, 100 - metrics.consumption_variance / 10)
          : 100,
        power_factor_consistency: metrics?.power_factor_variance
          ? Math.max(0, 100 - metrics.power_factor_variance * 1000)
          : 100,
        quality_readings_percentage:
          metrics && params.length > 0
            ? (metrics.excellent_power_factor_count /
                (metrics.excellent_power_factor_count +
                  metrics.poor_power_factor_count || 1)) *
              100
            : 0,
      };
    } catch (error) {
      logger.error("Error calculating performance metrics:", error);
      return {
        consumption_stability: 0,
        power_factor_consistency: 0,
        quality_readings_percentage: 0,
      };
    }
  }
}

export default new EnergyController();
