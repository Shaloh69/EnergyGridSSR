import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@/types/enums";
import { IUser } from "@/interfaces/IUser";
import { ApiResponse } from "@/interfaces/IResponse";
import { database } from "@/config/database";
import { logger } from "@/utils/logger";

interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export const authenticateToken = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access token required",
        error: "No token provided",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as JWTPayload;

    // Fetch current user data
    const user = await database.queryOne<IUser>(
      "SELECT * FROM users WHERE id = ? AND is_active = true",
      [decoded.userId]
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid token",
        error: "User not found or inactive",
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error("Authentication error:", error);

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Token expired",
        error: "Please login again",
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Invalid token",
        error: "Token verification failed",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Authentication failed",
        error: "Internal server error",
      });
    }
  }
};

export const authorizeRoles = (...roles: UserRole[]) => {
  return (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "No user found in request",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Access denied",
        error: `Required roles: ${roles.join(", ")}`,
      });
      return;
    }

    next();
  };
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as JWTPayload;

      const user = await database.queryOne<IUser>(
        "SELECT * FROM users WHERE id = ? AND is_active = true",
        [decoded.userId]
      );

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};
