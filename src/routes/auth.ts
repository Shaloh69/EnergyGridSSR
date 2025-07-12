// auth.ts
import { Router } from "express";
import authController from "@/controllers/authController";
import { validateBody } from "@/middleware/validation";
import { authenticateToken } from "@/middleware/auth";
import {
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  updateProfileValidation,
  changePasswordValidation,
} from "@/validations/authValidation";

const router = Router();

// Routes

// Register new user
router.post(
  "/register",
  validateBody(registerValidation),
  authController.register
);

// Login user
router.post("/login", validateBody(loginValidation), authController.login);

// Refresh access token
router.post(
  "/refresh",
  validateBody(refreshTokenValidation),
  authController.refreshToken
);

// Logout user (requires authentication)
router.post("/logout", authenticateToken, authController.logout);

// Get user profile (requires authentication)
router.get("/profile", authenticateToken, authController.getProfile);

// Update user profile (requires authentication)
router.put(
  "/profile",
  authenticateToken,
  validateBody(updateProfileValidation),
  authController.updateProfile
);

// Change password (requires authentication)
router.put(
  "/change-password",
  authenticateToken,
  validateBody(changePasswordValidation),
  authController.changePassword
);

export default router;
