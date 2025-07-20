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
import { debugRoute } from "@/utils/debugLogger";

const router = Router();

// Routes with debug logging
router.post(
  "/register",
  debugRoute("AUTH", "REGISTER_USER"),
  validateBody(registerValidation),
  authController.register
);

router.post(
  "/login",
  debugRoute("AUTH", "LOGIN_USER"),
  validateBody(loginValidation),
  authController.login
);

router.post(
  "/refresh",
  debugRoute("AUTH", "REFRESH_TOKEN"),
  validateBody(refreshTokenValidation),
  authController.refreshToken
);

router.post(
  "/logout",
  debugRoute("AUTH", "LOGOUT_USER"),
  authenticateToken,
  authController.logout
);

router.get(
  "/profile",
  debugRoute("AUTH", "GET_PROFILE"),
  authenticateToken,
  authController.getProfile
);

router.put(
  "/profile",
  debugRoute("AUTH", "UPDATE_PROFILE"),
  authenticateToken,
  validateBody(updateProfileValidation),
  authController.updateProfile
);

router.put(
  "/change-password",
  debugRoute("AUTH", "CHANGE_PASSWORD"),
  authenticateToken,
  validateBody(changePasswordValidation),
  authController.changePassword
);

export default router;
