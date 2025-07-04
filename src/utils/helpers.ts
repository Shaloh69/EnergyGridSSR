import crypto from "crypto";
import { ApiResponse } from "@/interfaces/IResponse";

/**
 * Generate a unique QR code string
 */
export const generateQRCode = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8);
  return `UCLM-${timestamp}-${random}`.toUpperCase();
};

/**
 * Generate a random string of specified length
 */
export const generateRandomString = (length: number = 8): string => {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Convert string to title case
 */
export const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

/**
 * Sanitize string for SQL queries
 */
export const sanitizeString = (str: string): string => {
  return str.replace(/['"\\]/g, "\\$&");
};

/**
 * Format date to MySQL datetime format
 */
export const formatDateForMySQL = (date: Date): string => {
  return date.toISOString().slice(0, 19).replace("T", " ");
};

/**
 * Calculate percentage with precision
 */
export const calculatePercentage = (
  value: number,
  total: number,
  precision: number = 2
): number => {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(precision));
};

/**
 * Create success response
 */
export const createSuccessResponse = <T>(
  message: string,
  data: T
): ApiResponse<T> => {
  return {
    success: true,
    message,
    data,
  };
};

/**
 * Create error response
 */
export const createErrorResponse = (
  message: string,
  error: string
): ApiResponse => {
  return {
    success: false,
    message,
    error,
  };
};

/**
 * Sleep function for delays
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Remove undefined values from object
 */
export const removeUndefined = (
  obj: Record<string, any>
): Record<string, any> => {
  const cleaned: Record<string, any> = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  });
  return cleaned;
};

/**
 * Convert bytes to human readable format
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | undefined;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = undefined;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func(...args);
  };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return function executedFunction(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
