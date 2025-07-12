import Joi from "joi";
import { UserRole } from "@/types/enums";

export const registerValidation = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string()
    .min(8)
    .pattern(
      new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])")
    )
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      "any.required": "Password is required",
    }),
  first_name: Joi.string().min(2).max(100).required().messages({
    "string.min": "First name must be at least 2 characters long",
    "string.max": "First name cannot exceed 100 characters",
    "any.required": "First name is required",
  }),
  last_name: Joi.string().min(2).max(100).required().messages({
    "string.min": "Last name must be at least 2 characters long",
    "string.max": "Last name cannot exceed 100 characters",
    "any.required": "Last name is required",
  }),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required()
    .messages({
      "any.only":
        "Role must be one of: admin, energy_manager, facility_engineer, staff, student",
      "any.required": "Role is required",
    }),
  department: Joi.string().max(100).optional(),
  phone: Joi.string()
    .pattern(/^[+]?[0-9\-\s\(\)]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Please provide a valid phone number",
    }),
});

export const loginValidation = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

export const refreshTokenValidation = Joi.object({
  refreshToken: Joi.string().required().messages({
    "any.required": "Refresh token is required",
  }),
});

export const updateProfileValidation = Joi.object({
  first_name: Joi.string().min(2).max(100).optional(),
  last_name: Joi.string().min(2).max(100).optional(),
  department: Joi.string().max(100).optional().allow(""),
  phone: Joi.string()
    .pattern(/^[+]?[0-9\-\s\(\)]+$/)
    .optional()
    .allow("")
    .messages({
      "string.pattern.base": "Please provide a valid phone number",
    }),
});

export const changePasswordValidation = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required",
  }),
  newPassword: Joi.string()
    .min(8)
    .pattern(
      new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])")
    )
    .required()
    .messages({
      "string.min": "New password must be at least 8 characters long",
      "string.pattern.base":
        "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      "any.required": "New password is required",
    }),
});
