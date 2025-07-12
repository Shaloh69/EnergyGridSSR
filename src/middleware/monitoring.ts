import { Request, Response, NextFunction } from "express";
import {
  backgroundJobProcessor,
  JobType,
} from "@/services/backgroundProcessor";
import { database } from "@/config/database";
import { redisClient } from "@/config/redis";
import { socketManager } from "@/config/socket";
import { logger } from "@/utils/logger";

interface MonitoringContext {
  data_type: "energy" | "power_quality" | "equipment" | "audit";
  building_id?: number;
  equipment_id?: number;
  data: any;
  should_trigger_analytics: boolean;
  should_trigger_alerts: boolean;
  should_check_compliance: boolean;
}

/**
 * Real-time monitoring middleware that triggers analytics and alerts
 * when new data is received
 */
export class MonitoringMiddleware {
  /**
   * Monitor energy consumption data for anomalies and threshold violations
   */
  public static monitorEnergyData = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // This runs after the energy data has been created
      const energyData = res.locals.energyData;

      if (!energyData) {
        return next();
      }

      const context: MonitoringContext = {
        data_type: "energy",
        building_id: energyData.building_id,
        data: energyData,
        should_trigger_analytics: true,
        should_trigger_alerts: true,
        should_check_compliance: true,
      };

      // Run monitoring in background to avoid blocking response
      setImmediate(() => {
        MonitoringMiddleware.processMonitoring(context).catch((error) => {
          logger.error("Error in energy monitoring:", error);
        });
      });

      next();
    } catch (error) {
      logger.error("Error in monitorEnergyData middleware:", error);
      next();
    }
  };

  /**
   * Monitor power quality data for events and violations
   */
  public static monitorPowerQualityData = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const pqData = res.locals.powerQualityData;

      if (!pqData) {
        return next();
      }

      const context: MonitoringContext = {
        data_type: "power_quality",
        building_id: pqData.building_id,
        data: pqData,
        should_trigger_analytics: true,
        should_trigger_alerts: true,
        should_check_compliance: true,
      };

      setImmediate(() => {
        MonitoringMiddleware.processMonitoring(context).catch((error) => {
          logger.error("Error in power quality monitoring:", error);
        });
      });

      next();
    } catch (error) {
      logger.error("Error in monitorPowerQualityData middleware:", error);
      next();
    }
  };

  /**
   * Monitor equipment updates for maintenance predictions
   */
  public static monitorEquipmentData = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const equipmentData = res.locals.equipmentData;

      if (!equipmentData) {
        return next();
      }

      const context: MonitoringContext = {
        data_type: "equipment",
        building_id: equipmentData.building_id,
        equipment_id: equipmentData.id,
        data: equipmentData,
        should_trigger_analytics:
          equipmentData.status === "maintenance" ||
          equipmentData.status === "faulty",
        should_trigger_alerts: equipmentData.status === "faulty",
        should_check_compliance: false,
      };

      setImmediate(() => {
        MonitoringMiddleware.processMonitoring(context).catch((error) => {
          logger.error("Error in equipment monitoring:", error);
        });
      });

      next();
    } catch (error) {
      logger.error("Error in monitorEquipmentData middleware:", error);
      next();
    }
  };

  /**
   * Monitor audit completions for compliance analysis
   */
  public static monitorAuditCompletion = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const auditData = res.locals.auditData;

      if (!auditData || auditData.status !== "completed") {
        return next();
      }

      const context: MonitoringContext = {
        data_type: "audit",
        building_id: auditData.building_id,
        data: auditData,
        should_trigger_analytics: true,
        should_trigger_alerts: false,
        should_check_compliance: true,
      };

      setImmediate(() => {
        MonitoringMiddleware.processMonitoring(context).catch((error) => {
          logger.error("Error in audit monitoring:", error);
        });
      });

      next();
    } catch (error) {
      logger.error("Error in monitorAuditCompletion middleware:", error);
      next();
    }
  };

  /**
   * Main monitoring processing logic
   */
  private static async processMonitoring(
    context: MonitoringContext
  ): Promise<void> {
    const startTime = Date.now();
    let alertsGenerated = 0;

    try {
      // Log monitoring activity
      await MonitoringMiddleware.logMonitoringActivity(context, "started");

      // Process alerts first (real-time)
      if (context.should_trigger_alerts) {
        alertsGenerated = await MonitoringMiddleware.processAlerts(context);
      }

      // Process analytics (can be background)
      if (context.should_trigger_analytics) {
        await MonitoringMiddleware.processAnalytics(context);
      }

      // Process compliance checks (background)
      if (context.should_check_compliance) {
        await MonitoringMiddleware.processComplianceChecks(context);
      }

      // Emit real-time updates using existing socket manager
      await MonitoringMiddleware.emitRealTimeUpdates(context, alertsGenerated);

      // Cache monitoring results
      await MonitoringMiddleware.cacheMonitoringResults(
        context,
        alertsGenerated
      );

      // Log successful completion
      await MonitoringMiddleware.logMonitoringActivity(context, "completed", {
        processing_time_ms: Date.now() - startTime,
        alerts_generated: alertsGenerated,
      });
    } catch (error) {
      logger.error(
        `Error processing monitoring for ${context.data_type}:`,
        error
      );

      // Log error
      await MonitoringMiddleware.logMonitoringActivity(context, "error", {
        error_message: error instanceof Error ? error.message : "Unknown error",
        processing_time_ms: Date.now() - startTime,
      });
    }
  }

  /**
   * Process real-time alerts using existing database schema
   */
  private static async processAlerts(
    context: MonitoringContext
  ): Promise<number> {
    let alertsGenerated = 0;

    try {
      switch (context.data_type) {
        case "energy":
          // Check power factor threshold
          if (context.data.power_factor && context.data.power_factor < 0.85) {
            await MonitoringMiddleware.createAlert({
              type: "threshold_exceeded",
              severity: context.data.power_factor < 0.8 ? "high" : "medium",
              title: "Low Power Factor Detected",
              message: `Power factor of ${context.data.power_factor} is below acceptable threshold`,
              building_id: context.building_id,
              energy_reading_id: context.data.id,
              detected_value: context.data.power_factor,
              threshold_value: 0.85,
            });
            alertsGenerated++;
          }

          // Check high consumption
          if (
            context.data.consumption_kwh &&
            context.data.consumption_kwh > 1000
          ) {
            await MonitoringMiddleware.createAlert({
              type: "energy_anomaly",
              severity: "medium",
              title: "High Energy Consumption",
              message: `Consumption of ${context.data.consumption_kwh} kWh exceeds normal range`,
              building_id: context.building_id,
              energy_reading_id: context.data.id,
              detected_value: context.data.consumption_kwh,
              threshold_value: 1000,
            });
            alertsGenerated++;
          }
          break;

        case "power_quality":
          // Check THD voltage
          if (context.data.thd_voltage && context.data.thd_voltage > 8.0) {
            await MonitoringMiddleware.createAlert({
              type: "power_quality",
              severity: "high",
              title: "High THD Voltage",
              message: `THD voltage of ${context.data.thd_voltage}% exceeds IEEE standards`,
              building_id: context.building_id,
              pq_reading_id: context.data.id,
              detected_value: context.data.thd_voltage,
              threshold_value: 8.0,
            });
            alertsGenerated++;
          }

          // Check voltage unbalance
          if (
            context.data.voltage_unbalance &&
            context.data.voltage_unbalance > 3.0
          ) {
            await MonitoringMiddleware.createAlert({
              type: "power_quality",
              severity: "medium",
              title: "Voltage Unbalance",
              message: `Voltage unbalance of ${context.data.voltage_unbalance}% exceeds acceptable limit`,
              building_id: context.building_id,
              pq_reading_id: context.data.id,
              detected_value: context.data.voltage_unbalance,
              threshold_value: 3.0,
            });
            alertsGenerated++;
          }
          break;

        case "equipment":
          if (context.data.status === "faulty") {
            await MonitoringMiddleware.createAlert({
              type: "equipment_failure",
              severity: "critical",
              title: "Equipment Failure",
              message: `Equipment ${context.data.name} has been marked as faulty`,
              building_id: context.building_id,
              equipment_id: context.equipment_id,
            });
            alertsGenerated++;
          }
          break;
      }
    } catch (error) {
      logger.error(`Error processing alerts for ${context.data_type}:`, error);
    }

    return alertsGenerated;
  }

  /**
   * Create alert in database
   */
  private static async createAlert(alertData: any): Promise<void> {
    try {
      await database.query(
        `INSERT INTO alerts (type, severity, title, message, building_id, equipment_id, 
         energy_reading_id, pq_reading_id, detected_value, threshold_value) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          alertData.type,
          alertData.severity,
          alertData.title,
          alertData.message,
          alertData.building_id,
          alertData.equipment_id || null,
          alertData.energy_reading_id || null,
          alertData.pq_reading_id || null,
          alertData.detected_value || null,
          alertData.threshold_value || null,
        ]
      );
    } catch (error) {
      logger.error("Error creating alert:", error);
    }
  }

  /**
   * Process analytics (background jobs for heavy computations)
   */
  private static async processAnalytics(
    context: MonitoringContext
  ): Promise<void> {
    try {
      switch (context.data_type) {
        case "energy":
          // Check if anomaly detection is needed
          const shouldRunAnomalyDetection =
            await MonitoringMiddleware.shouldRunAnomalyDetection(
              context.building_id!
            );

          if (shouldRunAnomalyDetection) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 7); // Last 7 days

            await backgroundJobProcessor.createJob(
              JobType.ANALYTICS_PROCESSING,
              context.building_id,
              undefined,
              {
                analysis_types: ["energy", "anomaly"],
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
              }
            );
          }

          // Schedule efficiency analysis if enough data
          const shouldRunEfficiencyAnalysis =
            await MonitoringMiddleware.shouldRunEfficiencyAnalysis(
              context.building_id!
            );

          if (shouldRunEfficiencyAnalysis) {
            await backgroundJobProcessor.createJob(
              JobType.ANALYTICS_PROCESSING,
              context.building_id,
              undefined,
              {
                analysis_types: ["efficiency"],
                start_date: new Date(
                  Date.now() - 30 * 24 * 60 * 60 * 1000
                ).toISOString(),
                end_date: new Date().toISOString(),
              }
            );
          }
          break;

        case "equipment":
          if (context.equipment_id) {
            // Schedule maintenance prediction
            await backgroundJobProcessor.createJob(
              JobType.MAINTENANCE_PREDICTION,
              context.building_id,
              context.equipment_id
            );
          }
          break;

        case "audit":
          // Schedule comprehensive compliance analysis
          await backgroundJobProcessor.createJob(
            JobType.COMPLIANCE_CHECK,
            context.building_id,
            undefined,
            {
              audit_id: context.data.id,
              check_types: ["comprehensive"],
            }
          );
          break;
      }
    } catch (error) {
      logger.error(
        `Error processing analytics for ${context.data_type}:`,
        error
      );
    }
  }

  /**
   * Process compliance checks (basic implementation)
   */
  private static async processComplianceChecks(
    context: MonitoringContext
  ): Promise<void> {
    try {
      if (
        context.data_type === "energy" ||
        context.data_type === "power_quality"
      ) {
        // Basic real-time compliance monitoring
        // You can extend this with your enhanced compliance service
        logger.info(`Real-time compliance check for ${context.data_type} data`);
      }
    } catch (error) {
      logger.error(
        `Error processing compliance checks for ${context.data_type}:`,
        error
      );
    }
  }

  /**
   * Emit real-time updates using existing socket manager
   */
  private static async emitRealTimeUpdates(
    context: MonitoringContext,
    alertsGenerated: number
  ): Promise<void> {
    try {
      const updateData = {
        type: context.data_type,
        building_id: context.building_id,
        equipment_id: context.equipment_id,
        timestamp: new Date(),
        alerts_generated: alertsGenerated,
        data: context.data,
      };

      // Use existing socket manager methods
      if (context.building_id) {
        // Emit to building-specific users
        socketManager.emitToBuilding(
          context.building_id.toString(),
          "monitoringUpdate",
          updateData
        );

        // Emit specific update types
        switch (context.data_type) {
          case "energy":
            socketManager.emitEnergyUpdate(
              context.building_id.toString(),
              context.data
            );
            break;
          case "power_quality":
            socketManager.emitPowerQualityUpdate(
              context.building_id.toString(),
              context.data
            );
            break;
          case "equipment":
            if (context.data.status === "faulty") {
              socketManager.emitMaintenanceAlert(
                context.equipment_id!,
                context.building_id,
                context.data
              );
            }
            break;
        }
      }

      // If alerts were generated, emit them
      if (alertsGenerated > 0) {
        // Emit system-wide alert notification
        socketManager.getIO()?.emit("systemMonitoringUpdate", updateData);
      }
    } catch (error) {
      logger.error("Error emitting real-time updates:", error);
    }
  }

  /**
   * Cache monitoring results using Redis
   */
  private static async cacheMonitoringResults(
    context: MonitoringContext,
    alertsGenerated: number
  ): Promise<void> {
    try {
      const cacheKey = `monitoring:${context.data_type}:${context.building_id}:latest`;
      const cacheData = {
        type: context.data_type,
        building_id: context.building_id,
        equipment_id: context.equipment_id,
        data: context.data,
        alerts_generated: alertsGenerated,
        timestamp: new Date(),
      };

      // Cache for 5 minutes
      await redisClient.set(cacheKey, cacheData, 300);

      // Also maintain a list of recent monitoring events
      const listKey = `monitoring:${context.building_id}:recent`;
      await redisClient.lpush(listKey, cacheData);

      // Keep only last 50 events
      const listLength = await redisClient.getClient().llen(listKey);
      if (listLength > 50) {
        await redisClient.getClient().ltrim(listKey, 0, 49);
      }
    } catch (error) {
      logger.error("Error caching monitoring results:", error);
    }
  }

  /**
   * Log monitoring activity to database
   */
  private static async logMonitoringActivity(
    context: MonitoringContext,
    result: "started" | "completed" | "error",
    details?: any
  ): Promise<void> {
    try {
      await database.query(
        `INSERT INTO system_monitoring_logs 
         (monitoring_type, building_id, equipment_id, check_result, details, 
          alerts_generated, processing_time_ms) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          context.data_type === "energy"
            ? "energy_threshold"
            : context.data_type === "power_quality"
              ? "power_quality"
              : context.data_type === "equipment"
                ? "equipment_health"
                : "compliance_check",
          context.building_id,
          context.equipment_id,
          result === "completed"
            ? "passed"
            : result === "error"
              ? "failed"
              : "warning",
          JSON.stringify(details || {}),
          details?.alerts_generated || 0,
          details?.processing_time_ms || 0,
        ]
      );
    } catch (error) {
      logger.error("Error logging monitoring activity:", error);
    }
  }

  /**
   * Determine if anomaly detection should run
   */
  private static async shouldRunAnomalyDetection(
    buildingId: number
  ): Promise<boolean> {
    try {
      // Check cache first
      const cacheKey = `anomaly_check:${buildingId}`;
      const lastCheck = await redisClient.get(cacheKey);

      if (lastCheck) {
        return false; // Already checked recently
      }

      // Run anomaly detection every 10 readings or once per hour
      const recentReadings = await database.queryOne(
        `SELECT COUNT(*) as count FROM energy_consumption 
         WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
        [buildingId]
      );

      const shouldRun = recentReadings?.count >= 10;

      if (shouldRun) {
        // Cache to prevent duplicate runs
        await redisClient.set(cacheKey, true, 3600); // 1 hour
      }

      return shouldRun;
    } catch (error) {
      logger.error("Error checking anomaly detection criteria:", error);
      return false;
    }
  }

  /**
   * Determine if efficiency analysis should run
   */
  private static async shouldRunEfficiencyAnalysis(
    buildingId: number
  ): Promise<boolean> {
    try {
      // Check cache first
      const cacheKey = `efficiency_check:${buildingId}`;
      const lastCheck = await redisClient.get(cacheKey);

      if (lastCheck) {
        return false; // Already checked recently
      }

      // Run efficiency analysis daily
      const recentReadings = await database.queryOne(
        `SELECT COUNT(*) as count FROM energy_consumption 
         WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
        [buildingId]
      );

      const shouldRun = recentReadings?.count >= 24; // At least 24 hourly readings

      if (shouldRun) {
        // Cache to prevent duplicate runs
        await redisClient.set(cacheKey, true, 86400); // 24 hours
      }

      return shouldRun;
    } catch (error) {
      logger.error("Error checking efficiency analysis criteria:", error);
      return false;
    }
  }

  /**
   * Middleware to attach monitoring to energy routes
   */
  public static attachEnergyMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;

      res.send = function (data) {
        // Extract energy data from response
        if (res.statusCode === 201 && data) {
          try {
            const responseData =
              typeof data === "string" ? JSON.parse(data) : data;
            if (responseData.success && responseData.data) {
              res.locals.energyData = responseData.data;
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Middleware to attach monitoring to power quality routes
   */
  public static attachPowerQualityMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;

      res.send = function (data) {
        if (res.statusCode === 201 && data) {
          try {
            const responseData =
              typeof data === "string" ? JSON.parse(data) : data;
            if (responseData.success && responseData.data) {
              res.locals.powerQualityData = responseData.data;
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Middleware to attach monitoring to equipment routes
   */
  public static attachEquipmentMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;

      res.send = function (data) {
        if ((res.statusCode === 200 || res.statusCode === 201) && data) {
          try {
            const responseData =
              typeof data === "string" ? JSON.parse(data) : data;
            if (responseData.success && responseData.data) {
              res.locals.equipmentData = responseData.data;
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Middleware to attach monitoring to audit routes
   */
  public static attachAuditMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;

      res.send = function (data) {
        if ((res.statusCode === 200 || res.statusCode === 201) && data) {
          try {
            const responseData =
              typeof data === "string" ? JSON.parse(data) : data;
            if (responseData.success && responseData.data) {
              res.locals.auditData = responseData.data;
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Get recent monitoring data from cache
   */
  public static async getRecentMonitoringData(
    buildingId: number,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const listKey = `monitoring:${buildingId}:recent`;
      return await redisClient.lrange(listKey, 0, limit - 1);
    } catch (error) {
      logger.error("Error getting recent monitoring data:", error);
      return [];
    }
  }
}

export default MonitoringMiddleware;
