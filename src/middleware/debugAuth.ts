// middleware/debugAuth.ts - REPLACE your existing debug middleware with this safe version
import { Request, Response, NextFunction } from "express";
import { logger } from "@/utils/logger";

export const debugAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const isAuthRoute = req.path.startsWith("/api/auth/");
  const publicAuthRoutes = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
  ];
  const isPublicAuthRoute = publicAuthRoutes.some(
    (route) => req.path === route
  );

  if (!isAuthRoute || !isPublicAuthRoute) {
    const authHeader = req.headers.authorization;

    // logger.info("🔍 AUTH DEBUG INFO", {
    //   url: req.url,
    //   path: req.path,
    //   method: req.method,
    //   hasAuthHeader: !!authHeader,
    //   authHeaderType: authHeader
    //     ? authHeader.startsWith("Bearer ")
    //       ? "Bearer"
    //       : "Other"
    //     : "None",
    //   authHeaderLength: authHeader?.length || 0,
    //   authHeaderPreview: authHeader
    //     ? `${authHeader.substring(0, 30)}...`
    //     : "None",
    // });

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      if (token) {
        const parts = token.split(".");

        // Check for obvious corruption signs
        const hasInvalidChars = /[^\w\-\.]/g.test(token);
        const invalidChars = token.match(/[^\w\-\.]/g);

        // logger.info("🔍 TOKEN DEBUG INFO", {
        //   tokenLength: token.length,
        //   tokenParts: parts.length,
        //   headerLength: parts[0]?.length || 0,
        //   payloadLength: parts[1]?.length || 0,
        //   signatureLength: parts[2]?.length || 0,
        //   tokenPreview: `${token.substring(0, 20)}...`,
        //   hasInvalidChars,
        //   invalidChars: invalidChars?.slice(0, 5) || [], // First 5 invalid chars
        //   firstFewBytes: Array.from(token.substring(0, 10)).map((c) =>
        //     c.charCodeAt(0)
        //   ),
        // });

        // SAFE token decoding with comprehensive error handling
        if (parts.length === 3) {
          // Check header
          try {
            const headerDecoded = Buffer.from(parts[0], "base64").toString(
              "utf8"
            );
            const header = JSON.parse(headerDecoded);
            // logger.info("🔍 TOKEN HEADER", header);
          } catch (error) {
            logger.error("🚨 HEADER DECODE ERROR", {
              error: error instanceof Error ? error.message : "Unknown error",
              headerPart: parts[0].substring(0, 20) + "...",
              headerLength: parts[0].length,
              headerBytes: Array.from(parts[0].substring(0, 10)).map((c) =>
                c.charCodeAt(0)
              ),
            });
          }

          // Check payload
          try {
            const payloadDecoded = Buffer.from(parts[1], "base64").toString(
              "utf8"
            );
            const payload = JSON.parse(payloadDecoded);
            // logger.info("🔍 TOKEN PAYLOAD", {
            //   userId: payload.userId,
            //   email: payload.email,
            //   role: payload.role,
            //   iat: payload.iat,
            //   exp: payload.exp,
            //   isExpired: payload.exp
            //     ? Date.now() / 1000 > payload.exp
            //     : "unknown",
            // });
          } catch (error) {
            logger.error("🚨 PAYLOAD DECODE ERROR", {
              error: error instanceof Error ? error.message : "Unknown error",
              payloadPart: parts[1].substring(0, 20) + "...",
              payloadLength: parts[1].length,
              payloadBytes: Array.from(parts[1].substring(0, 10)).map((c) =>
                c.charCodeAt(0)
              ),
              // Try to identify the exact corruption point
              decodedAttempt: (() => {
                try {
                  return Buffer.from(parts[1], "base64")
                    .toString("utf8")
                    .substring(0, 50);
                } catch {
                  return "Cannot decode as base64";
                }
              })(),
            });
          }
        } else {
          logger.error("🚨 WRONG TOKEN PARTS COUNT", {
            expected: 3,
            actual: parts.length,
            tokenRaw: token.substring(0, 50) + "...",
            parts: parts.map((part, i) => ({
              index: i,
              length: part.length,
              preview: part.substring(0, 10) + "...",
              isEmpty: part.length === 0,
            })),
          });
        }

        // Check if token might be double-encoded or mangled
        if (hasInvalidChars || parts.length !== 3) {
          logger.error("🚨 TOKEN CORRUPTION DETECTED", {
            possibleCauses: [
              hasInvalidChars ? "Contains invalid characters" : null,
              parts.length !== 3 ? "Wrong number of parts" : null,
              token.includes("%") ? "Possible URL encoding" : null,
              token.includes(" ") ? "Contains spaces" : null,
              token.length < 50 ? "Too short" : null,
              token.length > 2000 ? "Too long" : null,
            ].filter(Boolean),
            tokenSample: token.substring(0, 100) + "...",
            tokenEncoded: encodeURIComponent(token.substring(0, 50)) + "...",
          });
        }
      } else {
        logger.error("🚨 EMPTY TOKEN AFTER BEARER");
      }
    } else if (authHeader) {
      logger.error("🚨 INVALID AUTH HEADER FORMAT", {
        header: authHeader.substring(0, 50) + "...",
        startsWithBearer: authHeader.startsWith("Bearer "),
        startsWithLowerBearer: authHeader.startsWith("bearer "),
        length: authHeader.length,
        firstChar: authHeader.charCodeAt(0),
        containsBearer: authHeader.includes("Bearer"),
      });
    }
  }

  // logger.info("🔍 ENV DEBUG INFO", {
  //   hasJwtSecret: !!process.env.JWT_SECRET,
  //   jwtSecretLength: process.env.JWT_SECRET?.length || 0,
  //   nodeEnv: process.env.NODE_ENV,
  // });

  next();
};

// Enhanced token extraction for your auth middleware - ADD this to auth.ts
export const enhancedExtractToken = (
  authHeader: string | undefined
): { token: string | null; error?: string } => {
  if (!authHeader) {
    return { token: null, error: "No Authorization header provided" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      token: null,
      error: `Invalid Authorization header format. Expected "Bearer <token>", got "${authHeader.substring(0, 20)}..."`,
    };
  }

  const token = authHeader.substring(7).trim();

  if (!token || token.length === 0) {
    return { token: null, error: "Empty token in Authorization header" };
  }

  // Enhanced corruption detection
  const invalidChars = token.match(/[^\w\-\.]/g);
  if (invalidChars) {
    return {
      token: null,
      error: `Token contains invalid characters: ${invalidChars.slice(0, 5).join(", ")} (corruption detected)`,
    };
  }

  // Check for common corruption patterns
  if (token.includes("%")) {
    return {
      token: null,
      error: "Token appears to be URL encoded (corruption)",
    };
  }

  if (token.includes(" ")) {
    return { token: null, error: "Token contains spaces (corruption)" };
  }

  if (token.length < 50) {
    return {
      token: null,
      error: `Token too short: ${token.length} characters (likely truncated)`,
    };
  }

  if (token.length > 2000) {
    return {
      token: null,
      error: `Token too long: ${token.length} characters (likely corrupted)`,
    };
  }

  // Validate JWT format
  const parts = token.split(".");
  if (parts.length !== 3) {
    return {
      token: null,
      error: `Invalid JWT format: expected 3 parts, got ${parts.length}. Token preview: ${token.substring(0, 30)}...`,
    };
  }

  // Validate each part is proper base64
  for (let i = 0; i < 3; i++) {
    const part = parts[i];
    if (part.length === 0) {
      return { token: null, error: `JWT part ${i + 1} is empty` };
    }

    // Test base64 validity
    try {
      const decoded = Buffer.from(part, "base64").toString("utf8");
      if (i < 2) {
        // Header and payload should be JSON
        JSON.parse(decoded);
      }
    } catch (error) {
      return {
        token: null,
        error: `JWT part ${i + 1} is not valid base64 or JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  return { token };
};
