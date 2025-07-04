import { Request, Response } from "express";
import { ApiResponse } from "@/interfaces/IResponse";
import { IAnalysisRequest, IAnalysisResult } from "@/interfaces/IAnalytics";
import analyticsService from "@/services/analyticsService";
import enhancedComplianceService from "@/services/enhancedcomplianceService";
import { database } from "@/config/database";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";

interface AnalyticsQuery {
  building_id?: string;
  equipment_id?: string;
  start_date?: string;
  end_date?: string;
  analysis_types?: string;
}

interface BaselineQuery {
  baseline_type?: string;
  lookback_days?: string;
}

interface ForecastQuery {
  forecast_days?: string;
  forecast_type?: string;
}

class AnalyticsController {
  /**
   * Run comprehensive analytics analysis
   */
  public runAnalysis = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Starting comprehensive analytics analysis");

      const {
        building_id,
        equipment_id,
        start_date,
        end_date,
        analysis_types = "energy,anomaly,efficiency",
      } = req.query as AnalyticsQuery;

      if (!building_id || !start_date || !end_date) {
        throw new CustomError(
          "building_id, start_date, and end_date are required",
          400
        );
      }

      const buildingId = parseInt(building_id);
      const equipmentId = equipment_id ? parseInt(equipment_id) : undefined;

      if (isNaN(buildingId) || (equipment_id && isNaN(equipmentId!))) {
        throw new CustomError("Invalid building_id or equipment_id", 400);
      }

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name FROM buildings WHERE id = ?",
          [buildingId]
        );

        if (!building) {
          throw new CustomError("Building not found", 404);
        }

        // Validate equipment exists if provided
        if (equipmentId) {
          const equipment = await database.queryOne(
            "SELECT id, name FROM equipment WHERE id = ? AND building_id = ?",
            [equipmentId, buildingId]
          );

          if (!equipment) {
            throw new CustomError(
              "Equipment not found or not in specified building",
              404
            );
          }
        }

        const analysisRequest: IAnalysisRequest = {
          building_id: buildingId,
          equipment_id: equipmentId,
          start_date: new Date(start_date),
          end_date: new Date(end_date),
          analysis_types: analysis_types.split(",").map((type) => type.trim()),
        };

        const startTime = Date.now();
        const results: IAnalysisResult[] = [];

        logger.info(
          `Running analysis types: ${analysisRequest.analysis_types.join(", ")}`
        );

        // Run requested analysis types
        if (analysisRequest.analysis_types.includes("energy")) {
          logger.info("Running energy efficiency analysis");
          const efficiencyAnalysis =
            await analyticsService.analyzeEnergyEfficiency(
              analysisRequest.building_id!,
              analysisRequest.start_date,
              analysisRequest.end_date
            );
          results.push({
            analysis_type: "energy_efficiency",
            building_id: analysisRequest.building_id,
            results: efficiencyAnalysis,
            processing_time_ms: Date.now() - startTime,
          });
        }

        if (analysisRequest.analysis_types.includes("anomaly")) {
          logger.info("Running anomaly detection");
          const anomalies =
            await analyticsService.detectAnomalies(analysisRequest);
          results.push({
            analysis_type: "anomaly_detection",
            building_id: analysisRequest.building_id,
            equipment_id: analysisRequest.equipment_id,
            results: { anomalies, count: anomalies.length },
            processing_time_ms: Date.now() - startTime,
          });
        }

        if (analysisRequest.analysis_types.includes("forecast")) {
          logger.info("Running energy forecast");
          const forecasts = await analyticsService.forecastEnergyConsumption(
            analysisRequest.building_id!,
            30,
            "consumption"
          );
          results.push({
            analysis_type: "energy_forecast",
            building_id: analysisRequest.building_id,
            results: { forecasts, forecast_period: "30_days" },
            processing_time_ms: Date.now() - startTime,
          });
        }

        if (
          analysisRequest.analysis_types.includes("maintenance") &&
          analysisRequest.equipment_id
        ) {
          logger.info("Running maintenance prediction");
          const maintenancePrediction =
            await analyticsService.predictEquipmentMaintenance(
              analysisRequest.equipment_id
            );
          results.push({
            analysis_type: "maintenance_prediction",
            equipment_id: analysisRequest.equipment_id,
            results: maintenancePrediction,
            processing_time_ms: Date.now() - startTime,
          });
        }

        if (analysisRequest.analysis_types.includes("efficiency")) {
          logger.info("Running efficiency analysis");
          const efficiencyData = await this.getEfficiencyMetrics(
            buildingId,
            analysisRequest.start_date,
            analysisRequest.end_date
          );
          results.push({
            analysis_type: "efficiency_metrics",
            building_id: analysisRequest.building_id,
            results: efficiencyData,
            processing_time_ms: Date.now() - startTime,
          });
        }

        logger.info(
          `Analytics analysis completed for building ${building_id}, ${results.length} analyses performed`
        );

        const response: ApiResponse<IAnalysisResult[]> = {
          success: true,
          message: "Analytics analysis completed successfully",
          data: results,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error running analytics analysis:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to run analytics analysis", 500);
      }
    }
  );

  /**
   * Calculate energy baseline
   */
  public calculateBaseline = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      const { baseline_type = "monthly", lookback_days = "365" } =
        req.query as BaselineQuery;
      logger.info("🚀 Calculating baseline for building:", buildingId);

      if (!buildingId || isNaN(parseInt(buildingId))) {
        throw new CustomError("Invalid building ID", 400);
      }

      const id = parseInt(buildingId);

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name FROM buildings WHERE id = ?",
          [id]
        );

        if (!building) {
          throw new CustomError("Building not found", 404);
        }

        const baseline = await analyticsService.calculateEnergyBaseline(
          id,
          baseline_type as any,
          parseInt(lookback_days)
        );

        logger.info(`Energy baseline calculated for building ${building.name}`);

        const response: ApiResponse<any> = {
          success: true,
          message: "Energy baseline calculated successfully",
          data: baseline,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error calculating baseline:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to calculate baseline", 500);
      }
    }
  );

  /**
   * Analyze power quality events
   */
  public analyzePowerQuality = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId, pqReadingId } = req.params;
      const { voltageData, currentData, frequencyData } = req.body;
      logger.info("🚀 Analyzing power quality for building:", buildingId);

      if (!buildingId || isNaN(parseInt(buildingId))) {
        throw new CustomError("Invalid building ID", 400);
      }

      if (!pqReadingId || isNaN(parseInt(pqReadingId))) {
        throw new CustomError("Invalid power quality reading ID", 400);
      }

      if (!voltageData || !Array.isArray(voltageData)) {
        throw new CustomError("voltageData array is required", 400);
      }

      const id = parseInt(buildingId);
      const readingId = parseInt(pqReadingId);

      try {
        // Validate building and reading exist
        const [building, reading] = await Promise.all([
          database.queryOne("SELECT id, name FROM buildings WHERE id = ?", [
            id,
          ]),
          database.queryOne(
            "SELECT id FROM power_quality WHERE id = ? AND building_id = ?",
            [readingId, id]
          ),
        ]);

        if (!building) {
          throw new CustomError("Building not found", 404);
        }

        if (!reading) {
          throw new CustomError("Power quality reading not found", 404);
        }

        const events = await analyticsService.analyzePowerQualityEvents(
          id,
          readingId,
          voltageData,
          currentData || [],
          frequencyData || []
        );

        logger.info(
          `Power quality analysis completed for building ${building.name}, found ${events.length} events`
        );

        const response: ApiResponse<any[]> = {
          success: true,
          message: "Power quality analysis completed successfully",
          data: events,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error analyzing power quality:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to analyze power quality", 500);
      }
    }
  );

  /**
   * Get maintenance predictions
   */
  public getMaintenancePredictions = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { equipmentId } = req.params;
      logger.info(
        "🚀 Getting maintenance predictions for equipment:",
        equipmentId
      );

      if (!equipmentId || isNaN(parseInt(equipmentId))) {
        throw new CustomError("Invalid equipment ID", 400);
      }

      const id = parseInt(equipmentId);

      try {
        // Validate equipment exists
        const equipment = await database.queryOne(
          "SELECT id, name, building_id FROM equipment WHERE id = ?",
          [id]
        );

        if (!equipment) {
          throw new CustomError("Equipment not found", 404);
        }

        const prediction =
          await analyticsService.predictEquipmentMaintenance(id);

        logger.info(
          `Maintenance prediction completed for equipment ${equipment.name}`
        );

        const response: ApiResponse<any> = {
          success: true,
          message: "Maintenance prediction completed successfully",
          data: prediction,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error getting maintenance predictions:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to get maintenance predictions", 500);
      }
    }
  );

  /**
   * Generate energy forecasts
   */
  public generateForecast = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      const { forecast_days = "30", forecast_type = "consumption" } =
        req.query as ForecastQuery;
      logger.info("🚀 Generating forecast for building:", buildingId);

      if (!buildingId || isNaN(parseInt(buildingId))) {
        throw new CustomError("Invalid building ID", 400);
      }

      const id = parseInt(buildingId);
      const days = parseInt(forecast_days);

      if (isNaN(days) || days < 1 || days > 365) {
        throw new CustomError("forecast_days must be between 1 and 365", 400);
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

        const forecasts = await analyticsService.forecastEnergyConsumption(
          id,
          days,
          forecast_type as any
        );

        logger.info(
          `Energy forecast generated for building ${building.name}, ${forecasts.length} data points`
        );

        const response: ApiResponse<any[]> = {
          success: true,
          message: "Energy forecast generated successfully",
          data: forecasts,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error generating forecast:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to generate forecast", 500);
      }
    }
  );

  /**
   * Detect anomalies for specific parameters
   */
  public detectAnomalies = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const analysisRequest = req.body as IAnalysisRequest;
      logger.info("🚀 Detecting anomalies");

      if (
        !analysisRequest.building_id ||
        !analysisRequest.start_date ||
        !analysisRequest.end_date
      ) {
        throw new CustomError(
          "building_id, start_date, and end_date are required",
          400
        );
      }

      if (isNaN(analysisRequest.building_id)) {
        throw new CustomError("Invalid building_id", 400);
      }

      if (analysisRequest.equipment_id && isNaN(analysisRequest.equipment_id)) {
        throw new CustomError("Invalid equipment_id", 400);
      }

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name FROM buildings WHERE id = ?",
          [analysisRequest.building_id]
        );

        if (!building) {
          throw new CustomError("Building not found", 404);
        }

        // Validate equipment exists if provided
        if (analysisRequest.equipment_id) {
          const equipment = await database.queryOne(
            "SELECT id, name FROM equipment WHERE id = ? AND building_id = ?",
            [analysisRequest.equipment_id, analysisRequest.building_id]
          );

          if (!equipment) {
            throw new CustomError(
              "Equipment not found or not in specified building",
              404
            );
          }
        }

        const anomalies =
          await analyticsService.detectAnomalies(analysisRequest);

        logger.info(
          `Anomaly detection completed for building ${building.name}, found ${anomalies.length} anomalies`
        );

        const response: ApiResponse<any[]> = {
          success: true,
          message: "Anomaly detection completed successfully",
          data: anomalies,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error detecting anomalies:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to detect anomalies", 500);
      }
    }
  );

  /**
   * Get comprehensive analytics dashboard data
   */
  public getAnalyticsDashboard = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { building_id } = req.query;
      logger.info("🚀 Getting analytics dashboard data");

      if (!building_id) {
        throw new CustomError("building_id is required", 400);
      }

      const buildingId = parseInt(building_id as string);

      if (isNaN(buildingId)) {
        throw new CustomError("Invalid building_id", 400);
      }

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name FROM buildings WHERE id = ?",
          [buildingId]
        );

        if (!building) {
          throw new CustomError("Building not found", 404);
        }

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30); // Last 30 days

        // Run all analyses in parallel for better performance
        const [
          efficiencyAnalysis,
          anomalies,
          forecasts,
          baseline,
          energyStats,
          powerQualityStats,
        ] = await Promise.all([
          // Get efficiency analysis
          analyticsService.analyzeEnergyEfficiency(
            buildingId,
            startDate,
            endDate
          ),

          // Get recent anomalies
          analyticsService.detectAnomalies({
            building_id: buildingId,
            start_date: startDate,
            end_date: endDate,
            analysis_types: ["energy", "power_quality"],
          }),

          // Get forecasts
          analyticsService.forecastEnergyConsumption(
            buildingId,
            7,
            "consumption"
          ), // Next 7 days

          // Get baseline
          analyticsService.calculateEnergyBaseline(buildingId, "monthly", 365),

          // Get energy statistics
          this.getEnergyStatistics(buildingId, startDate, endDate),

          // Get power quality statistics
          this.getPowerQualityStatistics(buildingId, startDate, endDate),
        ]);

        const dashboardData = {
          building_info: building,
          efficiency_analysis: efficiencyAnalysis,
          recent_anomalies: anomalies.slice(0, 10), // Last 10 anomalies
          forecasts: forecasts,
          baseline: baseline,
          energy_statistics: energyStats,
          power_quality_statistics: powerQualityStats,
          summary: {
            total_anomalies: anomalies.length,
            efficiency_score: efficiencyAnalysis.efficiency_score,
            forecast_trend:
              forecasts.length > 0
                ? forecasts[forecasts.length - 1].predicted_value >
                  forecasts[0].predicted_value
                  ? "increasing"
                  : "decreasing"
                : "stable",
            period: {
              start_date: startDate.toISOString().split("T")[0],
              end_date: endDate.toISOString().split("T")[0],
            },
          },
        };

        logger.info(
          `Successfully retrieved analytics dashboard data for building ${building.name}`
        );

        const response: ApiResponse<any> = {
          success: true,
          message: "Analytics dashboard data retrieved successfully",
          data: dashboardData,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error getting analytics dashboard:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to get analytics dashboard", 500);
      }
    }
  );

  /**
   * Run compliance analysis
   */
  public runComplianceAnalysis = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { auditId } = req.params;
      logger.info("🚀 Running compliance analysis for audit:", auditId);

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

        const analysis =
          await enhancedComplianceService.performComprehensiveAnalysis(id);

        logger.info(`Compliance analysis completed for audit ${audit.title}`);

        const response: ApiResponse<any> = {
          success: true,
          message: "Compliance analysis completed successfully",
          data: analysis,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error running compliance analysis:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to run compliance analysis", 500);
      }
    }
  );

  /**
   * Generate compliance benchmarking report
   */
  public generateBenchmarkingReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { buildingId } = req.params;
      logger.info(
        "🚀 Generating benchmarking report for building:",
        buildingId
      );

      if (!buildingId || isNaN(parseInt(buildingId))) {
        throw new CustomError("Invalid building ID", 400);
      }

      const id = parseInt(buildingId);

      try {
        // Validate building exists
        const building = await database.queryOne(
          "SELECT id, name FROM buildings WHERE id = ?",
          [id]
        );

        if (!building) {
          throw new CustomError("Building not found", 404);
        }

        const report =
          await enhancedComplianceService.generateBenchmarkingReport(id);

        logger.info(
          `Benchmarking report generated for building ${building.name}`
        );

        const response: ApiResponse<any> = {
          success: true,
          message: "Benchmarking report generated successfully",
          data: report,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error generating benchmarking report:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to generate benchmarking report", 500);
      }
    }
  );

  /**
   * Perform gap analysis
   */
  public performGapAnalysis = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { auditId } = req.params;
      const { target_standards = ["PEC2017", "OSHS", "RA11285"] } = req.body;
      logger.info("🚀 Performing gap analysis for audit:", auditId);

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

        const gapAnalysis = await enhancedComplianceService.performGapAnalysis(
          id,
          target_standards
        );

        logger.info(`Gap analysis completed for audit ${audit.title}`);

        const response: ApiResponse<any> = {
          success: true,
          message: "Gap analysis completed successfully",
          data: gapAnalysis,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error performing gap analysis:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to perform gap analysis", 500);
      }
    }
  );

  // Private helper methods

  /**
   * Get efficiency metrics for building
   */
  private async getEfficiencyMetrics(
    buildingId: number,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const metrics = await database.queryOne<any>(
        `SELECT 
          SUM(consumption_kwh) as total_consumption,
          AVG(power_factor) as avg_power_factor,
          MAX(demand_kw) as peak_demand,
          SUM(cost_php) as total_cost,
          COUNT(*) as reading_count
        FROM energy_consumption 
        WHERE building_id = ? AND recorded_at BETWEEN ? AND ?`,
        [buildingId, startDate.toISOString(), endDate.toISOString()]
      );

      return (
        metrics || {
          total_consumption: 0,
          avg_power_factor: 0,
          peak_demand: 0,
          total_cost: 0,
          reading_count: 0,
        }
      );
    } catch (error) {
      logger.error("Error getting efficiency metrics:", error);
      return {
        total_consumption: 0,
        avg_power_factor: 0,
        peak_demand: 0,
        total_cost: 0,
        reading_count: 0,
      };
    }
  }

  /**
   * Get energy statistics for building
   */
  private async getEnergyStatistics(
    buildingId: number,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const stats = await database.queryOne<any>(
        `SELECT 
          AVG(consumption_kwh) as avg_consumption,
          MIN(consumption_kwh) as min_consumption,
          MAX(consumption_kwh) as max_consumption,
          STDDEV(consumption_kwh) as consumption_stddev,
          AVG(power_factor) as avg_power_factor,
          MIN(power_factor) as min_power_factor,
          MAX(power_factor) as max_power_factor
        FROM energy_consumption 
        WHERE building_id = ? AND recorded_at BETWEEN ? AND ?`,
        [buildingId, startDate.toISOString(), endDate.toISOString()]
      );

      return stats || {};
    } catch (error) {
      logger.error("Error getting energy statistics:", error);
      return {};
    }
  }

  /**
   * Get power quality statistics for building
   */
  private async getPowerQualityStatistics(
    buildingId: number,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const stats = await database.queryOne<any>(
        `SELECT 
          AVG((voltage_l1 + voltage_l2 + voltage_l3) / 3) as avg_voltage,
          AVG(thd_voltage) as avg_thd_voltage,
          AVG(thd_current) as avg_thd_current,
          AVG(frequency) as avg_frequency,
          AVG(voltage_unbalance) as avg_voltage_unbalance,
          AVG(current_unbalance) as avg_current_unbalance,
          COUNT(*) as reading_count
        FROM power_quality 
        WHERE building_id = ? AND recorded_at BETWEEN ? AND ?`,
        [buildingId, startDate.toISOString(), endDate.toISOString()]
      );

      return (
        stats || {
          reading_count: 0,
        }
      );
    } catch (error) {
      logger.error("Error getting power quality statistics:", error);
      return {
        reading_count: 0,
      };
    }
  }
}

export default new AnalyticsController();
