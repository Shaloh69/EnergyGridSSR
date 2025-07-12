// monitoring.ts
import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import { authenticateToken, authorizeRoles } from "@/middleware/auth";
import {
  validateQuery,
  validateParams,
  validateBody,
} from "@/middleware/validation";
import { MonitoringMiddleware } from "@/middleware/monitoring";
import {
  backgroundJobProcessor,
  JobType,
} from "@/services/backgroundProcessor";
import { database } from "@/config/database";
import { redisClient } from "@/config/redis";
import { socketManager } from "@/config/socket";
import { UserRole } from "@/types/enums";
import { ApiResponse } from "@/interfaces/IResponse";
import { logger } from "@/utils/logger";
import {
  monitoringQueryValidation,
  createJobValidation,
  recentDataQueryValidation,
} from "@/validations/monitoringValidation";
import {
  buildingIdParamsValidation,
  idParamsValidation,
} from "@/validations/commonValidations";

const router = Router();

router.use(authenticateToken);

// Additional validation schema that needs to be moved to monitoringValidation.ts
const jobIdParamsValidation = idParamsValidation;

// Routes

/**
 * Get monitoring dashboard overview
 */
router.get("/dashboard", async (req: Request, res: Response<ApiResponse>) => {
  try {
    const dashboardData = await database.query(`
      SELECT * FROM monitoring_dashboard_summary
      ORDER BY critical_alerts DESC, high_alerts DESC
    `);

    const systemStats = {
      totalBuildings: dashboardData.length,
      totalAlerts: dashboardData.reduce(
        (sum: number, building: any) => sum + building.active_alerts,
        0
      ),
      criticalAlerts: dashboardData.reduce(
        (sum: number, building: any) => sum + building.critical_alerts,
        0
      ),
      faultyEquipment: dashboardData.reduce(
        (sum: number, building: any) => sum + building.faulty_equipment,
        0
      ),
      connectedUsers: socketManager.getConnectedUsers(),
    };

    return res.json({
      success: true,
      message: "Monitoring dashboard data retrieved successfully",
      data: {
        systemStats,
        buildings: dashboardData,
      },
    });
  } catch (error) {
    logger.error("Error fetching monitoring dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch monitoring dashboard",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Get recent monitoring activities
 */
router.get(
  "/activities",
  authorizeRoles(
    UserRole.ADMIN,
    UserRole.ENERGY_MANAGER,
    UserRole.FACILITY_ENGINEER
  ),
  validateQuery(monitoringQueryValidation),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { limit, startDate, endDate, type } = req.query as any;

      let query = `
        SELECT * FROM recent_monitoring_activities
        WHERE 1=1
      `;
      const params: any[] = [];

      if (type) {
        query += ` AND monitoring_type = ?`;
        params.push(type);
      }

      if (startDate) {
        query += ` AND checked_at >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND checked_at <= ?`;
        params.push(endDate);
      }

      query += ` ORDER BY checked_at DESC LIMIT ?`;
      params.push(limit);

      const activities = await database.query(query, params);

      return res.json({
        success: true,
        message: "Monitoring activities retrieved successfully",
        data: activities,
      });
    } catch (error) {
      logger.error("Error fetching monitoring activities:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch monitoring activities",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Get recent monitoring data for specific building
 */
router.get(
  "/building/:buildingId/recent",
  validateParams(buildingIdParamsValidation),
  validateQuery(recentDataQueryValidation),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { buildingId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const recentData = await MonitoringMiddleware.getRecentMonitoringData(
        parseInt(buildingId),
        limit
      );

      const energyStats = await redisClient.get(
        `monitoring:energy:${buildingId}:latest`
      );
      const pqStats = await redisClient.get(
        `monitoring:power_quality:${buildingId}:latest`
      );

      return res.json({
        success: true,
        message: "Recent monitoring data retrieved successfully",
        data: {
          recentActivities: recentData,
          latestStats: {
            energy: energyStats ? JSON.parse(energyStats) : null,
            powerQuality: pqStats ? JSON.parse(pqStats) : null,
          },
        },
      });
    } catch (error) {
      logger.error("Error fetching recent monitoring data:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch recent monitoring data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Get all background jobs
 */
router.get(
  "/jobs",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const jobs = await database.query(`
        SELECT 
          id,
          job_type,
          status,
          building_id,
          equipment_id,
          progress_percentage,
          error_message,
          started_at,
          completed_at,
          created_at
        FROM background_jobs 
        ORDER BY created_at DESC 
        LIMIT 50
      `);

      const processorStatus = backgroundJobProcessor.getStatus();

      return res.json({
        success: true,
        message: "Background jobs retrieved successfully",
        data: {
          jobs,
          processorStatus,
        },
      });
    } catch (error) {
      logger.error("Error fetching background jobs:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch background jobs",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Get specific background job status
 */
router.get(
  "/jobs/:jobId",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateParams(jobIdParamsValidation),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { jobId } = req.params;
      const job = await backgroundJobProcessor.getJobStatus(parseInt(jobId));

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
          error: "Job with specified ID does not exist",
        });
      }

      return res.json({
        success: true,
        message: "Job status retrieved successfully",
        data: job,
      });
    } catch (error) {
      logger.error("Error fetching job status:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch job status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Create new background job
 */
router.post(
  "/jobs",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  validateBody(createJobValidation),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { jobType, buildingId, equipmentId, parameters } = req.body;

      const jobId = await backgroundJobProcessor.createJob(
        jobType as JobType,
        buildingId,
        equipmentId,
        parameters
      );

      return res.status(201).json({
        success: true,
        message: "Background job created successfully",
        data: { jobId },
      });
    } catch (error) {
      logger.error("Error creating background job:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create background job",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Get system status (admin only)
 */
router.get(
  "/system-status",
  authorizeRoles(UserRole.ADMIN),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const dbHealthy = await database.healthCheck();
      const dbStats = await database.getStats();

      const redisHealthy = await redisClient.ping();
      const redisMemory = await redisClient.getMemoryUsage();

      const processorStatus = backgroundJobProcessor.getStatus();

      const socketStats = socketManager.getConnectionStats();

      const recentAlerts = await database.query(`
        SELECT COUNT(*) as count, severity
        FROM alerts 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY severity
      `);

      const systemMetrics = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      };

      return res.json({
        success: true,
        message: "System status retrieved successfully",
        data: {
          services: {
            database: { healthy: dbHealthy, stats: dbStats },
            redis: { healthy: redisHealthy, memory: redisMemory },
            backgroundProcessor: processorStatus,
            socketConnections: socketStats,
          },
          alerts: recentAlerts,
          system: systemMetrics,
        },
      });
    } catch (error) {
      logger.error("Error fetching system status:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch system status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Clear monitoring cache (admin only)
 */
router.post(
  "/cache/clear",
  authorizeRoles(UserRole.ADMIN),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const patterns = [
        "monitoring:*",
        "job:*",
        "anomaly_check:*",
        "efficiency_check:*",
      ];

      let totalCleared = 0;
      for (const pattern of patterns) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
          totalCleared += keys.length;
        }
      }

      await database.query(
        "DELETE FROM monitoring_stats_cache WHERE expires_at < NOW()"
      );

      return res.json({
        success: true,
        message: "Monitoring cache cleared successfully",
        data: { keysCleared: totalCleared },
      });
    } catch (error) {
      logger.error("Error clearing monitoring cache:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to clear monitoring cache",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Get monitoring configurations
 */
router.get(
  "/configurations",
  authorizeRoles(UserRole.ADMIN, UserRole.ENERGY_MANAGER),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const configurations = await database.query(`
        SELECT 
          mc.*,
          b.name as building_name,
          e.name as equipment_name
        FROM monitoring_configurations mc
        LEFT JOIN buildings b ON mc.building_id = b.id
        LEFT JOIN equipment e ON mc.equipment_id = e.id
        WHERE mc.enabled = TRUE
        ORDER BY mc.config_type, mc.building_id, mc.equipment_id
      `);

      return res.json({
        success: true,
        message: "Monitoring configurations retrieved successfully",
        data: configurations,
      });
    } catch (error) {
      logger.error("Error fetching monitoring configurations:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch monitoring configurations",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
