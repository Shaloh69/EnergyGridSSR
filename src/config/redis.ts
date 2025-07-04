import Redis from "ioredis";
import { logger } from "@/utils/logger";
import { CACHE_TTL, CACHE_KEYS } from "@/utils/constants";

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  keepAlive: number;
  family: number;
  connectTimeout: number;
  commandTimeout: number;
}

class RedisClient {
  private client: Redis;
  private config?: RedisConfig;
  private isConnected: boolean = false;

  constructor() {
    // Check if Redis URL is provided (for services like Upstash)
    const redisUrl =
      process.env.REDIS_URL ||
      "rediss://default:AaUrAAIjcDEzNTUxYzkzZjRlZjY0OTJiODViMDZhNGZjNzI2NjUwOXAxMA@hopeful-lemur-42283.upstash.io:6379";

    if (redisUrl) {
      // Use connection string with basic ioredis options
      this.client = new Redis(redisUrl, {
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        family: 4,
        connectTimeout: 10000,
        commandTimeout: 5000,
        tls: {}, // Enable TLS for rediss:// URLs
      });
    } else {
      // Fallback to individual config properties
      this.config = {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || "0"),
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 1,
        family: 4,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };

      this.client = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        enableReadyCheck: this.config.enableReadyCheck,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        lazyConnect: this.config.lazyConnect,
        family: this.config.family,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
      });
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on("connect", () => {
      logger.info("Redis client connecting...");
    });

    this.client.on("ready", () => {
      this.isConnected = true;
      logger.info("✅ Redis client connected and ready");
    });

    this.client.on("error", (error) => {
      this.isConnected = false;
      logger.error("❌ Redis client error:", error);
    });

    this.client.on("close", () => {
      this.isConnected = false;
      logger.warn("Redis client connection closed");
    });

    this.client.on("reconnecting", () => {
      logger.info("Redis client reconnecting...");
    });
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info("Redis connection established");
    } catch (error) {
      logger.error("Failed to connect to Redis:", error);
      throw error;
    }
  }

  /**
   * Get the Redis client instance
   */
  public getClient(): Redis {
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  public isReady(): boolean {
    return this.isConnected && this.client.status === "ready";
  }

  /**
   * Set a value with optional TTL
   */
  public async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);

      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      logger.error("Redis SET error:", error);
      throw error;
    }
  }

  /**
   * Get a value and optionally parse JSON
   */
  public async get(key: string, parseJSON: boolean = true): Promise<any> {
    try {
      const value = await this.client.get(key);

      if (value === null) {
        return null;
      }

      if (parseJSON) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }

      return value;
    } catch (error) {
      logger.error("Redis GET error:", error);
      return null;
    }
  }

  /**
   * Delete one or more keys
   */
  public async del(keys: string | string[]): Promise<number> {
    try {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      return await this.client.del(...keysArray);
    } catch (error) {
      logger.error("Redis DEL error:", error);
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Redis EXISTS error:", error);
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logger.error("Redis EXPIRE error:", error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  public async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error("Redis TTL error:", error);
      return -1;
    }
  }

  /**
   * Increment a numeric value
   */
  public async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error("Redis INCR error:", error);
      return 0;
    }
  }

  /**
   * Increment by a specific amount
   */
  public async incrby(key: string, increment: number): Promise<number> {
    try {
      return await this.client.incrby(key, increment);
    } catch (error) {
      logger.error("Redis INCRBY error:", error);
      return 0;
    }
  }

  /**
   * Get all keys matching a pattern
   */
  public async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error("Redis KEYS error:", error);
      return [];
    }
  }

  /**
   * Add to a hash
   */
  public async hset(key: string, field: string, value: any): Promise<void> {
    try {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);
      await this.client.hset(key, field, serialized);
    } catch (error) {
      logger.error("Redis HSET error:", error);
      throw error;
    }
  }

  /**
   * Get from a hash
   */
  public async hget(
    key: string,
    field: string,
    parseJSON: boolean = true
  ): Promise<any> {
    try {
      const value = await this.client.hget(key, field);

      if (value === null) {
        return null;
      }

      if (parseJSON) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }

      return value;
    } catch (error) {
      logger.error("Redis HGET error:", error);
      return null;
    }
  }

  /**
   * Get all fields and values from a hash
   */
  public async hgetall(
    key: string,
    parseJSON: boolean = true
  ): Promise<Record<string, any>> {
    try {
      const hash = await this.client.hgetall(key);

      if (parseJSON) {
        const parsed: Record<string, any> = {};
        for (const [field, value] of Object.entries(hash)) {
          try {
            parsed[field] = JSON.parse(value);
          } catch {
            parsed[field] = value;
          }
        }
        return parsed;
      }

      return hash;
    } catch (error) {
      logger.error("Redis HGETALL error:", error);
      return {};
    }
  }

  /**
   * Delete a field from a hash
   */
  public async hdel(key: string, field: string | string[]): Promise<number> {
    try {
      const fields = Array.isArray(field) ? field : [field];
      return await this.client.hdel(key, ...fields);
    } catch (error) {
      logger.error("Redis HDEL error:", error);
      return 0;
    }
  }

  /**
   * Add to a list (left push)
   */
  public async lpush(key: string, value: any): Promise<number> {
    try {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);
      return await this.client.lpush(key, serialized);
    } catch (error) {
      logger.error("Redis LPUSH error:", error);
      return 0;
    }
  }

  /**
   * Get from a list
   */
  public async lrange(
    key: string,
    start: number,
    stop: number,
    parseJSON: boolean = true
  ): Promise<any[]> {
    try {
      const values = await this.client.lrange(key, start, stop);

      if (parseJSON) {
        return values.map((value) => {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        });
      }

      return values;
    } catch (error) {
      logger.error("Redis LRANGE error:", error);
      return [];
    }
  }

  /**
   * Cache user session
   */
  public async cacheUserSession(
    userId: number,
    sessionData: any,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<void> {
    const key = `${CACHE_KEYS.USER_SESSION}${userId}`;
    await this.set(key, sessionData, ttl);
  }

  /**
   * Get cached user session
   */
  public async getUserSession(userId: number): Promise<any> {
    const key = `${CACHE_KEYS.USER_SESSION}${userId}`;
    return await this.get(key);
  }

  /**
   * Cache building data
   */
  public async cacheBuildingData(
    buildingId: number,
    data: any,
    ttl: number = CACHE_TTL.LONG
  ): Promise<void> {
    const key = `${CACHE_KEYS.BUILDING_DATA}${buildingId}`;
    await this.set(key, data, ttl);
  }

  /**
   * Get cached building data
   */
  public async getBuildingData(buildingId: number): Promise<any> {
    const key = `${CACHE_KEYS.BUILDING_DATA}${buildingId}`;
    return await this.get(key);
  }

  /**
   * Cache energy statistics
   */
  public async cacheEnergyStats(
    buildingId: number,
    stats: any,
    ttl: number = CACHE_TTL.SHORT
  ): Promise<void> {
    const key = `${CACHE_KEYS.ENERGY_STATS}${buildingId}`;
    await this.set(key, stats, ttl);
  }

  /**
   * Get cached energy statistics
   */
  public async getEnergyStats(buildingId: number): Promise<any> {
    const key = `${CACHE_KEYS.ENERGY_STATS}${buildingId}`;
    return await this.get(key);
  }

  /**
   * Invalidate all cache for a building
   */
  public async invalidateBuildingCache(buildingId: number): Promise<void> {
    const patterns = [
      `${CACHE_KEYS.BUILDING_DATA}${buildingId}`,
      `${CACHE_KEYS.ENERGY_STATS}${buildingId}`,
      `${CACHE_KEYS.COMPLIANCE_REPORT}${buildingId}*`,
    ];

    for (const pattern of patterns) {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.del(keys);
      }
    }
  }

  /**
   * Rate limiting
   */
  public async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number
  ): Promise<boolean> {
    try {
      const key = `rate_limit:${identifier}`;
      const current = await this.incr(key);

      if (current === 1) {
        await this.expire(key, windowSeconds);
      }

      return current <= limit;
    } catch (error) {
      logger.error("Redis rate limit error:", error);
      return true; // Allow on error
    }
  }

  /**
   * Get Redis info
   */
  public async getInfo(): Promise<string> {
    try {
      return await this.client.info();
    } catch (error) {
      logger.error("Redis INFO error:", error);
      return "";
    }
  }

  /**
   * Flush all data
   */
  public async flushall(): Promise<void> {
    try {
      await this.client.flushall();
      logger.info("Redis data flushed");
    } catch (error) {
      logger.error("Redis FLUSHALL error:", error);
      throw error;
    }
  }

  /**
   * Close connection
   */
  public async quit(): Promise<void> {
    try {
      await this.client.quit();
      logger.info("Redis connection closed");
    } catch (error) {
      logger.error("Redis QUIT error:", error);
      throw error;
    }
  }

  /**
   * Ping Redis
   */
  public async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      logger.error("Redis PING error:", error);
      return false;
    }
  }

  /**
   * Get memory usage
   */
  public async getMemoryUsage(): Promise<any> {
    try {
      const info = await this.getInfo();
      const memorySection = info
        .split("\r\n")
        .filter((line) => line.startsWith("used_memory"));

      const usage: Record<string, string> = {};
      memorySection.forEach((line) => {
        const [key, value] = line.split(":");
        usage[key] = value;
      });

      return usage;
    } catch (error) {
      logger.error("Error getting Redis memory usage:", error);
      return {};
    }
  }
}

// Create and export singleton instance
export const redisClient = new RedisClient();
export default redisClient;
