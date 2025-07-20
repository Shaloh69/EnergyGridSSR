// utils/debugLogger.ts - Fixed version with better debugging
import { logger } from "./logger";

// Simple debug logger that works with your existing winston logger
export const debugRoute = (module: string, routeName: string) => {
  // Check conditions and log them for debugging
  const nodeEnv = process.env.NODE_ENV;
  const debugRoutes = process.env.DEBUG_ROUTES;

  console.log(`[DEBUG MIDDLEWARE] Environment check:`, {
    NODE_ENV: nodeEnv,
    DEBUG_ROUTES: debugRoutes,
    shouldLog: nodeEnv === "development" || debugRoutes === "true",
  });

  // Force enable for now - you can adjust this later
  const shouldLog = true; // Changed from conditional to always true for testing

  if (!shouldLog) {
    console.log(
      `[DEBUG MIDDLEWARE] Logging disabled for ${module}:${routeName}`
    );
    return (req: any, res: any, next: any) => next();
  }

  console.log(`[DEBUG MIDDLEWARE] Creating logger for ${module}:${routeName}`);

  return (req: any, res: any, next: any) => {
    console.log(
      `[DEBUG MIDDLEWARE] Middleware called for ${module}:${routeName}`
    );

    const startTime = Date.now();
    const originalJson = res.json;
    const originalSend = res.send;

    // Function to safely stringify and limit size
    const safeStringify = (obj: any, maxLength = 2000) => {
      try {
        const str = JSON.stringify(obj);
        return str.length > maxLength
          ? str.substring(0, maxLength) + "...[truncated]"
          : str;
      } catch {
        return "[Unable to stringify]";
      }
    };

    // Function to redact sensitive data
    const redactSensitive = (obj: any) => {
      if (!obj || typeof obj !== "object") return obj;
      const redacted = { ...obj };
      const sensitiveFields = [
        "password",
        "token",
        "refreshToken",
        "accessToken",
        "authorization",
      ];

      sensitiveFields.forEach((field) => {
        if (redacted[field]) redacted[field] = "[REDACTED]";
      });

      return redacted;
    };

    // Override res.json
    res.json = function (body: any) {
      const duration = Date.now() - startTime;

      // Use console.log for immediate output and logger.debug for file logging
      const responseLog = {
        module,
        route: routeName,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        params: req.params,
        query: redactSensitive(req.query),
        requestBody: redactSensitive(req.body),
        responseBody: safeStringify(body),
        userId: req.user?.id,
        userRole: req.user?.role,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      };

      console.log(`🔍 [${module}] ${routeName} - RESPONSE:`, responseLog);

      logger.debug(`[${module}] ${routeName} - RESPONSE`, responseLog);

      return originalJson.call(this, body);
    };

    // Override res.send
    res.send = function (body: any) {
      const duration = Date.now() - startTime;

      const responseLog = {
        module,
        route: routeName,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        params: req.params,
        query: redactSensitive(req.query),
        requestBody: redactSensitive(req.body),
        responseBody:
          typeof body === "string"
            ? body.substring(0, 500) + "..."
            : safeStringify(body, 500),
        userId: req.user?.id,
        userRole: req.user?.role,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      };

      console.log(`🔍 [${module}] ${routeName} - RESPONSE:`, responseLog);

      logger.debug(`[${module}] ${routeName} - RESPONSE`, responseLog);

      return originalSend.call(this, body);
    };

    // Log incoming request
    const requestLog = {
      module,
      route: routeName,
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: redactSensitive(req.query),
      body: redactSensitive(req.body),
      userId: req.user?.id,
      userRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    };

    console.log(`🔍 [${module}] ${routeName} - REQUEST:`, requestLog);

    logger.debug(`[${module}] ${routeName} - REQUEST`, requestLog);

    next();
  };
};

// Even simpler version for testing
export const simpleDebug = (routeName: string) => {
  return (req: any, res: any, next: any) => {
    console.log(`🔥 SIMPLE DEBUG: ${req.method} ${req.path} - ${routeName}`);

    const originalJson = res.json;
    res.json = function (body: any) {
      console.log(
        `🔥 SIMPLE RESPONSE: ${req.method} ${req.path} - ${res.statusCode}`,
        body
      );
      return originalJson.call(this, body);
    };

    next();
  };
};
