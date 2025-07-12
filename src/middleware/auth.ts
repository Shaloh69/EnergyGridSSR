import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@/types/enums";
import { IUser } from "@/interfaces/IUser";
import { ApiResponse } from "@/interfaces/IResponse";
import { database } from "@/config/database";
import { logger } from "@/utils/logger";
import { enhancedExtractToken } from "./debugAuth";

interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * Enhanced JWT token validation with better error handling
 */
const validateJWTToken = (
  token: string
): { isValid: boolean; error?: string } => {
  // Basic JWT format validation (should have 3 parts separated by dots)
  const parts = token.split(".");

  if (parts.length !== 3) {
    return {
      isValid: false,
      error: `Invalid JWT format: expected 3 parts, got ${parts.length}`,
    };
  }

  // Check if each part is base64 encoded
  try {
    for (let i = 0; i < 3; i++) {
      // Add padding if needed for base64 decoding
      let part = parts[i];
      while (part.length % 4) {
        part += "=";
      }

      if (i < 2) {
        // Header and payload should be JSON
        const decoded = Buffer.from(part, "base64").toString("utf8");
        JSON.parse(decoded); // This will throw if not valid JSON
      }
      // Don't decode signature part as it's binary
    }
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Invalid JWT encoding: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
};

/**
 * Extract and validate token from Authorization header
 */
const extractToken = enhancedExtractToken;
// const extractToken = (
//   authHeader: string | undefined
// ): { token: string | null; error?: string } => {
//   if (!authHeader) {
//     return { token: null, error: "No Authorization header provided" };
//   }

//   // Check if header starts with "Bearer "
//   if (!authHeader.startsWith("Bearer ")) {
//     return {
//       token: null,
//       error: `Invalid Authorization header format. Expected "Bearer <token>", got "${authHeader.substring(0, 20)}..."`,
//     };
//   }

//   const token = authHeader.substring(7); // Remove "Bearer " prefix

//   if (!token || token.trim().length === 0) {
//     return { token: null, error: "Empty token in Authorization header" };
//   }

//   // Validate JWT format
//   const validation = validateJWTToken(token);
//   if (!validation.isValid) {
//     return { token: null, error: validation.error };
//   }

//   return { token };
// };

export const authenticateToken = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // Enhanced token extraction with validation
    const { token, error: extractionError } = extractToken(authHeader);

    if (!token) {
      logger.warn("Token extraction failed:", {
        error: extractionError,
        authHeader: authHeader
          ? `${authHeader.substring(0, 20)}...`
          : "undefined",
        userAgent: req.headers["user-agent"],
        ip: req.ip,
        url: req.url,
      });

      res.status(401).json({
        success: false,
        message: "Access token required",
        error: extractionError || "No token provided",
      });
      return;
    }

    // Log token info for debugging (without exposing the actual token)
    logger.debug("Token validation attempt:", {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 10),
      url: req.url,
      userAgent: req.headers["user-agent"],
    });

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error("JWT_SECRET environment variable is not set");
      res.status(500).json({
        success: false,
        message: "Server configuration error",
        error: "Authentication service unavailable",
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Validate JWT payload structure
    if (!decoded.userId || !decoded.email || !decoded.role) {
      logger.error("Invalid JWT payload structure:", {
        hasUserId: !!decoded.userId,
        hasEmail: !!decoded.email,
        hasRole: !!decoded.role,
        payload: { ...decoded, iat: decoded.iat, exp: decoded.exp },
      });

      res.status(401).json({
        success: false,
        message: "Invalid token payload",
        error: "Token structure is invalid",
      });
      return;
    }

    // Fetch current user data from database
    const user = await database.queryOne<IUser>(
      "SELECT * FROM users WHERE id = ? AND is_active = true",
      [decoded.userId]
    );

    if (!user) {
      logger.warn("User not found or inactive:", {
        userId: decoded.userId,
        email: decoded.email,
        url: req.url,
      });

      res.status(401).json({
        success: false,
        message: "Invalid token",
        error: "User not found or inactive",
      });
      return;
    }

    // Check if user role matches token role (security check)
    if (user.role !== decoded.role) {
      logger.warn("User role mismatch:", {
        userId: decoded.userId,
        tokenRole: decoded.role,
        databaseRole: user.role,
        url: req.url,
      });

      res.status(401).json({
        success: false,
        message: "Token validation failed",
        error: "User permissions have changed",
      });
      return;
    }

    // Update last seen activity (optional, can be disabled for high-traffic routes)
    if (req.method !== "GET" || req.url.includes("/auth/")) {
      try {
        await database.query(
          "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
          [user.id]
        );
      } catch (updateError) {
        // Don't fail authentication if we can't update last_login
        logger.warn("Failed to update user last_login:", updateError);
      }
    }

    // Add user to request object
    req.user = user;

    logger.debug("Authentication successful:", {
      userId: user.id,
      email: user.email,
      role: user.role,
      url: req.url,
    });

    next();
  } catch (error) {
    // Enhanced error logging with more context
    const errorContext = {
      errorType: error instanceof Error ? error.constructor.name : "Unknown",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      url: req.url,
      method: req.method,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      authHeader: req.headers.authorization
        ? `${req.headers.authorization.substring(0, 20)}...`
        : "undefined",
    };

    logger.error("Authentication error:", errorContext);

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Token expired",
        error: "Please login again",
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      // This is where your original error was caught
      res.status(401).json({
        success: false,
        message: "Invalid token",
        error:
          process.env.NODE_ENV === "development"
            ? `Token verification failed: ${error.message}`
            : "Token verification failed",
      });
    } else if (error instanceof jwt.NotBeforeError) {
      res.status(401).json({
        success: false,
        message: "Token not active",
        error: "Token is not valid yet",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Authentication failed",
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : "Internal server error",
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
      logger.warn("Authorization check failed - no user in request:", {
        url: req.url,
        method: req.method,
      });

      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "No user found in request",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn("Authorization check failed - insufficient permissions:", {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        url: req.url,
      });

      res.status(403).json({
        success: false,
        message: "Access denied",
        error: `Required roles: ${roles.join(", ")}. Current role: ${req.user.role}`,
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
    const { token } = extractToken(authHeader);

    if (token) {
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

        const user = await database.queryOne<IUser>(
          "SELECT * FROM users WHERE id = ? AND is_active = true",
          [decoded.userId]
        );

        if (user && user.role === decoded.role) {
          req.user = user;
        }
      }
    }

    next();
  } catch (error) {
    // For optional auth, we silently ignore errors and continue without user
    logger.debug("Optional authentication failed (ignored):", {
      error: error instanceof Error ? error.message : "Unknown error",
      url: req.url,
    });
    next();
  }
};

/**
 * Middleware to validate JWT secret is configured
 */
export const validateJWTConfig = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!process.env.JWT_SECRET) {
    logger.error("JWT_SECRET environment variable is not configured");
    res.status(500).json({
      success: false,
      message: "Server configuration error",
      error: "Authentication service is not properly configured",
    });
    return;
  }
  next();
};

/**
 * Debug middleware to log authentication attempts (use only in development)
 */
export const debugAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (process.env.NODE_ENV === "development") {
    logger.debug("Authentication attempt:", {
      url: req.url,
      method: req.method,
      hasAuthHeader: !!req.headers.authorization,
      authHeaderFormat: req.headers.authorization
        ? req.headers.authorization.startsWith("Bearer ")
          ? "Bearer"
          : "Other"
        : "None",
      userAgent: req.headers["user-agent"],
    });
  }
  next();
};
