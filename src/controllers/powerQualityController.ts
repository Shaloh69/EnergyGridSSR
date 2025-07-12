import { Request, Response } from "express";
import {
  IPowerQuality,
  IPowerQualityCreate,
  IPowerQualityStats,
} from "@/interfaces/IPowerQuality";
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

interface PowerQualityQuery extends PaginationQuery, DateRangeQuery {
  buildingId?: string;
}

interface PowerQualityEventQuery extends DateRangeQuery {
  eventType?: string;
  severity?: string;
}

class PowerQualityController {
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
    if (parsed !== undefined) {
      conditions.push(condition);
      params.push(parsed);
    }
  }

  public getPowerQualityData = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Starting getPowerQualityData request");

      const {
        page = 1,
        limit = 20,
        sortBy = "recorded_at",
        sortOrder = "DESC",
        buildingId,
        startDate,
        endDate,
      } = req.query as PowerQualityQuery;

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
        "thd_voltage",
        "thd_current",
        "voltage_unbalance",
        "current_unbalance",
        "frequency",
        "power_factor",
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
          "pq.building_id = ?",
          conditions,
          buildingId
        );
        this.addStringParam(
          params,
          "pq.recorded_at >= ?",
          conditions,
          startDate
        );
        this.addStringParam(params, "pq.recorded_at <= ?", conditions, endDate);

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM power_quality pq ${whereClause}`;
        const countResult = await database.queryOne<{ total: number }>(
          countQuery,
          params
        );
        const totalItems = countResult?.total || 0;

        // Get data with enhanced information
        const dataQuery = `
          SELECT 
            pq.*,
            b.name as building_name,
            b.code as building_code,
            u.first_name,
            u.last_name,
            CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
            CASE 
              WHEN pq.thd_voltage <= 5 AND pq.thd_current <= 8 AND 
                   pq.voltage_unbalance <= 2 AND pq.power_factor >= 0.95 
              THEN 'excellent'
              WHEN pq.thd_voltage <= 8 AND pq.thd_current <= 15 AND 
                   pq.voltage_unbalance <= 3 AND pq.power_factor >= 0.85 
              THEN 'good'
              WHEN pq.thd_voltage <= 12 AND pq.thd_current <= 20 AND 
                   pq.voltage_unbalance <= 4 AND pq.power_factor >= 0.80 
              THEN 'fair'
              ELSE 'poor'
            END as quality_rating
          FROM power_quality pq
          LEFT JOIN buildings b ON pq.building_id = b.id
          LEFT JOIN users u ON pq.created_by = u.id
          ${whereClause}
          ORDER BY pq.${safeSortBy} ${safeSortOrder}
          LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limitNum, offset];
        const powerQualityData = await database.query<IPowerQuality>(
          dataQuery,
          dataParams
        );

        // Enhance power quality data with additional analysis
        const enhancedData =
          await this.enhancePowerQualityDataWithAnalysis(powerQualityData);

        // Build response
        const totalPages = Math.ceil(totalItems / limitNum);

        const response: ApiResponse<PaginatedResponse<IPowerQuality>> = {
          success: true,
          message: "Power quality data fetched successfully",
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
          `Successfully returned ${enhancedData.length} power quality records`
        );
        res.json(response);
      } catch (error) {
        logger.error("Error fetching power quality data:", error);
        throw new CustomError("Failed to fetch power quality data", 500);
      }
    }
  );

  public createPowerQualityReading = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pqData = req.body as IPowerQualityCreate;
      logger.info(
        "🚀 Creating power quality reading for building:",
        pqData.building_id
      );

      // Validate required fields
      if (!pqData.building_id || !pqData.recorded_at) {
        throw new CustomError("building_id and recorded_at are required", 400);
      }

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name FROM buildings WHERE id = ? AND status = 'active'",
          [pqData.building_id]
        );

        if (!building) {
          throw new CustomError("Building not found or inactive", 404);
        }

        // Check for duplicate readings (same building, same timestamp)
        const existingReading = await database.queryOne(
          "SELECT id FROM power_quality WHERE building_id = ? AND recorded_at = ?",
          [pqData.building_id, pqData.recorded_at]
        );

        if (existingReading) {
          throw new CustomError(
            "Power quality reading for this timestamp already exists",
            409
          );
        }

        // Insert new power quality reading
        const insertQuery = `
          INSERT INTO power_quality 
          (building_id, recorded_at, voltage_l1, voltage_l2, voltage_l3,
           current_l1, current_l2, current_l3, thd_voltage, thd_current,
           voltage_unbalance, current_unbalance, frequency, power_factor, created_by) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          pqData.building_id,
          pqData.recorded_at,
          pqData.voltage_l1 || null,
          pqData.voltage_l2 || null,
          pqData.voltage_l3 || null,
          pqData.current_l1 || null,
          pqData.current_l2 || null,
          pqData.current_l3 || null,
          pqData.thd_voltage || null,
          pqData.thd_current || null,
          pqData.voltage_unbalance || null,
          pqData.current_unbalance || null,
          pqData.frequency || null,
          pqData.power_factor || null,
          req.user?.id || null,
        ];

        const insertId = await database.insert(insertQuery, insertParams);
        logger.info("Power quality reading created with ID:", insertId);

        // Get the created reading with enhanced information
        const newReading = await database.queryOne<IPowerQuality>(
          `SELECT 
            pq.*,
            b.name as building_name,
            b.code as building_code
          FROM power_quality pq
          LEFT JOIN buildings b ON pq.building_id = b.id
          WHERE pq.id = ?`,
          [insertId]
        );

        if (!newReading) {
          throw new CustomError(
            "Failed to retrieve created power quality reading",
            500
          );
        }

        // Emit real-time update
        socketManager.emitToBuilding(
          pqData.building_id.toString(),
          "newPowerQualityReading",
          newReading
        );

        logger.info(
          `Power quality reading created for building ${building.name}`
        );

        const response: ApiResponse<IPowerQuality> = {
          success: true,
          message: "Power quality reading created successfully",
          data: newReading,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error creating power quality reading:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to create power quality reading", 500);
      }
    }
  );

  public getPowerQualityStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      const { startDate, endDate } = req.query as DateRangeQuery;
      logger.info(
        "🚀 Getting power quality statistics for building:",
        buildingId
      );

      // Fixed: Use parseToNumber helper method
      const id = this.parseToNumber(buildingId);
      if (id === undefined) {
        throw new CustomError("Invalid building ID", 400);
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

        // Build query conditions
        const conditions = ["building_id = ?"];
        const params = [id];

        // Fixed: Use helper methods to safely add date parameters
        this.addStringParam(params, "recorded_at >= ?", conditions, startDate);
        this.addStringParam(params, "recorded_at <= ?", conditions, endDate);

        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        // Get comprehensive power quality statistics
        const [basicStats, violationStats, trendData, complianceStats] =
          await Promise.all([
            // Basic statistics
            database.queryOne<any>(
              `SELECT 
                COUNT(*) as total_readings,
                AVG(thd_voltage) as avg_thd_voltage,
                MAX(thd_voltage) as max_thd_voltage,
                AVG(thd_current) as avg_thd_current,
                MAX(thd_current) as max_thd_current,
                AVG(voltage_unbalance) as avg_voltage_unbalance,
                MAX(voltage_unbalance) as max_voltage_unbalance,
                AVG(power_factor) as avg_power_factor,
                MIN(power_factor) as min_power_factor,
                AVG(frequency) as avg_frequency,
                MIN(frequency) as min_frequency,
                MAX(frequency) as max_frequency,
                MIN(recorded_at) as period_start,
                MAX(recorded_at) as period_end
              FROM power_quality 
              ${whereClause}`,
              params
            ),

            // Violation statistics
            database.queryOne<any>(
              `SELECT 
                COUNT(CASE WHEN thd_voltage > 8 THEN 1 END) as thd_voltage_violations,
                COUNT(CASE WHEN thd_current > 15 THEN 1 END) as thd_current_violations,
                COUNT(CASE WHEN voltage_unbalance > 3 THEN 1 END) as voltage_unbalance_violations,
                COUNT(CASE WHEN power_factor < 0.8 THEN 1 END) as power_factor_violations,
                COUNT(CASE WHEN frequency < 49.5 OR frequency > 50.5 THEN 1 END) as frequency_violations
              FROM power_quality 
              ${whereClause}`,
              params
            ),

            // Trend data (last 30 days)
            database.query<any>(
              `SELECT 
                DATE(recorded_at) as date,
                AVG(thd_voltage) as avg_thd_voltage,
                AVG(thd_current) as avg_thd_current,
                AVG(voltage_unbalance) as avg_voltage_unbalance,
                AVG(power_factor) as avg_power_factor,
                COUNT(*) as readings
              FROM power_quality 
              ${whereClause} AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              GROUP BY DATE(recorded_at)
              ORDER BY date ASC`,
              params
            ),

            // Compliance statistics
            this.calculateComplianceStats(id, params, whereClause),
          ]);

        // Calculate quality score
        const qualityScore = this.calculatePowerQualityScore(basicStats);

        const stats: IPowerQualityStats & any = {
          thd_voltage_avg: basicStats?.avg_thd_voltage || 0,
          thd_voltage_max: basicStats?.max_thd_voltage || 0,
          thd_current_avg: basicStats?.avg_thd_current || 0,
          thd_current_max: basicStats?.max_thd_current || 0,
          voltage_unbalance_avg: basicStats?.avg_voltage_unbalance || 0,
          voltage_unbalance_max: basicStats?.max_voltage_unbalance || 0,
          power_factor_avg: basicStats?.avg_power_factor || 0,
          power_factor_min: basicStats?.min_power_factor || 0,
          frequency_avg: basicStats?.avg_frequency || 0,
          frequency_min: basicStats?.min_frequency || 0,
          frequency_max: basicStats?.max_frequency || 0,
          quality_score: qualityScore,
          total_readings: basicStats?.total_readings || 0,
          period: {
            start: basicStats?.period_start,
            end: basicStats?.period_end,
          },
          violations: violationStats,
          trends: trendData,
          compliance: complianceStats,
          building_info: {
            id: building.id,
            name: building.name,
          },
        };

        logger.info(
          `Power quality statistics calculated for building ${building.name}: ${basicStats?.total_readings} readings`
        );

        const response: ApiResponse<typeof stats> = {
          success: true,
          message: "Power quality statistics fetched successfully",
          data: stats,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching power quality statistics:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch power quality statistics", 500);
      }
    }
  );

  public getPowerQualityEvents = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      const { startDate, endDate, eventType, severity } =
        req.query as PowerQualityEventQuery;
      logger.info("🚀 Getting power quality events for building:", buildingId);

      // Fixed: Use parseToNumber helper method
      const id = this.parseToNumber(buildingId);
      if (id === undefined) {
        throw new CustomError("Invalid building ID", 400);
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

        const conditions = ["building_id = ?"];
        const params = [id];

        // Fixed: Use helper methods to safely add date parameters
        this.addStringParam(params, "recorded_at >= ?", conditions, startDate);
        this.addStringParam(params, "recorded_at <= ?", conditions, endDate);

        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        // Detect power quality events using enhanced analysis
        const eventsQuery = `
          SELECT *,
            CASE 
              WHEN voltage_l1 < 207 OR voltage_l2 < 207 OR voltage_l3 < 207 
              THEN 'Voltage Sag'
              WHEN voltage_l1 > 253 OR voltage_l2 > 253 OR voltage_l3 > 253 
              THEN 'Voltage Swell'
              WHEN voltage_l1 < 196 OR voltage_l1 > 264 OR
                   voltage_l2 < 196 OR voltage_l2 > 264 OR
                   voltage_l3 < 196 OR voltage_l3 > 264
              THEN 'Voltage Out of Range'
              WHEN thd_voltage > 8 THEN 'High Voltage THD'
              WHEN thd_current > 15 THEN 'High Current THD'
              WHEN frequency < 49.5 OR frequency > 50.5 THEN 'Frequency Deviation'
              WHEN power_factor < 0.85 THEN 'Low Power Factor'
              WHEN voltage_unbalance > 3 THEN 'Voltage Unbalance'
              ELSE NULL
            END as event_type,
            CASE 
              WHEN thd_voltage > 15 OR thd_current > 25 OR
                   voltage_unbalance > 5 OR power_factor < 0.75 OR
                   frequency < 49 OR frequency > 51
              THEN 'critical'
              WHEN thd_voltage > 12 OR thd_current > 20 OR
                   voltage_unbalance > 4 OR power_factor < 0.80
              THEN 'high'
              WHEN thd_voltage > 8 OR thd_current > 15 OR
                   voltage_unbalance > 3 OR power_factor < 0.85 OR
                   frequency < 49.5 OR frequency > 50.5
              THEN 'medium'
              ELSE 'low'
            END as severity_level,
            GREATEST(
              COALESCE(ABS(voltage_l1 - 230), 0),
              COALESCE(ABS(voltage_l2 - 230), 0),
              COALESCE(ABS(voltage_l3 - 230), 0),
              COALESCE(thd_voltage, 0),
              COALESCE(voltage_unbalance, 0)
            ) as magnitude
          FROM power_quality 
          ${whereClause}
          HAVING event_type IS NOT NULL
        `;

        // Start with base query and params
        let finalQuery = eventsQuery;
        const finalParams: any[] = [...params];

        // Fixed: Apply filters using addStringParam helper method
        if (eventType) {
          const trimmedEventType = this.safelyTrimString(eventType);
          if (trimmedEventType) {
            finalQuery += ` AND event_type = ?`;
            finalParams.push(trimmedEventType);
          }
        }

        if (severity) {
          const trimmedSeverity = this.safelyTrimString(severity);
          if (trimmedSeverity) {
            finalQuery += ` AND severity_level = ?`;
            finalParams.push(trimmedSeverity);
          }
        }

        finalQuery += ` ORDER BY recorded_at DESC LIMIT 100`;

        const events = await database.query<any>(finalQuery, finalParams);

        // Get event summary statistics
        const eventSummary = await this.getEventSummaryStats(
          id,
          params,
          whereClause
        );

        // Enhance events with additional information
        const enhancedEvents = events.map((event) => ({
          ...event,
          impact_score: this.calculateEventImpactScore(event),
          duration_estimate: this.estimateEventDuration(event),
          standards_violated: this.getViolatedStandards(event),
        }));

        logger.info(
          `Power quality events retrieved for building ${building.name}: ${events.length} events found`
        );

        const response: ApiResponse<{
          events: typeof enhancedEvents;
          summary: typeof eventSummary;
        }> = {
          success: true,
          message: "Power quality events fetched successfully",
          data: {
            events: enhancedEvents,
            summary: eventSummary,
          },
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching power quality events:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch power quality events", 500);
      }
    }
  );

  public analyzePowerQualityTrends = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      const { days = "30" } = req.query;
      logger.info(
        "🚀 Analyzing power quality trends for building:",
        buildingId
      );

      // Fixed: Use parseToNumber helper method
      const id = this.parseToNumber(buildingId);
      if (id === undefined) {
        throw new CustomError("Invalid building ID", 400);
      }

      const daysBack = parseInt(days as string);
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

        const conditions = [
          "building_id = ?",
          "recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)",
        ];
        const params = [id, daysBack];

        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        // Get comprehensive trend analysis
        const [overallTrends, violationTrends, complianceTrends, qualityScore] =
          await Promise.all([
            // Overall parameter trends
            database.query<any>(
              `SELECT 
              DATE(recorded_at) as date,
              AVG(thd_voltage) as avg_thd_voltage,
              AVG(thd_current) as avg_thd_current,
              AVG(voltage_unbalance) as avg_voltage_unbalance,
              AVG(power_factor) as avg_power_factor,
              AVG(frequency) as avg_frequency,
              COUNT(*) as reading_count
            FROM power_quality 
            ${whereClause}
            GROUP BY DATE(recorded_at)
            ORDER BY date ASC`,
              params
            ),

            // Violation trends
            database.query<any>(
              `SELECT 
              DATE(recorded_at) as date,
              COUNT(CASE WHEN thd_voltage > 8 THEN 1 END) as thd_voltage_violations,
              COUNT(CASE WHEN thd_current > 15 THEN 1 END) as thd_current_violations,
              COUNT(CASE WHEN voltage_unbalance > 3 THEN 1 END) as voltage_unbalance_violations,
              COUNT(CASE WHEN power_factor < 0.8 THEN 1 END) as power_factor_violations,
              COUNT(*) as total_readings
            FROM power_quality 
            ${whereClause}
            GROUP BY DATE(recorded_at)
            ORDER BY date ASC`,
              params
            ),

            // Compliance trends
            database.query<any>(
              `SELECT 
              DATE(recorded_at) as date,
              COUNT(CASE WHEN thd_voltage <= 8 AND thd_current <= 15 AND 
                              voltage_unbalance <= 3 AND power_factor >= 0.8 
                         THEN 1 END) as compliant_readings,
              COUNT(*) as total_readings,
              (COUNT(CASE WHEN thd_voltage <= 8 AND thd_current <= 15 AND 
                               voltage_unbalance <= 3 AND power_factor >= 0.8 
                          THEN 1 END) * 100.0 / COUNT(*)) as compliance_percentage
            FROM power_quality 
            ${whereClause}
            GROUP BY DATE(recorded_at)
            ORDER BY date ASC`,
              params
            ),

            // Overall quality score calculation
            this.calculatePowerQualityScore(
              await database.queryOne<any>(
                `SELECT 
                AVG(thd_voltage) as avg_thd_voltage,
                AVG(thd_current) as avg_thd_current,
                AVG(voltage_unbalance) as avg_voltage_unbalance,
                AVG(power_factor) as avg_power_factor
              FROM power_quality 
              ${whereClause}`,
                params
              )
            ),
          ]);

        const trendAnalysis = {
          period: {
            start_date: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000),
            end_date: new Date(),
            days: daysBack,
          },
          overall_quality_score: qualityScore,
          parameter_trends: overallTrends,
          violation_trends: violationTrends,
          compliance_trends: complianceTrends,
          insights: {
            best_compliance_day: complianceTrends.reduce(
              (best, day) =>
                day.compliance_percentage > (best?.compliance_percentage || 0)
                  ? day
                  : best,
              null
            ),
            worst_compliance_day: complianceTrends.reduce(
              (worst, day) =>
                day.compliance_percentage <
                (worst?.compliance_percentage || 100)
                  ? day
                  : worst,
              null
            ),
          },
        };

        logger.info(
          `Power quality trends analyzed for building ${building.name}: ${daysBack} days`
        );

        const response: ApiResponse<typeof trendAnalysis> = {
          success: true,
          message: "Power quality trends analysis completed successfully",
          data: trendAnalysis,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error analyzing power quality trends:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to analyze power quality trends", 500);
      }
    }
  );

  // Private helper methods

  /**
   * Enhance power quality data with additional analysis
   */
  private async enhancePowerQualityDataWithAnalysis(
    pqData: IPowerQuality[]
  ): Promise<IPowerQuality[]> {
    if (pqData.length === 0) return pqData;

    try {
      // Add computed fields and analysis
      return pqData.map((reading) => ({
        ...reading,
        compliance_status: this.getComplianceStatus(reading),
        event_detected: this.detectPowerQualityEvent(reading),
      }));
    } catch (error) {
      logger.error("Error enhancing power quality data with analysis:", error);
      // Return data without enhancement rather than failing
      return pqData;
    }
  }

  /**
   * Check for power quality violations
   */
  private checkPowerQualityViolations(reading: IPowerQuality): string[] {
    const violations: string[] = [];

    if (reading.thd_voltage && reading.thd_voltage > 8) {
      violations.push("THD Voltage exceeds IEEE 519 standard (>8%)");
    }

    if (reading.thd_current && reading.thd_current > 15) {
      violations.push("THD Current exceeds IEEE 519 standard (>15%)");
    }

    if (reading.voltage_unbalance && reading.voltage_unbalance > 3) {
      violations.push("Voltage unbalance exceeds NEMA standard (>3%)");
    }

    if (reading.power_factor && reading.power_factor < 0.8) {
      violations.push("Power factor below acceptable limit (<0.8)");
    }

    if (
      reading.frequency &&
      (reading.frequency < 49.5 || reading.frequency > 50.5)
    ) {
      violations.push("Frequency deviation from nominal (50Hz ±0.5Hz)");
    }

    return violations;
  }

  /**
   * Calculate power quality score
   */
  private calculatePowerQualityScore(stats: any): number {
    if (!stats) return 0;

    let score = 100;

    // THD Voltage scoring (30% weight)
    if (stats.avg_thd_voltage) {
      if (stats.avg_thd_voltage <= 5) score -= 0;
      else if (stats.avg_thd_voltage <= 8) score -= 10;
      else if (stats.avg_thd_voltage <= 12) score -= 20;
      else score -= 30;
    }

    // THD Current scoring (25% weight)
    if (stats.avg_thd_current) {
      if (stats.avg_thd_current <= 8) score -= 0;
      else if (stats.avg_thd_current <= 15) score -= 8;
      else if (stats.avg_thd_current <= 20) score -= 15;
      else score -= 25;
    }

    // Voltage unbalance scoring (20% weight)
    if (stats.avg_voltage_unbalance) {
      if (stats.avg_voltage_unbalance <= 2) score -= 0;
      else if (stats.avg_voltage_unbalance <= 3) score -= 5;
      else if (stats.avg_voltage_unbalance <= 4) score -= 10;
      else score -= 20;
    }

    // Power factor scoring (25% weight)
    if (stats.avg_power_factor) {
      if (stats.avg_power_factor >= 0.95) score -= 0;
      else if (stats.avg_power_factor >= 0.85) score -= 5;
      else if (stats.avg_power_factor >= 0.8) score -= 15;
      else score -= 25;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate compliance statistics
   */
  private async calculateComplianceStats(
    buildingId: number,
    params: any[],
    whereClause: string
  ): Promise<any> {
    try {
      const compliance = await database.queryOne<any>(
        `SELECT 
          COUNT(*) as total_readings,
          COUNT(CASE WHEN thd_voltage <= 8 THEN 1 END) as thd_voltage_compliant,
          COUNT(CASE WHEN thd_current <= 15 THEN 1 END) as thd_current_compliant,
          COUNT(CASE WHEN voltage_unbalance <= 3 THEN 1 END) as voltage_unbalance_compliant,
          COUNT(CASE WHEN power_factor >= 0.8 THEN 1 END) as power_factor_compliant
        FROM power_quality 
        ${whereClause}`,
        params
      );

      if (!compliance || compliance.total_readings === 0) {
        return {
          thd_voltage_compliance_rate: 0,
          thd_current_compliance_rate: 0,
          voltage_unbalance_compliance_rate: 0,
          power_factor_compliance_rate: 0,
          overall_compliance: 0,
        };
      }

      return {
        thd_voltage_compliance_rate: Math.round(
          (compliance.thd_voltage_compliant / compliance.total_readings) * 100
        ),
        thd_current_compliance_rate: Math.round(
          (compliance.thd_current_compliant / compliance.total_readings) * 100
        ),
        voltage_unbalance_compliance_rate: Math.round(
          (compliance.voltage_unbalance_compliant / compliance.total_readings) *
            100
        ),
        power_factor_compliance_rate: Math.round(
          (compliance.power_factor_compliant / compliance.total_readings) * 100
        ),
        overall_compliance: Math.round(
          ((compliance.thd_voltage_compliant +
            compliance.thd_current_compliant +
            compliance.voltage_unbalance_compliant +
            compliance.power_factor_compliant) /
            (compliance.total_readings * 4)) *
            100
        ),
      };
    } catch (error) {
      logger.error("Error calculating compliance stats:", error);
      return {
        thd_voltage_compliance_rate: 0,
        thd_current_compliance_rate: 0,
        voltage_unbalance_compliance_rate: 0,
        power_factor_compliance_rate: 0,
        overall_compliance: 0,
      };
    }
  }

  /**
   * Get compliance status for a reading
   */
  private getComplianceStatus(
    reading: IPowerQuality
  ):
    | "compliant"
    | "minor_violations"
    | "major_violations"
    | "critical_violations" {
    const violations = this.checkPowerQualityViolations(reading);

    if (violations.length === 0) return "compliant";

    // Check for critical violations
    const criticalViolations = violations.filter(
      (v) =>
        v.includes("exceeds") || v.includes("deviation") || v.includes("out of")
    );

    if (criticalViolations.length > 0) return "critical_violations";
    if (violations.length > 2) return "major_violations";
    return "minor_violations";
  }

  /**
   * Detect power quality event type
   */
  private detectPowerQualityEvent(reading: IPowerQuality): string | null {
    if (reading.voltage_l1 && reading.voltage_l1 < 207) return "voltage_sag";
    if (reading.voltage_l1 && reading.voltage_l1 > 253) return "voltage_swell";
    if (reading.thd_voltage && reading.thd_voltage > 8)
      return "harmonic_distortion";
    if (reading.voltage_unbalance && reading.voltage_unbalance > 3)
      return "voltage_unbalance";
    if (
      reading.frequency &&
      (reading.frequency < 49.5 || reading.frequency > 50.5)
    )
      return "frequency_deviation";

    return null;
  }

  /**
   * Calculate event impact score
   */
  private calculateEventImpactScore(event: any): number {
    let impact = 0;

    // Severity-based scoring
    switch (event.severity_level) {
      case "critical":
        impact += 50;
        break;
      case "high":
        impact += 35;
        break;
      case "medium":
        impact += 20;
        break;
      case "low":
        impact += 10;
        break;
    }

    // Magnitude-based scoring
    impact += Math.min(30, event.magnitude || 0);

    // Event type specific scoring
    const eventTypeScores = {
      "Voltage Out of Range": 20,
      "High Voltage THD": 15,
      "High Current THD": 10,
      "Frequency Deviation": 25,
      "Low Power Factor": 5,
    };

    impact +=
      eventTypeScores[event.event_type as keyof typeof eventTypeScores] || 0;

    return Math.min(100, impact);
  }

  /**
   * Estimate event duration (placeholder - would need more sophisticated analysis)
   */
  private estimateEventDuration(event: any): string {
    // This is a simplified estimation - real implementation would require
    // analysis of surrounding readings
    switch (event.severity_level) {
      case "critical":
        return "> 1 hour";
      case "high":
        return "15-60 minutes";
      case "medium":
        return "5-15 minutes";
      default:
        return "< 5 minutes";
    }
  }

  /**
   * Get violated standards for an event
   */
  private getViolatedStandards(event: any): string[] {
    const standards: string[] = [];

    if (event.thd_voltage > 8) standards.push("IEEE 519-2014 (Voltage THD)");
    if (event.thd_current > 15) standards.push("IEEE 519-2014 (Current THD)");
    if (event.voltage_unbalance > 3)
      standards.push("NEMA MG 1 (Voltage Unbalance)");
    if (event.frequency < 49.5 || event.frequency > 50.5)
      standards.push("Grid Code (Frequency)");

    return standards;
  }

  /**
   * Get event summary statistics
   */
  private async getEventSummaryStats(
    buildingId: number,
    params: any[],
    whereClause: string
  ): Promise<any> {
    try {
      const summary = await database.queryOne<any>(
        `SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN event_type = 'Voltage Out of Range' THEN 1 END) as voltage_events,
          COUNT(CASE WHEN event_type = 'High Voltage THD' THEN 1 END) as thd_voltage_events,
          COUNT(CASE WHEN event_type = 'High Current THD' THEN 1 END) as thd_current_events,
          COUNT(CASE WHEN event_type = 'Frequency Deviation' THEN 1 END) as frequency_events,
          COUNT(CASE WHEN event_type = 'Low Power Factor' THEN 1 END) as power_factor_events
        FROM (
          SELECT *,
            CASE 
              WHEN voltage_l1 < 207 OR voltage_l2 < 207 OR voltage_l3 < 207 
              THEN 'Voltage Sag'
              WHEN voltage_l1 > 253 OR voltage_l2 > 253 OR voltage_l3 > 253 
              THEN 'Voltage Swell'
              WHEN voltage_l1 < 196 OR voltage_l1 > 264 OR
                   voltage_l2 < 196 OR voltage_l2 > 264 OR
                   voltage_l3 < 196 OR voltage_l3 > 264
              THEN 'Voltage Out of Range'
              WHEN thd_voltage > 8 THEN 'High Voltage THD'
              WHEN thd_current > 15 THEN 'High Current THD'
              WHEN frequency < 49.5 OR frequency > 50.5 THEN 'Frequency Deviation'
              WHEN power_factor < 0.85 THEN 'Low Power Factor'
              WHEN voltage_unbalance > 3 THEN 'Voltage Unbalance'
              ELSE NULL
            END as event_type
          FROM power_quality 
          ${whereClause}
          HAVING event_type IS NOT NULL
        ) events`,
        params
      );

      return (
        summary || {
          total_events: 0,
          voltage_events: 0,
          thd_voltage_events: 0,
          thd_current_events: 0,
          frequency_events: 0,
          power_factor_events: 0,
        }
      );
    } catch (error) {
      logger.error("Error getting event summary stats:", error);
      return {
        total_events: 0,
        voltage_events: 0,
        thd_voltage_events: 0,
        thd_current_events: 0,
        frequency_events: 0,
        power_factor_events: 0,
      };
    }
  }
}

export default new PowerQualityController();
