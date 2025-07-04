import { Request, Response } from "express";
import { IUser, IUserCreate } from "@/interfaces/IUser";
import { ApiResponse } from "@/interfaces/IResponse";
import { database } from "@/config/database";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";

interface LoginBody {
  email: string;
  password: string;
}

interface RefreshTokenBody {
  refreshToken: string;
}

interface AuthResponse {
  user: Omit<IUser, "password">;
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  userId: number;
  email: string;
  role?: string;
}

class AuthController {
  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new CustomError("JWT_SECRET environment variable is not set", 500);
    }
    return secret;
  }

  private getJwtRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new CustomError(
        "JWT_REFRESH_SECRET environment variable is not set",
        500
      );
    }
    return secret;
  }

  public register = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userData = req.body as IUserCreate;
      logger.info("🚀 Starting user registration for email:", userData.email);

      // Validate required fields
      if (
        !userData.email ||
        !userData.password ||
        !userData.first_name ||
        !userData.last_name ||
        !userData.role
      ) {
        throw new CustomError(
          "email, password, first_name, last_name, and role are required",
          400
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        throw new CustomError("Invalid email format", 400);
      }

      // Validate password strength
      if (userData.password.length < 8) {
        throw new CustomError(
          "Password must be at least 8 characters long",
          400
        );
      }

      // Validate role
      const validRoles = [
        "admin",
        "energy_manager",
        "facility_engineer",
        "staff",
        "student",
      ];
      if (!validRoles.includes(userData.role)) {
        throw new CustomError("Invalid role specified", 400);
      }

      try {
        // Check if user already exists
        const existingUser = await database.queryOne(
          "SELECT id, email FROM users WHERE email = ?",
          [userData.email.toLowerCase().trim()]
        );

        if (existingUser) {
          throw new CustomError("User with this email already exists", 409);
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

        // Insert user using specialized insert method
        const insertQuery = `
          INSERT INTO users 
          (email, password, first_name, last_name, role, department, phone, is_active) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          userData.email.toLowerCase().trim(),
          hashedPassword,
          userData.first_name.trim(),
          userData.last_name.trim(),
          userData.role,
          userData.department?.trim() || null,
          userData.phone?.trim() || null,
          true,
        ];

        const insertId = await database.insert(insertQuery, insertParams);
        logger.info("User created with ID:", insertId);

        // Fetch created user (without password)
        const newUser = await database.queryOne<Omit<IUser, "password">>(
          `SELECT id, email, first_name, last_name, role, department, phone, 
           is_active, created_at, updated_at FROM users WHERE id = ?`,
          [insertId]
        );

        if (!newUser) {
          throw new CustomError("Failed to retrieve created user", 500);
        }

        // Generate tokens
        const accessToken = this.generateAccessToken(newUser);
        const refreshToken = this.generateRefreshToken(newUser);

        // Store refresh token in database
        const updateResult = await database.execute(
          "UPDATE users SET refresh_token = ? WHERE id = ?",
          [refreshToken, newUser.id]
        );

        if (updateResult === 0) {
          throw new CustomError("Failed to store refresh token", 500);
        }

        // Log successful registration (exclude sensitive data)
        logger.info(
          `New user registered successfully: ${userData.email} (Role: ${userData.role})`
        );

        const response: ApiResponse<AuthResponse> = {
          success: true,
          message: "User registered successfully",
          data: {
            user: newUser,
            accessToken,
            refreshToken,
          },
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error during user registration:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to register user", 500);
      }
    }
  );

  public login = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, password } = req.body as LoginBody;
      logger.info("🚀 Starting login attempt for email:", email);

      // Validate required fields
      if (!email || !password) {
        throw new CustomError("Email and password are required", 400);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new CustomError("Invalid email format", 400);
      }

      try {
        // Find user by email
        const user = await database.queryOne<IUser>(
          "SELECT * FROM users WHERE email = ? AND is_active = true",
          [email.toLowerCase().trim()]
        );

        if (!user) {
          logger.warn(`Login attempt failed - user not found: ${email}`);
          throw new CustomError("Invalid credentials", 401);
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          logger.warn(`Login attempt failed - invalid password: ${email}`);
          throw new CustomError("Invalid credentials", 401);
        }

        // Create user object without password
        const userWithoutPassword: Omit<IUser, "password"> = {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          department: user.department,
          phone: user.phone,
          is_active: user.is_active,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login: user.last_login,
          refresh_token: user.refresh_token,
        };

        // Generate tokens
        const accessToken = this.generateAccessToken(userWithoutPassword);
        const refreshToken = this.generateRefreshToken(userWithoutPassword);

        // Update last login and store refresh token
        const updateResult = await database.execute(
          "UPDATE users SET refresh_token = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?",
          [refreshToken, user.id]
        );

        if (updateResult === 0) {
          logger.warn(`Failed to update login timestamp for user: ${email}`);
        }

        // Get user statistics for enhanced response
        const userStats = await this.getUserStatistics(user.id);

        logger.info(
          `User logged in successfully: ${email} (Role: ${user.role})`
        );

        const response: ApiResponse<AuthResponse & { stats?: any }> = {
          success: true,
          message: "Login successful",
          data: {
            user: userWithoutPassword,
            accessToken,
            refreshToken,
            stats: userStats,
          },
        };

        res.json(response);
      } catch (error) {
        logger.error("Error during login:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Login failed", 500);
      }
    }
  );

  public refreshToken = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { refreshToken } = req.body as RefreshTokenBody;
      logger.info("🚀 Processing token refresh request");

      if (!refreshToken || typeof refreshToken !== "string") {
        throw new CustomError("Refresh token is required", 400);
      }

      try {
        // Verify refresh token
        const decoded = jwt.verify(
          refreshToken,
          this.getJwtRefreshSecret()
        ) as JwtPayload;

        // Find user and verify refresh token
        const user = await database.queryOne<Omit<IUser, "password">>(
          `SELECT id, email, first_name, last_name, role, department, phone, 
           is_active, created_at, updated_at, last_login FROM users 
           WHERE id = ? AND refresh_token = ? AND is_active = true`,
          [decoded.userId, refreshToken]
        );

        if (!user) {
          logger.warn(
            `Token refresh failed - invalid token or user not found: ${decoded.userId}`
          );
          throw new CustomError("Invalid refresh token", 401);
        }

        // Generate new tokens
        const newAccessToken = this.generateAccessToken(user);
        const newRefreshToken = this.generateRefreshToken(user);

        // Update refresh token in database
        const updateResult = await database.execute(
          "UPDATE users SET refresh_token = ? WHERE id = ?",
          [newRefreshToken, user.id]
        );

        if (updateResult === 0) {
          throw new CustomError("Failed to update refresh token", 500);
        }

        logger.info(`Token refreshed successfully for user: ${user.email}`);

        const response: ApiResponse<AuthResponse> = {
          success: true,
          message: "Token refreshed successfully",
          data: {
            user,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          },
        };

        res.json(response);
      } catch (error) {
        logger.error("Error during token refresh:", error);
        if (error instanceof jwt.JsonWebTokenError) {
          throw new CustomError("Invalid refresh token", 401);
        }
        if (error instanceof jwt.TokenExpiredError) {
          throw new CustomError("Refresh token expired", 401);
        }
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Token refresh failed", 500);
      }
    }
  );

  public logout = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user!.id;
      const userEmail = req.user!.email;
      logger.info("🚀 Processing logout for user:", userEmail);

      try {
        // Clear refresh token from database
        const updateResult = await database.execute(
          "UPDATE users SET refresh_token = NULL WHERE id = ?",
          [userId]
        );

        if (updateResult === 0) {
          logger.warn(`Failed to clear refresh token for user: ${userEmail}`);
        }

        logger.info(`User logged out successfully: ${userEmail}`);

        const response: ApiResponse = {
          success: true,
          message: "Logout successful",
        };

        res.json(response);
      } catch (error) {
        logger.error("Error during logout:", error);
        throw new CustomError("Logout failed", 500);
      }
    }
  );

  public getProfile = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user!.id;
      const userEmail = req.user!.email;
      logger.info("🚀 Getting profile for user:", userEmail);

      try {
        const user = await database.queryOne<Omit<IUser, "password">>(
          `SELECT id, email, first_name, last_name, role, department, phone, 
           is_active, created_at, updated_at, last_login FROM users WHERE id = ?`,
          [userId]
        );

        if (!user) {
          throw new CustomError("User not found", 404);
        }

        // Get enhanced profile data
        const [userStats, recentActivity] = await Promise.all([
          this.getUserStatistics(userId),
          this.getUserRecentActivity(userId),
        ]);

        const enhancedProfile = {
          ...user,
          statistics: userStats,
          recent_activity: recentActivity,
        };

        logger.info(`Profile retrieved successfully for user: ${userEmail}`);

        const response: ApiResponse<typeof enhancedProfile> = {
          success: true,
          message: "Profile fetched successfully",
          data: enhancedProfile,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error getting user profile:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to get user profile", 500);
      }
    }
  );

  public updateProfile = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user!.id;
      const updateData = req.body;
      logger.info("🚀 Updating profile for user:", req.user!.email);

      try {
        // Check if user exists
        const existingUser = await database.queryOne<IUser>(
          "SELECT * FROM users WHERE id = ?",
          [userId]
        );

        if (!existingUser) {
          throw new CustomError("User not found", 404);
        }

        // Build update query dynamically
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        const allowedFields = [
          "first_name",
          "last_name",
          "department",
          "phone",
        ];

        Object.entries(updateData).forEach(([key, value]) => {
          if (allowedFields.includes(key) && value !== undefined) {
            updateFields.push(`${key} = ?`);
            updateValues.push(typeof value === "string" ? value.trim() : value);
          }
        });

        if (updateFields.length === 0) {
          throw new CustomError("No valid fields to update", 400);
        }

        // Add user ID to parameters
        updateValues.push(userId);

        const updateQuery = `
          UPDATE users 
          SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;

        const affectedRows = await database.execute(updateQuery, updateValues);
        logger.info("Update affected rows:", affectedRows);

        if (affectedRows === 0) {
          throw new CustomError("Failed to update profile", 500);
        }

        // Get updated user profile
        const updatedUser = await database.queryOne<Omit<IUser, "password">>(
          `SELECT id, email, first_name, last_name, role, department, phone, 
           is_active, created_at, updated_at, last_login FROM users WHERE id = ?`,
          [userId]
        );

        logger.info(
          `Profile updated successfully for user: ${req.user!.email}`
        );

        const response: ApiResponse<Omit<IUser, "password">> = {
          success: true,
          message: "Profile updated successfully",
          data: updatedUser!,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error updating profile:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to update profile", 500);
      }
    }
  );

  public changePassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;
      logger.info("🚀 Processing password change for user:", req.user!.email);

      // Validate required fields
      if (!currentPassword || !newPassword) {
        throw new CustomError(
          "Current password and new password are required",
          400
        );
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        throw new CustomError(
          "New password must be at least 8 characters long",
          400
        );
      }

      try {
        // Get current user with password
        const user = await database.queryOne<IUser>(
          "SELECT * FROM users WHERE id = ? AND is_active = true",
          [userId]
        );

        if (!user) {
          throw new CustomError("User not found", 404);
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(
          currentPassword,
          user.password
        );

        if (!isCurrentPasswordValid) {
          throw new CustomError("Current password is incorrect", 401);
        }

        // Hash new password
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password and clear all refresh tokens for security
        const updateResult = await database.execute(
          "UPDATE users SET password = ?, refresh_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [hashedNewPassword, userId]
        );

        if (updateResult === 0) {
          throw new CustomError("Failed to update password", 500);
        }

        logger.info(
          `Password changed successfully for user: ${req.user!.email}`
        );

        const response: ApiResponse = {
          success: true,
          message: "Password changed successfully. Please log in again.",
        };

        res.json(response);
      } catch (error) {
        logger.error("Error changing password:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to change password", 500);
      }
    }
  );

  // Private helper methods

  private generateAccessToken(user: Omit<IUser, "password">): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const secret = this.getJwtSecret();
    const expiresIn = process.env.JWT_EXPIRES_IN || "15m";

    return jwt.sign(payload, secret, { expiresIn } as SignOptions);
  }

  private generateRefreshToken(user: Omit<IUser, "password">): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
    };

    const secret = this.getJwtRefreshSecret();
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

    return jwt.sign(payload, secret, { expiresIn } as SignOptions);
  }

  /**
   * Get user statistics for enhanced profile
   */
  private async getUserStatistics(userId: number): Promise<any> {
    try {
      const stats = await database.queryOne<any>(
        `SELECT 
          COUNT(DISTINCT a.id) as audits_conducted,
          COUNT(DISTINCT em.id) as maintenance_performed,
          COUNT(DISTINCT ec.id) as energy_readings_created,
          COUNT(DISTINCT pq.id) as power_quality_readings_created,
          DATE(u.created_at) as member_since
        FROM users u
        LEFT JOIN audits a ON u.id = a.auditor_id
        LEFT JOIN equipment_maintenance em ON u.id = em.technician_id
        LEFT JOIN energy_consumption ec ON u.id = ec.created_by
        LEFT JOIN power_quality pq ON u.id = pq.created_by
        WHERE u.id = ?
        GROUP BY u.id, u.created_at`,
        [userId]
      );

      return (
        stats || {
          audits_conducted: 0,
          maintenance_performed: 0,
          energy_readings_created: 0,
          power_quality_readings_created: 0,
          member_since: null,
        }
      );
    } catch (error) {
      logger.error("Error getting user statistics:", error);
      return {
        audits_conducted: 0,
        maintenance_performed: 0,
        energy_readings_created: 0,
        power_quality_readings_created: 0,
        member_since: null,
      };
    }
  }

  /**
   * Get user recent activity
   */
  private async getUserRecentActivity(userId: number): Promise<any[]> {
    try {
      const activities = await database.query<any>(
        `(SELECT 'audit' as type, a.title as description, a.created_at as timestamp, b.name as location
          FROM audits a 
          LEFT JOIN buildings b ON a.building_id = b.id
          WHERE a.auditor_id = ? 
          ORDER BY a.created_at DESC 
          LIMIT 5)
        UNION ALL
        (SELECT 'maintenance' as type, CONCAT('Maintenance: ', e.name) as description, em.created_at as timestamp, b.name as location
          FROM equipment_maintenance em
          LEFT JOIN equipment e ON em.equipment_id = e.id
          LEFT JOIN buildings b ON e.building_id = b.id
          WHERE em.technician_id = ?
          ORDER BY em.created_at DESC 
          LIMIT 5)
        ORDER BY timestamp DESC
        LIMIT 10`,
        [userId, userId]
      );

      return activities || [];
    } catch (error) {
      logger.error("Error getting user recent activity:", error);
      return [];
    }
  }
}

export default new AuthController();
