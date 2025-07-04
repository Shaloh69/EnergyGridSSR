import { database } from "@/config/database";
import { redisClient } from "@/config/redis";
import { logger } from "@/utils/logger";
import analyticsService from "./analyticsService";
import alertService from "./alertService";

export enum JobType {
  ANALYTICS_PROCESSING = "analytics_processing",
  ALERT_MONITORING = "alert_monitoring",
  COMPLIANCE_CHECK = "compliance_check",
  MAINTENANCE_PREDICTION = "maintenance_prediction",
  FORECAST_GENERATION = "forecast_generation",
}

export enum JobStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

interface BackgroundJob {
  id: number;
  job_type: JobType;
  status: JobStatus;
  building_id?: number;
  equipment_id?: number;
  job_parameters?: Record<string, any>;
  progress_percentage: number;
  result_data?: Record<string, any>;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface JobProcessor {
  process(job: BackgroundJob): Promise<any>;
}

// Job validation schemas
const JOB_SCHEMAS = {
  [JobType.ANALYTICS_PROCESSING]: {
    required: ["building_id", "start_date", "end_date"],
    optional: ["analysis_types", "equipment_id"],
  },
  [JobType.ALERT_MONITORING]: {
    required: ["building_id"],
    optional: ["monitoring_types", "thresholds"],
  },
  [JobType.COMPLIANCE_CHECK]: {
    required: ["audit_id"],
    optional: ["check_types", "standards"],
  },
  [JobType.MAINTENANCE_PREDICTION]: {
    required: [],
    optional: ["building_id", "equipment_id"],
  },
  [JobType.FORECAST_GENERATION]: {
    required: ["building_id"],
    optional: ["forecast_days", "forecast_types"],
  },
};

class BackgroundJobProcessor {
  private processors: Map<JobType, JobProcessor> = new Map();
  private isRunning = false;
  private processingInterval = 10000; // 10 seconds
  private maxConcurrentJobs = 3; // Initialize with default value
  private currentlyProcessing = new Set<number>();
  private processingTimer?: NodeJS.Timeout;
  private initialized = false;
  private debugMode = process.env.NODE_ENV === "development";

  constructor() {
    this.registerProcessors();
    // Ensure maxConcurrentJobs is properly initialized as a number
    const envMaxJobs = process.env.MAX_CONCURRENT_JOBS;
    const parsedMaxJobs = envMaxJobs ? parseInt(envMaxJobs, 10) : 3;
    this.maxConcurrentJobs =
      Number.isInteger(parsedMaxJobs) && parsedMaxJobs > 0 ? parsedMaxJobs : 3;

    logger.info(
      `Background processor initialized with maxConcurrentJobs: ${this.maxConcurrentJobs}`
    );
  }

  private registerProcessors(): void {
    this.processors.set(JobType.ANALYTICS_PROCESSING, new AnalyticsProcessor());
    this.processors.set(
      JobType.ALERT_MONITORING,
      new AlertMonitoringProcessor()
    );
    this.processors.set(
      JobType.COMPLIANCE_CHECK,
      new ComplianceCheckProcessor()
    );
    this.processors.set(
      JobType.MAINTENANCE_PREDICTION,
      new MaintenancePredictionProcessor()
    );
    this.processors.set(
      JobType.FORECAST_GENERATION,
      new ForecastGenerationProcessor()
    );
  }

  /**
   * Test database connection and table existence with enhanced validation
   */
  public async testDatabaseConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // Test basic database connection
      const connectionTest = await database.healthCheck();
      if (!connectionTest) {
        return {
          success: false,
          message: "Database connection failed",
        };
      }

      // Test if background_jobs table exists
      const tableExists = await database.tableExists("background_jobs");
      if (!tableExists) {
        // Try to create the table
        try {
          await this.ensureBackgroundJobsTable();

          // Verify table was created successfully
          const tableCreated = await database.tableExists("background_jobs");
          if (!tableCreated) {
            return {
              success: false,
              message: "Failed to verify table creation",
              details: {
                connection: true,
                table_exists: false,
                creation_attempted: true,
              },
            };
          }

          return {
            success: true,
            message:
              "Database connection successful, background_jobs table created",
            details: {
              connection: true,
              table_exists: true,
              table_created: true,
            },
          };
        } catch (createError) {
          return {
            success: false,
            message:
              "Database connection successful but failed to create background_jobs table",
            details: {
              connection: true,
              table_exists: false,
              creation_error:
                createError instanceof Error
                  ? createError.message
                  : "Unknown error",
            },
          };
        }
      }

      // Test basic query functionality with the safer approach
      try {
        const testQuery = await database.query(
          "SELECT COUNT(*) as job_count FROM background_jobs WHERE status = ?",
          ["pending"]
        );

        // Test the specific query that's causing issues
        try {
          const pendingJobsTest = await this.getPendingJobsSafe();

          return {
            success: true,
            message: "Database connection and all queries working properly",
            details: {
              connection: true,
              table_exists: true,
              query_test: true,
              current_jobs: testQuery[0]?.job_count || 0,
              pending_jobs_query: true,
              pending_jobs_count: pendingJobsTest.length,
            },
          };
        } catch (pendingJobsError) {
          return {
            success: false,
            message: "Basic queries work but pending jobs query failed",
            details: {
              connection: true,
              table_exists: true,
              query_test: true,
              current_jobs: testQuery[0]?.job_count || 0,
              pending_jobs_error:
                pendingJobsError instanceof Error
                  ? pendingJobsError.message
                  : "Unknown error",
            },
          };
        }
      } catch (queryError) {
        return {
          success: false,
          message: "Database connection successful but query failed",
          details: {
            connection: true,
            table_exists: true,
            query_error:
              queryError instanceof Error
                ? queryError.message
                : "Unknown error",
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Database test failed",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Validate job parameters against schema
   */
  private validateJobParameters(
    jobType: JobType,
    parameters?: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const schema = JOB_SCHEMAS[jobType];
    const errors: string[] = [];

    if (!schema) {
      errors.push(`Unknown job type: ${jobType}`);
      return { valid: false, errors };
    }

    const params = parameters || {};

    // Check required parameters
    for (const required of schema.required) {
      if (
        !(required in params) ||
        params[required] === null ||
        params[required] === undefined
      ) {
        errors.push(`Missing required parameter: ${required}`);
      }
    }

    // Validate specific parameter types
    if (params.building_id && !Number.isInteger(Number(params.building_id))) {
      errors.push("building_id must be a valid integer");
    }

    if (params.equipment_id && !Number.isInteger(Number(params.equipment_id))) {
      errors.push("equipment_id must be a valid integer");
    }

    if (params.start_date && !this.isValidDate(params.start_date)) {
      errors.push("start_date must be a valid date");
    }

    if (params.end_date && !this.isValidDate(params.end_date)) {
      errors.push("end_date must be a valid date");
    }

    return { valid: errors.length === 0, errors };
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Create a job with parameter validation
   */
  public async createJob(
    jobType: JobType,
    buildingId?: number,
    equipmentId?: number,
    parameters?: Record<string, any>
  ): Promise<number> {
    try {
      // Merge basic parameters with additional parameters
      const allParameters = {
        ...(parameters || {}),
        ...(buildingId && { building_id: buildingId }),
        ...(equipmentId && { equipment_id: equipmentId }),
      };

      // Validate parameters
      const validation = this.validateJobParameters(jobType, allParameters);
      if (!validation.valid) {
        throw new Error(
          `Job validation failed: ${validation.errors.join(", ")}`
        );
      }

      // Ensure table exists
      const tableExists = await database.tableExists("background_jobs");
      if (!tableExists) {
        await this.ensureBackgroundJobsTable();
      }

      // Create the job
      const result = await database.query(
        `INSERT INTO background_jobs (job_type, building_id, equipment_id, job_parameters) 
         VALUES (?, ?, ?, ?)`,
        [
          jobType,
          buildingId || null,
          equipmentId || null,
          JSON.stringify(allParameters),
        ]
      );

      const jobId = (result as any).insertId;
      logger.info(
        `Created background job ${jobId} of type ${jobType} with valid parameters`
      );

      // Cache job creation
      await redisClient.set(
        `job:${jobId}`,
        {
          status: "pending",
          created_at: new Date(),
          parameters: allParameters,
        },
        3600
      );

      return jobId;
    } catch (error) {
      logger.error("Error creating background job:", error);
      throw error;
    }
  }

  /**
   * Create a test job with sample data
   */
  public async createTestJob(jobType: JobType): Promise<number> {
    try {
      let parameters: Record<string, any> = {};

      switch (jobType) {
        case JobType.ANALYTICS_PROCESSING:
          // Get a sample building for testing
          const buildings = await database.query(
            "SELECT id FROM buildings LIMIT 1"
          );
          const buildingId = buildings[0]?.id || 1;

          parameters = {
            building_id: buildingId,
            start_date: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(), // 30 days ago
            end_date: new Date().toISOString(),
            analysis_types: ["energy", "anomaly", "efficiency"],
          };
          break;

        case JobType.ALERT_MONITORING:
          const sampleBuilding = await database.query(
            "SELECT id FROM buildings LIMIT 1"
          );
          parameters = {
            building_id: sampleBuilding[0]?.id || 1,
            monitoring_types: ["energy", "power_quality", "equipment"],
          };
          break;

        case JobType.COMPLIANCE_CHECK:
          const audits = await database.query("SELECT id FROM audits LIMIT 1");
          parameters = {
            audit_id: audits[0]?.id || 1,
            check_types: ["comprehensive"],
          };
          break;

        case JobType.MAINTENANCE_PREDICTION:
          const equipment = await database.query(
            "SELECT id, building_id FROM equipment LIMIT 1"
          );
          parameters = {
            building_id: equipment[0]?.building_id || 1,
            equipment_id: equipment[0]?.id,
          };
          break;

        case JobType.FORECAST_GENERATION:
          const forecastBuilding = await database.query(
            "SELECT id FROM buildings LIMIT 1"
          );
          parameters = {
            building_id: forecastBuilding[0]?.id || 1,
            forecast_days: 30,
            forecast_types: ["consumption", "demand"],
          };
          break;
      }

      return await this.createJob(
        jobType,
        parameters.building_id,
        parameters.equipment_id,
        parameters
      );
    } catch (error) {
      logger.error("Error creating test job:", error);
      throw error;
    }
  }

  /**
   * Get job status with enhanced information
   */
  public async getJobStatus(jobId: number): Promise<BackgroundJob | null> {
    try {
      // Try cache first
      const cached = await redisClient.get(`job:${jobId}`);
      if (cached) {
        return cached;
      }

      // Fallback to database
      const job = await database.queryOne<BackgroundJob>(
        "SELECT * FROM background_jobs WHERE id = ?",
        [jobId]
      );

      if (job) {
        // Parse job_parameters if it's a string
        if (typeof job.job_parameters === "string") {
          try {
            job.job_parameters = JSON.parse(job.job_parameters);
          } catch (e) {
            logger.warn(`Failed to parse job_parameters for job ${jobId}`);
          }
        }

        await redisClient.set(`job:${jobId}`, job, 300);
      }

      return job;
    } catch (error) {
      logger.error("Error getting job status:", error);
      return null;
    }
  }

  /**
   * Get processing statistics
   */
  public async getProcessingStats(): Promise<any> {
    try {
      const tableExists = await database.tableExists("background_jobs");
      if (!tableExists) {
        return { error: "Background jobs table does not exist" };
      }

      const stats = await database.queryOne(`
        SELECT 
          COUNT(*) as total_jobs,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_jobs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
          AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
              THEN TIMESTAMPDIFF(SECOND, started_at, completed_at) 
              ELSE NULL END) as avg_processing_time_seconds
        FROM background_jobs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      const recentJobs = await database.query(`
        SELECT id, job_type, status, progress_percentage, 
               TIMESTAMPDIFF(SECOND, created_at, COALESCE(completed_at, NOW())) as age_seconds,
               error_message
        FROM background_jobs 
        ORDER BY created_at DESC 
        LIMIT 10
      `);

      return {
        ...stats,
        recent_jobs: recentJobs,
        processor_status: this.getStatus(),
        currently_processing: Array.from(this.currentlyProcessing),
      };
    } catch (error) {
      logger.error("Error getting processing stats:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Enhanced database table creation
   */
  private async ensureBackgroundJobsTable(): Promise<void> {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS background_jobs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          job_type ENUM('analytics_processing', 'alert_monitoring', 'compliance_check', 'maintenance_prediction', 'forecast_generation') NOT NULL,
          status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
          building_id INT NULL,
          equipment_id INT NULL,
          job_parameters JSON NULL,
          progress_percentage DECIMAL(5,2) DEFAULT 0,
          result_data JSON NULL,
          error_message TEXT NULL,
          started_at TIMESTAMP NULL,
          completed_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_status (status),
          INDEX idx_job_type (job_type),
          INDEX idx_building_id (building_id),
          INDEX idx_created_at (created_at),
          INDEX idx_status_created (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      await database.query(createTableSQL);
      logger.info("Background jobs table ensured");
    } catch (error) {
      logger.error("Error creating background_jobs table:", error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Background job processor is already running");
      return;
    }

    const initialized = await this.initialize();
    if (!initialized) {
      logger.warn(
        "Background job processor starting with limited functionality"
      );
    }

    this.isRunning = true;
    logger.info("Starting background job processor");
    this.scheduleProcessing();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    logger.info("Background job processor stopped");
  }

  private async initialize(): Promise<boolean> {
    try {
      await this.ensureBackgroundJobsTable();
      this.initialized = true;
      logger.info("Background job processor initialized successfully");
      return true;
    } catch (error) {
      logger.error("Error initializing background job processor:", error);
      return false;
    }
  }

  private scheduleProcessing(): void {
    if (!this.isRunning) return;

    this.processingTimer = setTimeout(async () => {
      try {
        if (this.initialized) {
          await this.processJobsBatch();
        }
      } catch (error) {
        logger.error("Error in background job processing:", error);
      } finally {
        this.scheduleProcessing();
      }
    }, this.processingInterval);
  }

  /**
   * Alternative method to get pending jobs using a different approach
   */
  private async getPendingJobsSafe(): Promise<BackgroundJob[]> {
    try {
      const tableExists = await database.tableExists("background_jobs");
      if (!tableExists) {
        logger.warn(
          "background_jobs table does not exist, attempting to create it"
        );
        try {
          await this.ensureBackgroundJobsTable();
        } catch (createError) {
          logger.error("Failed to create background_jobs table:", createError);
          return [];
        }
      }

      // First get all pending jobs without LIMIT
      const allPendingJobs = await database.query<BackgroundJob>(
        `SELECT * FROM background_jobs WHERE status = ? ORDER BY created_at ASC`,
        ["pending"]
      );

      // Then slice to the desired limit in JavaScript
      const limit = Math.max(1, Math.min(10, this.maxConcurrentJobs)); // Ensure reasonable bounds
      const jobs = (allPendingJobs || []).slice(0, limit);

      logger.debug(
        `Found ${allPendingJobs?.length || 0} total pending jobs, returning ${jobs.length} jobs`
      );
      return jobs;
    } catch (error) {
      logger.error("Error in getPendingJobsSafe:", error);
      return [];
    }
  }

  private async processJobsBatch(): Promise<void> {
    try {
      if (this.currentlyProcessing.size < this.maxConcurrentJobs) {
        // Try the primary method first, fallback to safe method
        let pendingJobs: BackgroundJob[] = [];

        try {
          pendingJobs = await this.getPendingJobs();
        } catch (primaryError) {
          logger.warn(
            "Primary getPendingJobs failed, using safe method:",
            primaryError
          );
          pendingJobs = await this.getPendingJobsSafe();
        }

        for (const job of pendingJobs) {
          if (this.currentlyProcessing.size >= this.maxConcurrentJobs) break;

          this.currentlyProcessing.add(job.id);
          this.processJob(job).finally(() => {
            this.currentlyProcessing.delete(job.id);
          });
        }
      }
    } catch (error) {
      logger.error("Error in job batch processing:", error);
    }
  }

  /**
   * Fixed getPendingJobs method with proper parameter handling
   */
  private async getPendingJobs(): Promise<BackgroundJob[]> {
    try {
      const tableExists = await database.tableExists("background_jobs");
      if (!tableExists) {
        logger.warn("background_jobs table does not exist");
        return [];
      }

      // Ensure maxConcurrentJobs is a valid number
      let limit = Number(this.maxConcurrentJobs);
      if (!Number.isInteger(limit) || limit <= 0) {
        logger.warn(
          `Invalid maxConcurrentJobs value: ${this.maxConcurrentJobs}, using default of 3`
        );
        limit = 3;
        this.maxConcurrentJobs = 3;
      }

      // Debug logging
      logger.debug(`Fetching pending jobs with limit: ${limit}`);

      // Use string interpolation for LIMIT to avoid parameter issues
      const sql = `SELECT * FROM background_jobs 
                   WHERE status = ? 
                   ORDER BY created_at ASC 
                   LIMIT ${limit}`;

      const jobs = await database.query<BackgroundJob>(sql, ["pending"]);

      logger.debug(`Found ${jobs?.length || 0} pending jobs`);
      return jobs || [];
    } catch (error) {
      logger.error("Error fetching pending jobs:", error);
      logger.error("maxConcurrentJobs value:", this.maxConcurrentJobs);
      logger.error("maxConcurrentJobs type:", typeof this.maxConcurrentJobs);

      // Return empty array to prevent cascading failures
      return [];
    }
  }

  private async processJob(job: BackgroundJob): Promise<void> {
    const processor = this.processors.get(job.job_type);
    if (!processor) {
      logger.error(`No processor found for job type: ${job.job_type}`);
      await this.updateJobStatus(
        job.id,
        JobStatus.FAILED,
        0,
        null,
        "No processor available"
      );
      return;
    }

    try {
      logger.info(`Processing job ${job.id} of type ${job.job_type}`);

      // Parse job parameters if they're a string
      if (typeof job.job_parameters === "string") {
        try {
          job.job_parameters = JSON.parse(job.job_parameters);
        } catch (e) {
          throw new Error(
            `Invalid job parameters: ${e instanceof Error ? e.message : "Unknown error"}`
          );
        }
      }

      // Validate parameters before processing
      const validation = this.validateJobParameters(
        job.job_type,
        job.job_parameters
      );
      if (!validation.valid) {
        throw new Error(
          `Job validation failed: ${validation.errors.join(", ")}`
        );
      }

      await this.updateJobStatus(job.id, JobStatus.RUNNING, 0);
      await redisClient.set(
        `job:${job.id}`,
        { status: "running", progress: 0 },
        3600
      );

      const result = await processor.process(job);

      await this.updateJobStatus(job.id, JobStatus.COMPLETED, 100, result);
      await redisClient.set(
        `job:${job.id}`,
        { status: "completed", result },
        3600
      );

      logger.info(`Job ${job.id} completed successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(`Job ${job.id} failed: ${errorMessage}`);

      await this.updateJobStatus(
        job.id,
        JobStatus.FAILED,
        0,
        null,
        errorMessage
      );
      await redisClient.set(
        `job:${job.id}`,
        { status: "failed", error: errorMessage },
        3600
      );
    }
  }

  /**
   * Fixed updateJobStatus method with proper type handling
   */
  private async updateJobStatus(
    jobId: number,
    status: JobStatus,
    progress: number,
    resultData?: any,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateFields = [
        "status = ?",
        "progress_percentage = ?",
        "updated_at = CURRENT_TIMESTAMP",
      ];
      const updateValues: any[] = [status, progress];

      if (status === JobStatus.RUNNING) {
        updateFields.push("started_at = CURRENT_TIMESTAMP");
      }

      if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
        updateFields.push("completed_at = CURRENT_TIMESTAMP");
      }

      if (resultData) {
        updateFields.push("result_data = ?");
        updateValues.push(JSON.stringify(resultData));
      }

      if (errorMessage) {
        updateFields.push("error_message = ?");
        updateValues.push(errorMessage);
      }

      updateValues.push(jobId);

      await database.query(
        `UPDATE background_jobs SET ${updateFields.join(", ")} WHERE id = ?`,
        updateValues
      );
    } catch (error) {
      logger.error("Error updating job status:", error);
    }
  }

  public getStatus(): any {
    return {
      isRunning: this.isRunning,
      initialized: this.initialized,
      currentlyProcessing: this.currentlyProcessing.size,
      maxConcurrentJobs: this.maxConcurrentJobs,
      processingInterval: this.processingInterval,
      debugMode: this.debugMode,
      jobTypes: Object.values(JobType),
      jobSchemas: JOB_SCHEMAS,
    };
  }
}

// Enhanced Job Processors with better error handling
class AnalyticsProcessor implements JobProcessor {
  async process(job: BackgroundJob): Promise<any> {
    const {
      building_id,
      start_date,
      end_date,
      analysis_types = ["energy", "anomaly", "efficiency"],
    } = job.job_parameters || {};

    logger.info(
      `Processing analytics for building ${building_id} from ${start_date} to ${end_date}`
    );

    const results: any[] = [];

    for (let i = 0; i < analysis_types.length; i++) {
      const analysisType = analysis_types[i];

      try {
        let analysisResult;

        switch (analysisType) {
          case "energy":
            analysisResult = await analyticsService.analyzeEnergyEfficiency(
              building_id,
              new Date(start_date),
              new Date(end_date)
            );
            break;

          case "anomaly":
            analysisResult = await analyticsService.detectAnomalies({
              building_id,
              start_date: new Date(start_date),
              end_date: new Date(end_date),
              analysis_types: ["energy"],
            });
            break;

          case "efficiency":
            // Get basic efficiency data from database
            const tableExists =
              await database.tableExists("energy_consumption");
            if (tableExists) {
              const efficiencyData = await database.query(
                `SELECT AVG(consumption_kwh) as avg_consumption, 
                        AVG(power_factor) as avg_power_factor,
                        COUNT(*) as total_readings
                 FROM energy_consumption 
                 WHERE building_id = ? AND DATE(recorded_at) BETWEEN ? AND ?`,
                [building_id, start_date, end_date]
              );
              analysisResult = efficiencyData[0];
            } else {
              analysisResult = {
                message: "Energy consumption table not available",
              };
            }
            break;

          default:
            analysisResult = {
              message: `Unknown analysis type: ${analysisType}`,
            };
        }

        results.push({
          type: analysisType,
          result: analysisResult,
          timestamp: new Date(),
        });

        // Update progress
        const progress = Math.round(((i + 1) / analysis_types.length) * 100);
        await this.updateProgress(job.id, progress);
      } catch (error) {
        logger.error(`Error processing ${analysisType} analysis:`, error);
        results.push({
          type: analysisType,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      building_id,
      analysis_period: { start_date, end_date },
      analyses: results,
      summary: {
        total: analysis_types.length,
        successful: results.filter((r) => !r.error).length,
        failed: results.filter((r) => r.error).length,
      },
    };
  }

  private async updateProgress(jobId: number, progress: number): Promise<void> {
    try {
      await database.query(
        "UPDATE background_jobs SET progress_percentage = ? WHERE id = ?",
        [progress, jobId]
      );
      await redisClient.set(
        `job:${jobId}`,
        { status: "running", progress },
        300
      );
    } catch (error) {
      logger.error("Error updating progress:", error);
    }
  }
}

class AlertMonitoringProcessor implements JobProcessor {
  async process(job: BackgroundJob): Promise<any> {
    const {
      building_id,
      monitoring_types = ["energy", "power_quality", "equipment"],
    } = job.job_parameters || {};

    logger.info(`Processing alert monitoring for building ${building_id}`);

    const alertsGenerated = [];

    for (const monitoringType of monitoring_types) {
      try {
        let alerts: any[] = [];

        switch (monitoringType) {
          case "energy":
            // Get recent energy data that might trigger alerts
            const energyTableExists =
              await database.tableExists("energy_consumption");
            if (energyTableExists) {
              const energyIssues = await database.query(
                `SELECT * FROM energy_consumption 
                 WHERE building_id = ? 
                 AND recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                 AND (power_factor < 0.85 OR consumption_kwh > 1000)`,
                [building_id]
              );

              // Process energy issues through alert service
              for (const issue of energyIssues) {
                try {
                  const generatedAlerts =
                    await alertService.monitorEnergyThresholds(building_id, {
                      consumption_kwh: issue.consumption_kwh,
                      power_factor: issue.power_factor,
                      recorded_at: issue.recorded_at,
                    });
                  alerts.push(...generatedAlerts);
                } catch (alertError) {
                  logger.error("Error generating energy alerts:", alertError);
                }
              }
            }
            break;

          case "power_quality":
            const pqTableExists = await database.tableExists("power_quality");
            if (pqTableExists) {
              const pqIssues = await database.query(
                `SELECT * FROM power_quality 
                 WHERE building_id = ? 
                 AND recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                 AND (thd_voltage > 8 OR voltage_unbalance > 3)`,
                [building_id]
              );

              for (const issue of pqIssues) {
                try {
                  const generatedAlerts =
                    await alertService.monitorPowerQualityThresholds(
                      building_id,
                      {
                        thd_voltage: issue.thd_voltage,
                        voltage_unbalance: issue.voltage_unbalance,
                        recorded_at: issue.recorded_at,
                      }
                    );
                  alerts.push(...generatedAlerts);
                } catch (alertError) {
                  logger.error(
                    "Error generating power quality alerts:",
                    alertError
                  );
                }
              }
            }
            break;

          case "equipment":
            const equipmentTableExists =
              await database.tableExists("equipment");
            if (equipmentTableExists) {
              const faultyEquipment = await database.query(
                `SELECT * FROM equipment 
                 WHERE building_id = ? AND status = 'faulty'`,
                [building_id]
              );

              for (const equipment of faultyEquipment) {
                try {
                  const generatedAlerts =
                    await alertService.monitorEquipmentHealth(equipment.id);
                  alerts.push(...generatedAlerts);
                } catch (alertError) {
                  logger.error(
                    "Error generating equipment alerts:",
                    alertError
                  );
                }
              }
            }
            break;
        }

        alertsGenerated.push({
          type: monitoringType,
          alerts_count: alerts.length,
          alerts: alerts.map((alert) => ({
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
          })),
        });
      } catch (error) {
        logger.error(`Error monitoring ${monitoringType}:`, error);
        alertsGenerated.push({
          type: monitoringType,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      building_id,
      monitoring_results: alertsGenerated,
      total_alerts: alertsGenerated.reduce(
        (sum, result) => sum + (result.alerts_count || 0),
        0
      ),
      timestamp: new Date(),
    };
  }
}

class ComplianceCheckProcessor implements JobProcessor {
  async process(job: BackgroundJob): Promise<any> {
    const { audit_id, check_types = ["comprehensive"] } =
      job.job_parameters || {};

    logger.info(`Processing compliance check for audit ${audit_id}`);

    const tableExists = await database.tableExists("compliance_checks");
    if (!tableExists) {
      return {
        audit_id,
        compliance_checks: [],
        total_checks: 0,
        message: "compliance_checks table does not exist",
      };
    }

    const complianceChecks = await database.query(
      `SELECT cc.*, a.building_id, b.name as building_name 
       FROM compliance_checks cc
       JOIN audits a ON cc.audit_id = a.id
       JOIN buildings b ON a.building_id = b.id
       WHERE cc.audit_id = ?`,
      [audit_id]
    );

    // Calculate compliance metrics
    const totalChecks = complianceChecks.length;
    const compliantChecks = complianceChecks.filter(
      (c) => c.status === "compliant"
    ).length;
    const complianceScore =
      totalChecks > 0 ? Math.round((compliantChecks / totalChecks) * 100) : 0;

    return {
      audit_id,
      compliance_checks: complianceChecks,
      total_checks: totalChecks,
      compliant_checks: compliantChecks,
      compliance_score: complianceScore,
      check_types_processed: check_types,
      timestamp: new Date(),
    };
  }
}

class MaintenancePredictionProcessor implements JobProcessor {
  async process(job: BackgroundJob): Promise<any> {
    const { equipment_id, building_id } = job.job_parameters || {};

    logger.info(
      `Processing maintenance prediction for equipment ${equipment_id} or building ${building_id}`
    );

    const equipmentTableExists = await database.tableExists("equipment");
    if (!equipmentTableExists) {
      return {
        predictions: [],
        total_equipment: 0,
        message: "equipment table does not exist",
      };
    }

    // Get equipment to analyze
    let equipmentIds = [];
    if (equipment_id) {
      equipmentIds = [equipment_id];
    } else if (building_id) {
      const equipmentList = await database.query(
        'SELECT id FROM equipment WHERE building_id = ? AND status = "active"',
        [building_id]
      );
      equipmentIds = equipmentList.map((eq: any) => eq.id);
    }

    const predictions = [];

    for (let i = 0; i < equipmentIds.length; i++) {
      const eqId = equipmentIds[i];
      try {
        // Use analytics service for maintenance prediction if available
        let prediction;
        try {
          prediction = await analyticsService.predictEquipmentMaintenance(eqId);
        } catch (error) {
          // Fallback to basic analysis
          const maintenanceTableExists = await database.tableExists(
            "equipment_maintenance"
          );
          let maintenanceCount = 0;

          if (maintenanceTableExists) {
            const maintenanceHistory = await database.query(
              "SELECT COUNT(*) as maintenance_count FROM equipment_maintenance WHERE equipment_id = ?",
              [eqId]
            );
            maintenanceCount = maintenanceHistory[0]?.maintenance_count || 0;
          }

          prediction = {
            equipment_id: eqId,
            maintenance_count: maintenanceCount,
            risk_level: maintenanceCount > 5 ? "high" : "low",
            message: "Basic maintenance analysis",
          };
        }

        predictions.push(prediction);

        // Update progress
        const progress = Math.round(((i + 1) / equipmentIds.length) * 100);
        await this.updateProgress(job.id, progress);
      } catch (error) {
        logger.error(
          `Error predicting maintenance for equipment ${eqId}:`,
          error
        );
        predictions.push({
          equipment_id: eqId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      predictions,
      total_equipment: equipmentIds.length,
      building_id,
      equipment_id,
      timestamp: new Date(),
    };
  }

  private async updateProgress(jobId: number, progress: number): Promise<void> {
    try {
      await database.query(
        "UPDATE background_jobs SET progress_percentage = ? WHERE id = ?",
        [progress, jobId]
      );
    } catch (error) {
      logger.error("Error updating progress:", error);
    }
  }
}

class ForecastGenerationProcessor implements JobProcessor {
  async process(job: BackgroundJob): Promise<any> {
    const {
      building_id,
      forecast_days = 30,
      forecast_types = ["consumption"],
    } = job.job_parameters || {};

    logger.info(`Processing forecast generation for building ${building_id}`);

    const tableExists = await database.tableExists("energy_consumption");
    if (!tableExists) {
      return {
        building_id,
        forecast: null,
        forecast_period_days: forecast_days,
        message: "energy_consumption table does not exist",
      };
    }

    try {
      // Use analytics service for forecasting
      const forecasts = await analyticsService.forecastEnergyConsumption(
        building_id,
        forecast_days,
        forecast_types[0] || "consumption"
      );

      return {
        building_id,
        forecast: forecasts,
        forecast_period_days: forecast_days,
        forecast_types: forecast_types,
        total_forecasts: forecasts.length,
        timestamp: new Date(),
      };
    } catch (error) {
      // Fallback to basic forecasting
      const historicalData = await database.query(
        `SELECT AVG(consumption_kwh) as avg_consumption,
                COUNT(*) as data_points
         FROM energy_consumption 
         WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [building_id]
      );

      const basicForecast = {
        predicted_consumption: historicalData[0]?.avg_consumption || 0,
        confidence: historicalData[0]?.data_points > 30 ? "medium" : "low",
        method: "simple_average",
      };

      return {
        building_id,
        forecast: basicForecast,
        forecast_period_days: forecast_days,
        forecast_types: forecast_types,
        message: "Basic forecast using simple average",
        timestamp: new Date(),
      };
    }
  }
}

// Create and export singleton instance
export const backgroundJobProcessor = new BackgroundJobProcessor();
