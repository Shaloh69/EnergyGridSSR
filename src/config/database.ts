import mysql from "mysql2/promise";
import { logger } from "@/utils/logger";

interface ConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  timezone: string;
  supportBigNumbers: boolean;
  bigNumberStrings: boolean;
  dateStrings: boolean;
  connectTimeout: number;
}

interface PoolConfig extends ConnectionConfig {
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
  // Removed acquireTimeout as it's not a valid MySQL2 option
  // Removed idleTimeout as it's not a standard MySQL2 pool option
  // Removed maxIdle as it's not a standard MySQL2 pool option
  // Removed enableKeepAlive and keepAliveInitialDelay as they're not pool options
}

class Database {
  private pool: mysql.Pool;
  private config: PoolConfig;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "uclm_energy_audit",
      timezone: "+00:00",
      supportBigNumbers: true,
      bigNumberStrings: false,
      dateStrings: false,
      connectTimeout: 60000,
      // Pool-specific options (only valid MySQL2 options)
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "10"),
      queueLimit: 0, // 0 means no limit
    };

    this.pool = mysql.createPool(this.config);
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      const connection = await this.pool.getConnection();
      logger.info("✅ Database connection established successfully");
      connection.release();
    } catch (error) {
      logger.error("❌ Database connection failed:", error);
      logger.error(
        "Please check your database configuration and ensure MySQL is running"
      );
    }
  }

  /**
   * Execute a query and return multiple rows
   * Uses individual connections to avoid pool.execute() issues
   */
  public async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const connection = await this.pool.getConnection();

    try {
      logger.debug("🔍 Executing query:", {
        sql: sql.substring(0, 100),
        paramsCount: params?.length || 0,
      });

      let result;

      if (!params || params.length === 0) {
        // No parameters - use query method
        [result] = await connection.query(sql);
      } else {
        // With parameters - sanitize first
        const sanitizedParams = this.sanitizeParams(params);
        logger.debug("🔧 Sanitized params:", sanitizedParams);

        try {
          // Try execute first
          [result] = await connection.execute(sql, sanitizedParams);
        } catch (executeError) {
          logger.warn("⚠️ Execute failed, falling back to manual substitution");
          // Fallback to manual parameter substitution
          const manualSql = this.buildManualQuery(sql, sanitizedParams);
          [result] = await connection.query(manualSql);
        }
      }

      logger.debug(
        "✅ Query successful, rows:",
        (result as any[])?.length || 0
      );
      return result as T[];
    } catch (error) {
      logger.error("❌ Database query error:", {
        error: error instanceof Error ? error.message : error,
        sql: sql.substring(0, 200),
        paramsLength: params?.length || 0,
      });
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute a query and return a single row
   */
  public async queryOne<T = any>(
    sql: string,
    params?: any[]
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute a raw SQL query without parameters (for complex queries)
   */
  public async queryRaw<T = any>(sql: string): Promise<T[]> {
    const connection = await this.pool.getConnection();

    try {
      logger.debug("🔍 Executing raw query:", sql.substring(0, 100));
      const [result] = await connection.query(sql);
      logger.debug("✅ Raw query successful");
      return result as T[];
    } catch (error) {
      logger.error("❌ Raw query error:", {
        error: error instanceof Error ? error.message : error,
        sql: sql.substring(0, 200),
      });
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  public async transaction<T>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<T> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      logger.debug("🔄 Transaction started");

      const result = await callback(connection);

      await connection.commit();
      logger.debug("✅ Transaction committed");

      return result;
    } catch (error) {
      await connection.rollback();
      logger.error("❌ Transaction rolled back:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute INSERT and return the inserted ID
   */
  public async insert(sql: string, params?: any[]): Promise<number> {
    const connection = await this.pool.getConnection();

    try {
      let result;

      if (!params || params.length === 0) {
        [result] = await connection.query(sql);
      } else {
        const sanitizedParams = this.sanitizeParams(params);
        try {
          [result] = await connection.execute(sql, sanitizedParams);
        } catch (executeError) {
          // Fallback to manual substitution
          const manualSql = this.buildManualQuery(sql, sanitizedParams);
          [result] = await connection.query(manualSql);
        }
      }

      const insertId = (result as any).insertId;
      logger.debug("✅ Insert successful, ID:", insertId);

      return insertId;
    } catch (error) {
      logger.error("❌ Insert error:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute UPDATE/DELETE and return affected rows
   */
  public async execute(sql: string, params?: any[]): Promise<number> {
    const connection = await this.pool.getConnection();

    try {
      let result;

      if (!params || params.length === 0) {
        [result] = await connection.query(sql);
      } else {
        const sanitizedParams = this.sanitizeParams(params);
        try {
          [result] = await connection.execute(sql, sanitizedParams);
        } catch (executeError) {
          // Fallback to manual substitution
          const manualSql = this.buildManualQuery(sql, sanitizedParams);
          [result] = await connection.query(manualSql);
        }
      }

      const affectedRows = (result as any).affectedRows;
      logger.debug("✅ Execute successful, affected rows:", affectedRows);

      return affectedRows;
    } catch (error) {
      logger.error("❌ Execute error:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Sanitize parameters to prevent issues
   */
  private sanitizeParams(params: any[]): any[] {
    return params.map((param) => {
      // Handle null/undefined
      if (param === null || param === undefined) {
        return null;
      }

      // Handle numbers
      if (typeof param === "number") {
        return isNaN(param) ? null : param;
      }

      // Handle strings
      if (typeof param === "string") {
        return param;
      }

      // Handle dates
      if (param instanceof Date) {
        return param.toISOString().slice(0, 19).replace("T", " ");
      }

      // Handle booleans
      if (typeof param === "boolean") {
        return param ? 1 : 0;
      }

      // Handle objects/arrays (JSON stringify)
      if (typeof param === "object") {
        return JSON.stringify(param);
      }

      return param;
    });
  }

  /**
   * Build manual query by substituting parameters (fallback method)
   */
  private buildManualQuery(sql: string, params: any[]): string {
    let paramIndex = 0;

    return sql.replace(/\?/g, () => {
      if (paramIndex >= params.length) {
        throw new Error("Not enough parameters for query");
      }

      const param = params[paramIndex++];

      if (param === null || param === undefined) {
        return "NULL";
      }

      if (typeof param === "number") {
        return param.toString();
      }

      if (typeof param === "string") {
        // Escape single quotes
        return `'${param.replace(/'/g, "''")}'`;
      }

      if (typeof param === "boolean") {
        return param ? "1" : "0";
      }

      // For other types, stringify and quote
      return `'${String(param).replace(/'/g, "''")}'`;
    });
  }

  /**
   * Get database statistics
   */
  public async getStats(): Promise<any> {
    try {
      const stats = await this.queryRaw("SHOW STATUS");
      const connections = await this.queryRaw("SHOW PROCESSLIST");

      return {
        pool_config: {
          connectionLimit: this.config.connectionLimit,
          queueLimit: this.config.queueLimit,
          host: this.config.host,
          database: this.config.database,
        },
        active_connections: connections.length,
        status: stats.reduce((acc: any, stat: any) => {
          acc[stat.Variable_name] = stat.Value;
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.error("Error getting database stats:", error);
      throw error;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.queryOne("SELECT 1 as health_check");
      return true;
    } catch (error) {
      logger.error("Database health check failed:", error);
      return false;
    }
  }

  /**
   * Check if database is ready
   */
  public async isDatabaseReady(): Promise<boolean> {
    try {
      const result = await this.queryOne("SELECT DATABASE() as current_db");
      return result && result.current_db === this.config.database;
    } catch (error) {
      logger.error("Database readiness check failed:", error);
      return false;
    }
  }

  /**
   * Get table information
   */
  public async getTableInfo(tableName: string): Promise<any[]> {
    try {
      // Use safe string interpolation since tableName should be controlled
      return await this.queryRaw(`DESCRIBE \`${tableName.replace(/`/g, "")}\``);
    } catch (error) {
      logger.error(`Error getting table info for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Check if table exists
   */
  public async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.queryOne(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        [this.config.database, tableName]
      );
      return (result as any)?.count > 0;
    } catch (error) {
      logger.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
  }

  /**
   * Get database size
   */
  public async getDatabaseSize(): Promise<number> {
    try {
      const result = await this.queryOne(
        `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS size_mb
         FROM information_schema.tables 
         WHERE table_schema = ?`,
        [this.config.database]
      );
      return (result as any)?.size_mb || 0;
    } catch (error) {
      logger.error("Error getting database size:", error);
      return 0;
    }
  }

  /**
   * Optimize all tables
   */
  public async optimizeTables(): Promise<void> {
    try {
      const tables = await this.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
        [this.config.database]
      );

      for (const table of tables) {
        await this.queryRaw(`OPTIMIZE TABLE \`${(table as any).table_name}\``);
      }

      logger.info("Database tables optimized successfully");
    } catch (error) {
      logger.error("Error optimizing database tables:", error);
      throw error;
    }
  }

  /**
   * Execute multiple queries in sequence (non-transactional)
   */
  public async executeScript(queries: string[]): Promise<void> {
    try {
      for (const query of queries) {
        if (query.trim()) {
          await this.queryRaw(query);
        }
      }
      logger.info(`Executed ${queries.length} database queries successfully`);
    } catch (error) {
      logger.error("Error executing database script:", error);
      throw error;
    }
  }

  /**
   * Get connection pool status
   */
  public async getPoolStatus(): Promise<any> {
    try {
      const connectionInfo = await this.queryRaw(
        "SHOW STATUS LIKE 'Connections'"
      );
      const threadsConnected = await this.queryRaw(
        "SHOW STATUS LIKE 'Threads_connected'"
      );
      const maxConnections = await this.queryRaw(
        "SHOW VARIABLES LIKE 'max_connections'"
      );

      return {
        pool_configuration: {
          connection_limit: this.config.connectionLimit,
          queue_limit: this.config.queueLimit,
          host: this.config.host,
          database: this.config.database,
        },
        database_status: {
          total_connections: (connectionInfo[0] as any)?.Value || 0,
          threads_connected: (threadsConnected[0] as any)?.Value || 0,
          max_connections: (maxConnections[0] as any)?.Value || 0,
        },
      };
    } catch (error) {
      logger.error("Error getting pool status:", error);
      throw error;
    }
  }

  /**
   * Close all connections
   */
  public async close(): Promise<void> {
    try {
      await this.pool.end();
      logger.info("Database connections closed");
    } catch (error) {
      logger.error("Error closing database connections:", error);
      throw error;
    }
  }

  /**
   * Get the raw pool for advanced operations
   */
  public getPool(): mysql.Pool {
    return this.pool;
  }
}

// Create and export singleton instance
export const database = new Database();
export default database;
