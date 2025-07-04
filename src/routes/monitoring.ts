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
import Joi from "joi";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const buildingIdParamsValidation = Joi.object({
  buildingId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Building ID must be a valid number",
    "any.required": "Building ID is required",
  }),
});

const jobIdParamsValidation = Joi.object({
  jobId: Joi.string().required().pattern(/^\d+$/).messages({
    "string.pattern.base": "Job ID must be a valid number",
    "any.required": "Job ID is required",
  }),
});

const monitoringQueryValidation = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  type: Joi.string()
    .valid(
      "energy_threshold",
      "power_quality",
      "equipment_health",
      "compliance_check",
      "anomaly_detection"
    )
    .optional(),
});

const createJobValidation = Joi.object({
  jobType: Joi.string()
    .valid(...Object.values(JobType))
    .required(),
  buildingId: Joi.number().integer().positive().optional(),
  equipmentId: Joi.number().integer().positive().optional(),
  parameters: Joi.object().optional(),
});

/**
 * @route GET /api/monitoring/dashboard
 * @desc Generate comprehensive monitoring dashboard with system health and performance metrics
 * @details Provides real-time monitoring dashboard including system statistics, building-level
 *          monitoring summaries, alert distribution analysis, equipment health indicators,
 *          performance metrics, connected user tracking, and critical system status indicators.
 *          Delivers executive-level system health overview for operational management and
 *          strategic decision-making with actionable insights and priority recommendations.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/monitoring/dashboard
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Monitoring dashboard data retrieved successfully",
 *   "data": {
 *     "systemStats": {
 *       "totalBuildings": 8,
 *       "totalAlerts": 18,
 *       "criticalAlerts": 2,
 *       "faultyEquipment": 5,
 *       "connectedUsers": 12
 *     },
 *     "buildings": [
 *       {
 *         "id": 1,
 *         "name": "Green Energy Office Complex",
 *         "status": "normal",
 *         "active_alerts": 2,
 *         "critical_alerts": 0,
 *         "high_alerts": 1,
 *         "medium_alerts": 1,
 *         "equipment_count": 45,
 *         "faulty_equipment": 0,
 *         "system_health_score": 92.5,
 *         "energy_efficiency": 88.2,
 *         "power_quality_score": 89.1,
 *         "last_update": "2024-07-03T14:29:45Z"
 *       },
 *       {
 *         "id": 2,
 *         "name": "Manufacturing Plant A",
 *         "status": "warning",
 *         "active_alerts": 8,
 *         "critical_alerts": 1,
 *         "high_alerts": 3,
 *         "medium_alerts": 4,
 *         "equipment_count": 78,
 *         "faulty_equipment": 3,
 *         "system_health_score": 76.3,
 *         "energy_efficiency": 82.1,
 *         "power_quality_score": 74.8,
 *         "last_update": "2024-07-03T14:29:50Z"
 *       }
 *     ],
 *     "performance_metrics": {
 *       "data_collection_rate": 99.8,
 *       "alert_response_time_avg_minutes": 8.5,
 *       "system_uptime_percentage": 99.95,
 *       "processing_latency_ms": 125,
 *       "storage_utilization_percentage": 67.2
 *     },
 *     "recent_activities": [
 *       {
 *         "timestamp": "2024-07-03T14:25:00Z",
 *         "type": "alert_generated",
 *         "building": "Manufacturing Plant A",
 *         "description": "Power factor below target threshold",
 *         "severity": "medium"
 *       },
 *       {
 *         "timestamp": "2024-07-03T14:20:15Z",
 *         "type": "maintenance_completed",
 *         "building": "Green Energy Office Complex",
 *         "description": "HVAC system preventive maintenance",
 *         "status": "success"
 *       }
 *     ],
 *     "system_health": {
 *       "overall_score": 87.5,
 *       "components": {
 *         "database": 95.2,
 *         "redis_cache": 98.1,
 *         "background_jobs": 89.7,
 *         "data_collection": 99.8,
 *         "alert_system": 92.3
 *       }
 *     },
 *     "recommendations": [
 *       "Address critical alert in Manufacturing Plant A",
 *       "Review power quality issues in Building 2",
 *       "Consider preventive maintenance for equipment showing degradation"
 *     ]
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Monitoring data service temporarily unavailable",
 *   "error": "SERVICE_UNAVAILABLE",
 *   "details": {
 *     "last_successful_update": "2024-07-03T14:25:00Z",
 *     "estimated_recovery_time": "2024-07-03T14:35:00Z"
 *   }
 * }
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
 * @route GET /api/monitoring/activities
 * @desc Retrieve recent monitoring activities with detailed analysis and performance tracking
 * @details Fetches comprehensive monitoring activity log including energy threshold monitoring,
 *          power quality assessments, equipment health checks, compliance monitoring, and
 *          anomaly detection activities. Provides detailed activity analysis with performance
 *          metrics, trend identification, and operational insights for continuous system
 *          optimization and proactive maintenance planning.
 * @access Private (Energy Manager, Facility Engineer, Admin)
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
 * @route GET /api/monitoring/building/:buildingId/recent
 * @desc Retrieve recent building-specific monitoring data with real-time insights
 * @details Provides building-specific monitoring data including recent activity summaries,
 *          latest energy statistics, power quality indicators, equipment status updates,
 *          alert summaries, and performance metrics. Includes cached data optimization
 *          for real-time dashboard updates and mobile access. Enables building-level
 *          operational monitoring and rapid response to emerging issues.
 * @access Private (All authenticated users)
 */
router.get(
  "/building/:buildingId/recent",
  validateParams(buildingIdParamsValidation),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { buildingId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      // Get from cache first
      const recentData = await MonitoringMiddleware.getRecentMonitoringData(
        parseInt(buildingId),
        limit
      );

      // Get latest monitoring stats from cache
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
            energy: energyStats,
            powerQuality: pqStats,
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
 * @route GET /api/monitoring/jobs
 * @desc Retrieve background job status with performance analytics and resource utilization
 * @details Provides comprehensive background job management including job status tracking,
 *          progress monitoring, error analysis, performance metrics, resource utilization,
 *          queue management, and processor health indicators. Enables system administrators
 *          to monitor background processing performance and optimize system resource
 *          allocation for improved operational efficiency.
 * @access Private (Energy Manager, Admin)
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
 * @route GET /api/monitoring/jobs/:jobId
 * @desc Retrieve specific job status with detailed execution analysis and performance metrics
 * @details Provides detailed job-specific information including execution status, progress
 *          tracking, performance metrics, error analysis, resource utilization, execution
 *          timeline, and completion indicators. Enables detailed job monitoring and
 *          troubleshooting for system optimization and performance improvement.
 * @access Private (Energy Manager, Admin)
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
 * @route POST /api/monitoring/jobs
 * @desc Create new background job with intelligent scheduling and resource allocation
 * @details Creates new background job with advanced scheduling including job type validation,
 *          resource allocation optimization, priority assignment, dependency management,
 *          scheduling optimization, and performance tracking setup. Enables automated
 *          system monitoring and maintenance task execution with intelligent resource
 *          management and priority-based scheduling.
 * @access Private (Energy Manager, Admin)
 * @example_request
 * POST /api/monitoring/jobs
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "Content-Type": "application/json" }
 * Body: {
 *   "jobType": "ENERGY_ANALYSIS",
 *   "buildingId": 1,
 *   "parameters": {
 *     "analysis_type": "comprehensive",
 *     "date_range": "last_30_days",
 *     "include_forecasting": true,
 *     "include_anomaly_detection": true,
 *     "generate_report": true,
 *     "report_format": "pdf",
 *     "notify_on_completion": true,
 *     "priority": "normal"
 *   },
 *   "scheduled_start": "2024-07-03T15:00:00Z",
 *   "max_execution_time_minutes": 60,
 *   "notification_emails": ["energymanager@company.com"]
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Background job created successfully",
 *   "data": {
 *     "jobId": 1247,
 *     "job_code": "JOB-2024-07-03-001",
 *     "jobType": "ENERGY_ANALYSIS",
 *     "status": "queued",
 *     "priority": "normal",
 *     "buildingId": 1,
 *     "building_name": "Green Energy Office Complex",
 *     "parameters": {
 *       "analysis_type": "comprehensive",
 *       "date_range": "last_30_days",
 *       "include_forecasting": true,
 *       "include_anomaly_detection": true,
 *       "generate_report": true,
 *       "report_format": "pdf"
 *     },
 *     "scheduling": {
 *       "scheduled_start": "2024-07-03T15:00:00Z",
 *       "estimated_duration_minutes": 45,
 *       "estimated_completion": "2024-07-03T15:45:00Z",
 *       "queue_position": 3,
 *       "estimated_start_delay_minutes": 12
 *     },
 *     "resource_allocation": {
 *       "cpu_priority": "normal",
 *       "memory_allocation_mb": 512,
 *       "storage_requirement_mb": 150,
 *       "network_usage": "low"
 *     },
 *     "progress_tracking": {
 *       "progress_percentage": 0,
 *       "current_step": "queued",
 *       "total_steps": 8,
 *       "status_url": "/api/monitoring/jobs/1247",
 *       "real_time_updates": true
 *     },
 *     "notification_settings": {
 *       "progress_updates": true,
 *       "completion_notification": true,
 *       "error_notification": true,
 *       "notification_emails": ["energymanager@company.com"]
 *     },
 *     "expected_outputs": [
 *       {
 *         "type": "analysis_report",
 *         "format": "pdf",
 *         "estimated_size_mb": 15,
 *         "download_url": "/api/reports/{report_id}/download"
 *       },
 *       {
 *         "type": "data_export",
 *         "format": "excel",
 *         "estimated_size_mb": 8,
 *         "download_url": "/api/monitoring/jobs/1247/export"
 *       }
 *     ],
 *     "created_at": "2024-07-03T14:30:00Z",
 *     "created_by": 15,
 *     "creator_name": "Maria Santos"
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Insufficient data for energy analysis",
 *   "error": "INSUFFICIENT_DATA",
 *   "details": {
 *     "required_data_points": 720,
 *     "available_data_points": 245,
 *     "missing_period": "2024-06-10 to 2024-06-15",
 *     "recommendation": "Wait for more data collection or adjust analysis period"
 *   }
 * }
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
 * @route GET /api/monitoring/system-status
 * @desc Retrieve comprehensive system health status with performance analytics and diagnostics
 * @details Provides complete system health assessment including database health, Redis
 *          performance, background processor status, socket connection analytics, recent
 *          alert summaries, system performance metrics, resource utilization, and service
 *          availability indicators. Enables comprehensive system monitoring and proactive
 *          maintenance for optimal system performance and reliability.
 * @access Private (Admin only)
 */
router.get(
  "/system-status",
  authorizeRoles(UserRole.ADMIN),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      // Database health
      const dbHealthy = await database.healthCheck();
      const dbStats = await database.getStats();

      // Redis health
      const redisHealthy = await redisClient.ping();
      const redisMemory = await redisClient.getMemoryUsage();

      // Background processor status
      const processorStatus = backgroundJobProcessor.getStatus();

      // Socket connections
      const socketStats = socketManager.getConnectionStats();

      // Recent alerts
      const recentAlerts = await database.query(`
        SELECT COUNT(*) as count, severity
        FROM alerts 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY severity
      `);

      // System load and performance metrics
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
 * @route POST /api/monitoring/cache/clear
 * @desc Clear monitoring cache with selective cleanup and performance optimization
 * @details Performs intelligent cache cleanup including selective pattern-based clearing,
 *          monitoring data cache refresh, job queue optimization, anomaly detection cache
 *          cleanup, efficiency calculation cache reset, and database cache maintenance.
 *          Provides system performance optimization and memory management for improved
 *          monitoring system responsiveness and resource utilization.
 * @access Private (Admin only)
 */
router.post(
  "/cache/clear",
  authorizeRoles(UserRole.ADMIN),
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      // Clear Redis cache patterns
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

      // Clear database cache
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
 * @route GET /api/monitoring/configurations
 * @desc Retrieve monitoring configurations with performance analytics and optimization insights
 * @details Provides comprehensive monitoring configuration management including active
 *          configuration settings, building and equipment associations, monitoring type
 *          classifications, performance indicators, effectiveness metrics, and optimization
 *          recommendations. Enables intelligent monitoring system configuration and
 *          performance tuning for optimal system responsiveness and accuracy.
 * @access Private (Energy Manager, Admin)
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
