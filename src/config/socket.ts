import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "@/utils/logger";
import { database } from "@/config/database";

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userRole?: string;
  buildingAccess?: number[];
}

interface SocketUser {
  id: number;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
}

class SocketManager {
  private io: SocketIOServer | null = null;
  private connectedUsers = new Map<string, AuthenticatedSocket>();
  private userSockets = new Map<number, Set<string>>();
  private buildingRooms = new Map<number, Set<string>>();

  public initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info("Socket.IO server initialized");
  }

  private setupMiddleware(): void {
    if (!this.io) return;

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace("Bearer ", "");

        if (!token) {
          return next(new Error("Authentication token required"));
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          return next(new Error("JWT secret not configured"));
        }

        const decoded = jwt.verify(token, jwtSecret) as any;

        // Get user details from database
        const user = await database.queryOne<SocketUser>(
          "SELECT id, email, role, first_name, last_name FROM users WHERE id = ? AND is_active = true",
          [decoded.userId]
        );

        if (!user) {
          return next(new Error("User not found or inactive"));
        }

        // Get user's building access (simplified - you might have a more complex permission system)
        const buildingAccess = await database.query<{ building_id: number }>(
          "SELECT DISTINCT building_id FROM audits WHERE auditor_id = ? UNION SELECT DISTINCT building_id FROM equipment WHERE id IN (SELECT equipment_id FROM equipment_maintenance WHERE technician_id = ?)",
          [user.id, user.id]
        );

        socket.userId = user.id;
        socket.userRole = user.role;
        socket.buildingAccess = buildingAccess.map((ba) => ba.building_id);

        next();
      } catch (error) {
        logger.error("Socket authentication error:", error);
        next(new Error("Authentication failed"));
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on("connection", (socket: AuthenticatedSocket) => {
      logger.info(`User ${socket.userId} connected via Socket.IO`);

      // Store user connection
      this.connectedUsers.set(socket.id, socket);

      if (socket.userId) {
        if (!this.userSockets.has(socket.userId)) {
          this.userSockets.set(socket.userId, new Set());
        }
        this.userSockets.get(socket.userId)?.add(socket.id);

        // Join user to their accessible building rooms
        socket.buildingAccess?.forEach((buildingId) => {
          socket.join(`building_${buildingId}`);

          if (!this.buildingRooms.has(buildingId)) {
            this.buildingRooms.set(buildingId, new Set());
          }
          this.buildingRooms.get(buildingId)?.add(socket.id);
        });

        // Join user to role-based room
        socket.join(`role_${socket.userRole}`);

        // Send welcome message
        socket.emit("connected", {
          message: "Connected to UCLM Energy Audit Platform",
          userId: socket.userId,
          buildingAccess: socket.buildingAccess,
        });
      }

      // Handle room joining
      socket.on("joinRoom", (roomName: string) => {
        if (this.canJoinRoom(socket, roomName)) {
          socket.join(roomName);
          socket.emit("roomJoined", { room: roomName });
          logger.info(`User ${socket.userId} joined room: ${roomName}`);
        } else {
          socket.emit("error", { message: "Access denied to room" });
        }
      });

      // Handle room leaving
      socket.on("leaveRoom", (roomName: string) => {
        socket.leave(roomName);
        socket.emit("roomLeft", { room: roomName });
        logger.info(`User ${socket.userId} left room: ${roomName}`);
      });

      // Handle real-time alerts acknowledgment
      socket.on("acknowledgeAlert", async (alertId: number) => {
        try {
          // Update alert in database
          await database.query(
            "UPDATE alerts SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP WHERE id = ?",
            [socket.userId, alertId]
          );

          // Broadcast to all users in relevant buildings
          socket.buildingAccess?.forEach((buildingId) => {
            this.io?.to(`building_${buildingId}`).emit("alertAcknowledged", {
              alertId,
              acknowledgedBy: socket.userId,
              timestamp: new Date(),
            });
          });

          logger.info(`Alert ${alertId} acknowledged by user ${socket.userId}`);
        } catch (error) {
          logger.error("Error acknowledging alert:", error);
          socket.emit("error", { message: "Failed to acknowledge alert" });
        }
      });

      // Handle real-time monitoring subscription
      socket.on("subscribeToMonitoring", (buildingIds: number[]) => {
        const allowedBuildings = buildingIds.filter(
          (id) =>
            socket.buildingAccess?.includes(id) || socket.userRole === "admin"
        );

        allowedBuildings.forEach((buildingId) => {
          socket.join(`monitoring_${buildingId}`);
        });

        socket.emit("monitoringSubscribed", { buildings: allowedBuildings });
        logger.info(
          `User ${socket.userId} subscribed to monitoring for buildings: ${allowedBuildings.join(", ")}`
        );
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        logger.info(`User ${socket.userId} disconnected`);

        // Clean up user tracking
        this.connectedUsers.delete(socket.id);

        if (socket.userId) {
          const userSocketSet = this.userSockets.get(socket.userId);
          if (userSocketSet) {
            userSocketSet.delete(socket.id);
            if (userSocketSet.size === 0) {
              this.userSockets.delete(socket.userId);
            }
          }
        }

        // Clean up building rooms
        this.buildingRooms.forEach((socketSet, buildingId) => {
          socketSet.delete(socket.id);
          if (socketSet.size === 0) {
            this.buildingRooms.delete(buildingId);
          }
        });
      });

      // Handle errors
      socket.on("error", (error) => {
        logger.error(`Socket error for user ${socket.userId}:`, error);
      });
    });
  }

  private canJoinRoom(socket: AuthenticatedSocket, roomName: string): boolean {
    // Admin can join any room
    if (socket.userRole === "admin") {
      return true;
    }

    // Building-specific rooms
    if (roomName.startsWith("building_")) {
      const buildingId = parseInt(roomName.replace("building_", ""));
      return socket.buildingAccess?.includes(buildingId) || false;
    }

    // Role-specific rooms
    if (roomName.startsWith("role_")) {
      const role = roomName.replace("role_", "");
      return socket.userRole === role;
    }

    // Monitoring rooms
    if (roomName.startsWith("monitoring_")) {
      const buildingId = parseInt(roomName.replace("monitoring_", ""));
      return socket.buildingAccess?.includes(buildingId) || false;
    }

    // Default deny
    return false;
  }

  // Public methods for emitting events

  public getIO(): SocketIOServer | null {
    return this.io;
  }

  public emitToUser(userId: string, event: string, data: any): void {
    const userSocketSet = this.userSockets.get(parseInt(userId));
    if (userSocketSet) {
      userSocketSet.forEach((socketId) => {
        const socket = this.connectedUsers.get(socketId);
        if (socket) {
          socket.emit(event, data);
        }
      });
    }
  }

  public emitToBuilding(buildingId: string, event: string, data: any): void {
    this.io?.to(`building_${buildingId}`).emit(event, data);
  }

  public emitToRole(role: string, event: string, data: any): void {
    this.io?.to(`role_${role}`).emit(event, data);
  }

  public emitEnergyUpdate(buildingId: string, energyData: any): void {
    this.io?.to(`monitoring_${buildingId}`).emit("energyUpdate", {
      buildingId: parseInt(buildingId),
      data: energyData,
      timestamp: new Date(),
    });
  }

  public emitPowerQualityUpdate(buildingId: string, pqData: any): void {
    this.io?.to(`monitoring_${buildingId}`).emit("powerQualityUpdate", {
      buildingId: parseInt(buildingId),
      data: pqData,
      timestamp: new Date(),
    });
  }

  public emitAlert(alert: any): void {
    // Emit to all relevant users
    if (alert.building_id) {
      this.emitToBuilding(alert.building_id.toString(), "newAlert", alert);
    } else {
      // System-wide alert
      this.io?.emit("newAlert", alert);
    }

    // Emit to admins and energy managers
    this.emitToRole("admin", "newAlert", alert);
    this.emitToRole("energy_manager", "newAlert", alert);
  }

  public emitMaintenanceAlert(
    equipmentId: number,
    buildingId: number,
    maintenanceData: any
  ): void {
    this.emitToBuilding(buildingId.toString(), "maintenanceAlert", {
      equipmentId,
      buildingId,
      data: maintenanceData,
      timestamp: new Date(),
    });
  }

  public emitComplianceAlert(buildingId: number, complianceData: any): void {
    this.emitToBuilding(buildingId.toString(), "complianceAlert", {
      buildingId,
      data: complianceData,
      timestamp: new Date(),
    });

    // Also notify energy managers and admins
    this.emitToRole("admin", "complianceAlert", complianceData);
    this.emitToRole("energy_manager", "complianceAlert", complianceData);
  }

  public getConnectedUsers(): number {
    return this.connectedUsers.size;
  }

  public getUsersInBuilding(buildingId: number): number {
    return this.buildingRooms.get(buildingId)?.size || 0;
  }

  public getConnectionStats(): any {
    return {
      totalConnections: this.connectedUsers.size,
      uniqueUsers: this.userSockets.size,
      buildingRooms: Array.from(this.buildingRooms.entries()).map(
        ([buildingId, sockets]) => ({
          buildingId,
          connectedUsers: sockets.size,
        })
      ),
    };
  }

  public broadcastSystemMessage(
    message: string,
    type: "info" | "warning" | "error" = "info"
  ): void {
    this.io?.emit("systemMessage", {
      message,
      type,
      timestamp: new Date(),
    });
  }

  public disconnect(userId: number, reason?: string): void {
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.forEach((socketId) => {
        const socket = this.connectedUsers.get(socketId);
        if (socket) {
          socket.emit("forceDisconnect", { reason });
          socket.disconnect(true);
        }
      });
    }
  }
}

// Create and export singleton instance
export const socketManager = new SocketManager();
export default socketManager;
