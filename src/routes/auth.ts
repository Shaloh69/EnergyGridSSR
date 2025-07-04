import { Router } from "express";
import authController from "@/controllers/authController";
import { validateBody } from "@/middleware/validation";
import { authenticateToken } from "@/middleware/auth";
import {
  loginValidation,
  registerValidation,
  refreshTokenValidation,
} from "@/validations/authValidation";

const router = Router();

// Public routes

/**
 * @route POST /api/auth/register
 * @desc User registration with comprehensive validation and security setup
 * @details Creates new user account with advanced security features including email validation,
 *          password strength enforcement, role-based access control assignment, security audit
 *          logging, welcome notification delivery, and immediate authentication with JWT token
 *          generation. Implements duplicate email prevention, password hashing with bcrypt,
 *          and account initialization with default security settings.
 * @access Public
 */
router.post(
  "/register",
  validateBody(registerValidation),
  authController.register
);

/**
 * @route POST /api/auth/login
 * @desc User authentication with advanced security and session management
 * @details Authenticates user credentials with comprehensive security measures including
 *          password verification using bcrypt, failed login attempt tracking, account
 *          lockout protection, JWT token generation (access and refresh), last login
 *          timestamp updates, security audit logging, and user session initialization.
 *          Returns complete user profile with role-based permissions and authentication tokens.
 * @access Public
 * @example_request
 * POST /api/auth/login
 * Headers: { "Content-Type": "application/json" }
 * Body: {
 *   "email": "energymanager@company.com",
 *   "password": "SecureEnergyPass123!"
 * }
 * @example_response
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "data": {
 *     "user": {
 *       "id": 15,
 *       "email": "energymanager@company.com",
 *       "first_name": "Maria",
 *       "last_name": "Santos",
 *       "role": "energy_manager",
 *       "status": "active",
 *       "last_login": "2024-07-03T14:30:00Z",
 *       "created_at": "2024-01-15T09:00:00Z",
 *       "permissions": [
 *         "energy_data_read",
 *         "energy_data_write",
 *         "alerts_manage",
 *         "reports_generate",
 *         "audits_manage"
 *       ]
 *     },
 *     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE1LCJlbWFpbCI6ImVuZXJneW1hbmFnZXJAY29tcGFueS5jb20iLCJyb2xlIjoiZW5lcmd5X21hbmFnZXIiLCJpYXQiOjE2ODg5OTk5OTksImV4cCI6MTY4OTAwMDg5OX0.signature",
 *     "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE1LCJlbWFpbCI6ImVuZXJneW1hbmFnZXJAY29tcGFueS5jb20iLCJpYXQiOjE2ODg5OTk5OTksImV4cCI6MTY4OTYwNDc5OX0.signature",
 *     "expires_in": 900,
 *     "session_info": {
 *       "login_ip": "192.168.1.100",
 *       "user_agent": "Mozilla/5.0...",
 *       "session_id": "sess_2024070314300001",
 *       "security_level": "standard"
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Invalid email or password",
 *   "error": "AUTHENTICATION_FAILED",
 *   "details": {
 *     "attempts_remaining": 2,
 *     "lockout_warning": "Account will be locked after 3 failed attempts"
 *   }
 * }
 */
router.post("/login", validateBody(loginValidation), authController.login);

/**
 * @route POST /api/auth/refresh
 * @desc Token refresh with security validation and rotation
 * @details Generates new access token using valid refresh token with comprehensive security
 *          validation including token signature verification, expiration checking, blacklist
 *          validation, user account status verification, and automatic token rotation for
 *          enhanced security. Handles token expiration gracefully with appropriate error
 *          messaging and maintains session continuity.
 * @access Public (requires valid refresh token)
 */
router.post(
  "/refresh",
  validateBody(refreshTokenValidation),
  authController.refreshToken
);

// Protected routes

/**
 * @route POST /api/auth/logout
 * @desc User logout with comprehensive session termination and security cleanup
 * @details Terminates user session with complete security cleanup including refresh token
 *          blacklisting, session data clearing, logout activity logging for audit trails,
 *          and optional multi-device session termination. Ensures complete session
 *          invalidation across all access points for security compliance and
 *          provides confirmation of successful logout.
 * @access Private (All authenticated users)
 */
router.post("/logout", authenticateToken, authController.logout);

/**
 * @route GET /api/auth/profile
 * @desc Retrieve comprehensive user profile with activity statistics and security information
 * @details Fetches enhanced user profile including personal information, role details,
 *          comprehensive activity statistics (audits conducted, maintenance performed,
 *          energy readings created, power quality readings), recent activity history,
 *          account security settings, membership duration, and performance metrics.
 *          Excludes sensitive data while providing complete user context for dashboard
 *          and profile management functionality.
 * @access Private (All authenticated users)
 * @example_request
 * GET /api/auth/profile
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 * @example_response
 * {
 *   "success": true,
 *   "message": "User profile retrieved successfully",
 *   "data": {
 *     "user": {
 *       "id": 15,
 *       "email": "energymanager@company.com",
 *       "first_name": "Maria",
 *       "last_name": "Santos",
 *       "role": "energy_manager",
 *       "status": "active",
 *       "created_at": "2024-01-15T09:00:00Z",
 *       "last_login": "2024-07-03T14:30:00Z",
 *       "profile_completion": 95,
 *       "preferences": {
 *         "timezone": "Asia/Manila",
 *         "language": "en",
 *         "notifications": {
 *           "email_alerts": true,
 *           "sms_alerts": false,
 *           "dashboard_notifications": true
 *         }
 *       }
 *     },
 *     "activity_statistics": {
 *       "audits_conducted": 23,
 *       "maintenance_performed": 45,
 *       "energy_readings_created": 156,
 *       "power_quality_readings_created": 89,
 *       "reports_generated": 12,
 *       "alerts_resolved": 67,
 *       "member_since": "2024-01-15"
 *     },
 *     "recent_activity": [
 *       {
 *         "type": "audit",
 *         "description": "Completed Q2 Energy Efficiency Audit",
 *         "timestamp": "2024-07-02T16:45:00Z",
 *         "location": "Green Energy Office Complex"
 *       },
 *       {
 *         "type": "alert_resolution",
 *         "description": "Resolved power quality violation alert",
 *         "timestamp": "2024-07-02T10:30:00Z",
 *         "location": "Manufacturing Plant A"
 *       },
 *       {
 *         "type": "report",
 *         "description": "Generated monthly energy report",
 *         "timestamp": "2024-07-01T14:15:00Z",
 *         "location": "System Dashboard"
 *       }
 *     ],
 *     "performance_metrics": {
 *       "audit_completion_rate": 96.5,
 *       "average_alert_response_time_minutes": 15.2,
 *       "energy_savings_identified_php": 456750.00,
 *       "efficiency_improvements_implemented": 18
 *     },
 *     "access_permissions": [
 *       "energy_data_read",
 *       "energy_data_write",
 *       "alerts_manage",
 *       "reports_generate",
 *       "audits_manage",
 *       "thresholds_configure",
 *       "analytics_access"
 *     ],
 *     "security_info": {
 *       "two_factor_enabled": false,
 *       "last_password_change": "2024-05-15T08:00:00Z",
 *       "active_sessions": 1,
 *       "failed_login_attempts": 0,
 *       "account_locked": false
 *     },
 *     "dashboard_preferences": {
 *       "default_building": 1,
 *       "preferred_charts": ["energy_trends", "alert_summary", "compliance_scores"],
 *       "refresh_interval_seconds": 300
 *     }
 *   }
 * }
 * @example_error
 * {
 *   "success": false,
 *   "message": "Access token expired",
 *   "error": "TOKEN_EXPIRED",
 *   "details": {
 *     "expired_at": "2024-07-03T14:15:00Z",
 *     "refresh_required": true
 *   }
 * }
 */
router.get("/profile", authenticateToken, authController.getProfile);

export default router;
