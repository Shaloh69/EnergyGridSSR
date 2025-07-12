import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { createServer, Server as HttpServer } from "http";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import configurations
import { database } from "@/config/database";
import { socketManager } from "@/config/socket";
import { backgroundJobProcessor } from "@/services/backgroundProcessor";

// Import middleware
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";

// Import routes
import authRoutes from "@/routes/auth";
import buildingRoutes from "@/routes/buildings";
import energyRoutes from "@/routes/energy";
import powerQualityRoutes from "@/routes/powerQuality";
import equipmentRoutes from "@/routes/equipment";
import auditRoutes from "@/routes/audits";
import complianceRoutes from "@/routes/compliance";
import reportRoutes from "@/routes/reports";
import dashboardRoutes from "@/routes/dashboard";
import alertRoutes from "@/routes/alerts";
import analyticsRoutes from "@/routes/analytics";
import monitoringRoutes from "@/routes/monitoring";

// Import utils
import { logger } from "@/utils/logger";
import { HTTP_STATUS } from "@/utils/constants";
import { debugAuthMiddleware } from "@/middleware/debugAuth";

class Server {
  private app: Application;
  private server: HttpServer;
  private port: number;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.port = parseInt(process.env.PORT || "5000", 10);

    this.initializeDatabase();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeSocket();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Database connection is handled in the database config
      logger.info("Database connection initialized");
    } catch (error) {
      logger.error("Database initialization failed:", error);
      process.exit(1);
    }
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.set("trust proxy", 1);

    // CORS configuration - SINGLE SOURCE OF TRUTH
    const corsOptions = {
      origin: [
        "http://localhost:3000",
        "https://treefrog-credible-anchovy.ngrok-free.app",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
      credentials: true,
      optionsSuccessStatus: 204,
      preflightContinue: false, // Let cors handle preflight completely
    };

    // Apply CORS middleware - this handles both preflight and actual requests
    this.app.use(cors(corsOptions));

    // Debug middleware for development - AFTER cors middleware
    if (process.env.NODE_ENV === "development") {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.method === "OPTIONS") {
          console.log("🔍 PREFLIGHT Request:");
          console.log("  - Path:", req.path);
          console.log("  - Origin:", req.headers.origin);
          console.log(
            "  - Method:",
            req.headers["access-control-request-method"]
          );
          console.log(
            "  - Headers:",
            req.headers["access-control-request-headers"]
          );
        } else {
          console.log(
            `🚀 ${req.method} ${req.path} from ${req.headers.origin}`
          );
        }
        next();
      });

      // Apply debug auth middleware for API routes only
      this.app.use("/api", debugAuthMiddleware);
    }

    // Helmet configuration - relaxed for development
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for development
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
              "'self'",
              "https://treefrog-credible-anchovy.ngrok-free.app",
            ],
          },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests
      })
    );

    // Rate limiting - more permissive for development
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === "production" ? 100 : 2000, // Higher limit for dev
      message: {
        success: false,
        message: "Too many requests from this IP, please try again later.",
        error: "Rate limit exceeded",
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks and development
        return (
          process.env.NODE_ENV === "development" &&
          (req.path === "/health" || req.path === "/")
        );
      },
    });

    this.app.use("/api/", limiter);

    // Compression middleware
    this.app.use(compression());

    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      res.on("finish", () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? "error" : "info";

        logger[logLevel](
          `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`,
          {
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            origin: req.get("Origin"),
          }
        );
      });

      next();
    });

    // Add socket.io to request object
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.io = socketManager.getIO();
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get("/health", async (req: Request, res: Response) => {
      try {
        // Test database connection
        const dbHealthy = await database.healthCheck();

        // Get background job processor status
        const processorStatus = backgroundJobProcessor.getStatus();

        // Get socket connections
        const socketStats = socketManager.getConnectionStats();

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: "Server is healthy",
          data: {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || "development",
            version: process.env.npm_package_version || "1.0.0",
            services: {
              database: dbHealthy ? "healthy" : "unhealthy",
              backgroundProcessor: processorStatus.isRunning
                ? "running"
                : "stopped",
              socketConnections: socketStats.totalConnections || 0,
            },
            backgroundJobs: processorStatus,
            memory: process.memoryUsage(),
          },
        });
      } catch (error) {
        logger.error("Health check error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: "Health check failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Root endpoint
    this.app.get("/", (req: Request, res: Response) => {
      res.json({
        message: "UCLM Energy Management System Backend",
        status: "running",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        ngrokUrl: "https://treefrog-credible-anchovy.ngrok-free.app",
      });
    });

    // Background processor test endpoint
    this.app.get(
      "/api/test/background-processor",
      async (req: Request, res: Response) => {
        try {
          const testResult =
            await backgroundJobProcessor.testDatabaseConnection();
          res.json({
            success: true,
            message: "Background processor test completed",
            data: testResult,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: "Background processor test failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    // API routes
    this.app.use("/api/auth", authRoutes);
    this.app.use("/api/buildings", buildingRoutes);
    this.app.use("/api/energy", energyRoutes);
    this.app.use("/api/power-quality", powerQualityRoutes);
    this.app.use("/api/equipment", equipmentRoutes);
    this.app.use("/api/audits", auditRoutes);
    this.app.use("/api/compliance", complianceRoutes);
    this.app.use("/api/reports", reportRoutes);
    this.app.use("/api/dashboard", dashboardRoutes);
    this.app.use("/api/alerts", alertRoutes);
    this.app.use("/api/analytics", analyticsRoutes);
    this.app.use("/api/monitoring", monitoringRoutes);

    // API documentation endpoint
    this.app.get("/api", (req: Request, res: Response) => {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "UCLM Energy Audit Platform API",
        data: {
          version: "1.0.0",
          environment: process.env.NODE_ENV || "development",
          baseUrl:
            process.env.NODE_ENV === "development"
              ? "https://treefrog-credible-anchovy.ngrok-free.app"
              : "http://localhost:5000",
          endpoints: {
            auth: "/api/auth",
            buildings: "/api/buildings",
            energy: "/api/energy",
            powerQuality: "/api/power-quality",
            equipment: "/api/equipment",
            audits: "/api/audits",
            compliance: "/api/compliance",
            reports: "/api/reports",
            dashboard: "/api/dashboard",
            alerts: "/api/alerts",
            analytics: "/api/analytics",
            monitoring: "/api/monitoring",
          },
          documentation: "/api/docs",
        },
      });
    });
  }

  private async initializeBackgroundServices(): Promise<void> {
    try {
      // Start background job processor
      await backgroundJobProcessor.start();
      logger.info("Background job processor started");
    } catch (error) {
      logger.error("Failed to start background services:", error);
    }
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  private initializeSocket(): void {
    // Initialize Socket.IO
    socketManager.initialize(this.server);
  }

  public async start(): Promise<void> {
    this.server.listen(this.port, async () => {
      logger.info(`🚀 Server running on port ${this.port}`);
      logger.info(
        `🌐 ngrok URL: https://treefrog-credible-anchovy.ngrok-free.app`
      );
      logger.info(
        `📚 API Documentation available at http://localhost:${this.port}/api`
      );
      logger.info(
        `🏥 Health check available at http://localhost:${this.port}/health`
      );
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

      // Initialize background services after server starts
      await this.initializeBackgroundServices();
    });

    // Graceful shutdown
    process.on("SIGTERM", this.gracefulShutdown.bind(this));
    process.on("SIGINT", this.gracefulShutdown.bind(this));

    // Unhandled promise rejections
    process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    });

    // Uncaught exceptions
    process.on("uncaughtException", (error: Error) => {
      logger.error("Uncaught Exception:", error);
      this.gracefulShutdown();
    });
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info("🔄 Starting graceful shutdown...");

    // Stop background job processor
    try {
      backgroundJobProcessor.stop();
      logger.info("✅ Background job processor stopped");
    } catch (error) {
      logger.error("❌ Error stopping background job processor:", error);
    }

    // Close server
    this.server.close(() => {
      logger.info("✅ HTTP server closed");
    });

    // Close database connections
    try {
      await database.close();
      logger.info("✅ Database connections closed");
    } catch (error) {
      logger.error("❌ Error closing database connections:", error);
    }

    logger.info("✅ Graceful shutdown completed");
    process.exit(0);
  }
}

// Create and start server
const server = new Server();

// Start server asynchronously
(async () => {
  try {
    await server.start();
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
})();

export default server;
