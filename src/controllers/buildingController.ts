import { Request, Response } from "express";
import {
  IBuilding,
  IBuildingCreate,
  IBuildingUpdate,
} from "@/interfaces/IBuilding";
import { ApiResponse } from "@/interfaces/IResponse";
import {
  PaginatedResponse,
  PaginationQuery,
  FilterQuery,
} from "@/types/common";
import { database } from "@/config/database";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";

interface BuildingQuery extends PaginationQuery, FilterQuery {
  status?: string;
}

class BuildingController {
  /**
   * Get all buildings with pagination and filtering
   */
  public getBuildings = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Starting getBuildings request");

      const {
        page = 1,
        limit = 20,
        sortBy = "name",
        sortOrder = "ASC",
        search,
        status,
      } = req.query as BuildingQuery;

      // Parse and validate pagination
      const pageNum = Math.max(1, parseInt(page.toString()) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit.toString()) || 20)
      );
      const offset = (pageNum - 1) * limitNum;

      // Validate sortBy
      const allowedSortFields = [
        "name",
        "code",
        "area_sqm",
        "floors",
        "year_built",
        "building_type",
        "status",
        "created_at",
        "updated_at",
      ];
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "name";
      const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

      try {
        // Build WHERE conditions with proper parameterization
        const conditions: string[] = [];
        const params: any[] = [];

        if (search && typeof search === "string" && search.trim()) {
          conditions.push("(name LIKE ? OR code LIKE ? OR description LIKE ?)");
          const searchTerm = `%${search.trim()}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }

        if (status && typeof status === "string" && status.trim()) {
          conditions.push("status = ?");
          params.push(status.trim());
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM buildings ${whereClause}`;
        logger.info("Executing count query with params:", {
          query: countQuery.substring(0, 100),
          paramsCount: params.length,
        });

        const countResult = await database.queryOne<{ total: number }>(
          countQuery,
          params
        );
        const totalItems = countResult?.total || 0;
        logger.info("Total buildings found:", totalItems);

        // Get buildings data
        const dataQuery = `
          SELECT 
            id,
            name,
            code,
            area_sqm,
            floors,
            year_built,
            building_type,
            description,
            status,
            created_at,
            updated_at
          FROM buildings 
          ${whereClause}
          ORDER BY ${safeSortBy} ${safeSortOrder}
          LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limitNum, offset];
        logger.info("Executing data query with params:", {
          query: dataQuery.substring(0, 100),
          paramsCount: dataParams.length,
        });

        const buildings = await database.query<IBuilding>(
          dataQuery,
          dataParams
        );
        logger.info("Buildings retrieved:", buildings.length);

        // Enhance buildings with additional data
        const enhancedBuildings =
          await this.enhanceBuildingsWithStats(buildings);

        // Build response
        const totalPages = Math.ceil(totalItems / limitNum);

        const response: ApiResponse<PaginatedResponse<IBuilding>> = {
          success: true,
          message: "Buildings fetched successfully",
          data: {
            data: enhancedBuildings,
            pagination: {
              currentPage: pageNum,
              totalPages,
              totalItems,
              itemsPerPage: limitNum,
              hasNext: pageNum < totalPages,
              hasPrev: pageNum > 1,
            },
          },
        };

        logger.info(
          `Successfully returned ${enhancedBuildings.length} buildings`
        );
        res.json(response);
      } catch (error) {
        logger.error("Error fetching buildings:", error);
        throw new CustomError("Failed to fetch buildings", 500);
      }
    }
  );

  public checkBuildingDeletion = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🔍 Checking building deletion eligibility for ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid building ID", 400);
      }

      const buildingId = parseInt(id);

      try {
        // Check if building exists
        const existingBuilding = await database.queryOne<{
          id: number;
          name: string;
          status: string;
        }>("SELECT id, name, status FROM buildings WHERE id = ?", [buildingId]);

        if (!existingBuilding) {
          throw new CustomError("Building not found", 404);
        }

        // Get detailed counts for all associated data
        const [
          equipmentCheck,
          auditCheck,
          energyCheck,
          alertsCheck,
          powerQualityCheck,
          reportsCheck,
        ] = await Promise.all([
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM equipment WHERE building_id = ?",
            [buildingId]
          ),
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM audits WHERE building_id = ?",
            [buildingId]
          ),
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM energy_consumption WHERE building_id = ?",
            [buildingId]
          ),
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM alerts WHERE building_id = ?",
            [buildingId]
          ),
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM power_quality_readings WHERE building_id = ?",
            [buildingId]
          ),
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM reports WHERE building_id = ?",
            [buildingId]
          ),
        ]);

        const associatedData = {
          equipment: equipmentCheck?.count || 0,
          audits: auditCheck?.count || 0,
          energy_consumption: energyCheck?.count || 0,
          alerts: alertsCheck?.count || 0,
          power_quality_readings: powerQualityCheck?.count || 0,
          reports: reportsCheck?.count || 0,
        };

        // Backend deletion logic (same as deleteBuilding method)
        const blockingData = {
          equipment: associatedData.equipment > 0,
          audits: associatedData.audits > 0,
          energy_consumption: associatedData.energy_consumption > 0,
        };

        const canDelete = !Object.values(blockingData).some((blocks) => blocks);
        const totalAssociatedRecords = Object.values(associatedData).reduce(
          (sum, count) => sum + count,
          0
        );

        const response: ApiResponse<{
          building: typeof existingBuilding;
          can_delete: boolean;
          blocking_reasons: string[];
          associated_data: typeof associatedData;
          blocking_data: typeof blockingData;
          total_associated_records: number;
          deletion_recommendation: string;
        }> = {
          success: true,
          message: "Building deletion check completed",
          data: {
            building: existingBuilding,
            can_delete: canDelete,
            blocking_reasons: [
              ...(blockingData.equipment ? ["Equipment records exist"] : []),
              ...(blockingData.audits ? ["Audit records exist"] : []),
              ...(blockingData.energy_consumption
                ? ["Energy consumption records exist"]
                : []),
            ],
            associated_data: associatedData,
            blocking_data: blockingData,
            total_associated_records: totalAssociatedRecords,
            deletion_recommendation: canDelete
              ? "Building can be safely deleted"
              : "Recommend setting building status to 'inactive' to preserve data integrity",
          },
        };

        logger.info(
          `Deletion check for building ${existingBuilding.name}: ${canDelete ? "ALLOWED" : "BLOCKED"}`
        );
        res.json(response);
      } catch (error) {
        logger.error("Error checking building deletion:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError(
          "Failed to check building deletion eligibility",
          500
        );
      }
    }
  );

  /**
   * Get building by ID with detailed information
   */
  public getBuildingById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Getting building by ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid building ID", 400);
      }

      const buildingId = parseInt(id);

      try {
        // Get building basic data
        const building = await database.queryOne<IBuilding>(
          "SELECT * FROM buildings WHERE id = ?",
          [buildingId]
        );

        if (!building) {
          throw new CustomError("Building not found", 404);
        }

        // Get enhanced statistics
        const [equipmentStats, auditStats, energyStats] = await Promise.all([
          this.getEquipmentStatsForBuilding(buildingId),
          this.getAuditStatsForBuilding(buildingId),
          this.getEnergyStatsForBuilding(buildingId),
        ]);

        // Combine all data
        const enhancedBuilding = {
          ...building,
          ...equipmentStats,
          ...auditStats,
          ...energyStats,
        };

        const response: ApiResponse<IBuilding> = {
          success: true,
          message: "Building fetched successfully",
          data: enhancedBuilding,
        };

        logger.info("Successfully retrieved building:", building.name);
        res.json(response);
      } catch (error) {
        logger.error("Error fetching building by ID:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to fetch building", 500);
      }
    }
  );

  /**
   * Create new building
   */
  public createBuilding = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const buildingData = req.body as IBuildingCreate;
      logger.info("🚀 Creating building:", buildingData.name);

      // Validate required fields
      if (!buildingData.name || !buildingData.code) {
        throw new CustomError("Name and code are required", 400);
      }

      try {
        // Check if code already exists
        const existingBuilding = await database.queryOne(
          "SELECT id FROM buildings WHERE code = ?",
          [buildingData.code]
        );

        if (existingBuilding) {
          throw new CustomError("Building with this code already exists", 409);
        }

        // Insert new building using the new insert method
        const insertQuery = `
          INSERT INTO buildings 
          (name, code, area_sqm, floors, year_built, building_type, description, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
          buildingData.name,
          buildingData.code,
          buildingData.area_sqm || null,
          buildingData.floors || null,
          buildingData.year_built || null,
          buildingData.building_type || null,
          buildingData.description || null,
          buildingData.status || "active",
        ];

        const insertId = await database.insert(insertQuery, insertParams);
        logger.info("Building created with ID:", insertId);

        // Get the created building
        const newBuilding = await database.queryOne<IBuilding>(
          "SELECT * FROM buildings WHERE id = ?",
          [insertId]
        );

        if (!newBuilding) {
          throw new CustomError("Failed to retrieve created building", 500);
        }

        logger.info("Successfully created building:", newBuilding.name);

        const response: ApiResponse<IBuilding> = {
          success: true,
          message: "Building created successfully",
          data: newBuilding,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error("Error creating building:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to create building", 500);
      }
    }
  );

  /**
   * Update building
   */
  public updateBuilding = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updateData = req.body as IBuildingUpdate;
      logger.info("🚀 Updating building ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid building ID", 400);
      }

      const buildingId = parseInt(id);

      try {
        // Check if building exists
        const existingBuilding = await database.queryOne<IBuilding>(
          "SELECT * FROM buildings WHERE id = ?",
          [buildingId]
        );

        if (!existingBuilding) {
          throw new CustomError("Building not found", 404);
        }

        // Check code uniqueness if updating code
        if (updateData.code && updateData.code !== existingBuilding.code) {
          const codeCheck = await database.queryOne(
            "SELECT id FROM buildings WHERE code = ? AND id != ?",
            [updateData.code, buildingId]
          );

          if (codeCheck) {
            throw new CustomError(
              "Building with this code already exists",
              409
            );
          }
        }

        // Build update query dynamically
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        const allowedFields = [
          "name",
          "code",
          "area_sqm",
          "floors",
          "year_built",
          "building_type",
          "description",
          "status",
        ];

        Object.entries(updateData).forEach(([key, value]) => {
          if (allowedFields.includes(key) && value !== undefined) {
            updateFields.push(`${key} = ?`);
            updateValues.push(value);
          }
        });

        if (updateFields.length === 0) {
          throw new CustomError("No valid fields to update", 400);
        }

        // Add building ID to parameters
        updateValues.push(buildingId);

        const updateQuery = `
          UPDATE buildings 
          SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;

        const affectedRows = await database.execute(updateQuery, updateValues);
        logger.info("Update affected rows:", affectedRows);

        // Get updated building
        const updatedBuilding = await database.queryOne<IBuilding>(
          "SELECT * FROM buildings WHERE id = ?",
          [buildingId]
        );

        logger.info("Successfully updated building:", updatedBuilding?.name);

        const response: ApiResponse<IBuilding> = {
          success: true,
          message: "Building updated successfully",
          data: updatedBuilding!,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error updating building:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to update building", 500);
      }
    }
  );

  /**
   * Delete building
   */
  public deleteBuilding = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      logger.info("🚀 Deleting building ID:", id);

      if (!id || isNaN(parseInt(id))) {
        throw new CustomError("Invalid building ID", 400);
      }

      const buildingId = parseInt(id);

      try {
        // Check if building exists
        const existingBuilding = await database.queryOne<{
          id: number;
          name: string;
        }>("SELECT id, name FROM buildings WHERE id = ?", [buildingId]);

        if (!existingBuilding) {
          throw new CustomError("Building not found", 404);
        }

        // Check for associated records
        const [equipmentCheck, auditCheck, energyCheck] = await Promise.all([
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM equipment WHERE building_id = ?",
            [buildingId]
          ),
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM audits WHERE building_id = ?",
            [buildingId]
          ),
          database.queryOne<{ count: number }>(
            "SELECT COUNT(*) as count FROM energy_consumption WHERE building_id = ?",
            [buildingId]
          ),
        ]);

        const hasAssociatedData =
          (equipmentCheck?.count || 0) > 0 ||
          (auditCheck?.count || 0) > 0 ||
          (energyCheck?.count || 0) > 0;

        if (hasAssociatedData) {
          throw new CustomError(
            "Cannot delete building with associated equipment, audits, or energy data. Please set status to inactive instead.",
            400
          );
        }

        // Delete building
        const affectedRows = await database.execute(
          "DELETE FROM buildings WHERE id = ?",
          [buildingId]
        );

        if (affectedRows === 0) {
          throw new CustomError("Failed to delete building", 500);
        }

        logger.info(`Successfully deleted building: ${existingBuilding.name}`);

        const response: ApiResponse = {
          success: true,
          message: "Building deleted successfully",
        };

        res.json(response);
      } catch (error) {
        logger.error("Error deleting building:", error);
        if (error instanceof CustomError) {
          throw error;
        }
        throw new CustomError("Failed to delete building", 500);
      }
    }
  );

  /**
   * Enhance buildings with additional statistics
   */
  private async enhanceBuildingsWithStats(
    buildings: IBuilding[]
  ): Promise<IBuilding[]> {
    if (buildings.length === 0) return buildings;

    try {
      const buildingIds = buildings.map((b) => b.id);

      // Get all stats in parallel using parameterized queries
      const [equipmentStats, auditStats, energyStats] = await Promise.all([
        this.getBulkEquipmentStats(buildingIds),
        this.getBulkAuditStats(buildingIds),
        this.getBulkEnergyStats(buildingIds),
      ]);

      // Enhance buildings with stats
      return buildings.map((building) => ({
        ...building,
        equipment_count: equipmentStats.get(building.id)?.equipment_count || 0,
        audit_count: auditStats.get(building.id)?.audit_count || 0,
        avg_compliance_score:
          auditStats.get(building.id)?.avg_compliance_score || undefined,
        last_energy_reading:
          energyStats.get(building.id)?.last_energy_reading || undefined,
      }));
    } catch (error) {
      logger.error("Error enhancing buildings with stats:", error);
      // Return buildings without enhancement rather than failing
      return buildings;
    }
  }

  /**
   * Get equipment statistics for multiple buildings
   */
  private async getBulkEquipmentStats(
    buildingIds: number[]
  ): Promise<Map<number, any>> {
    const statsMap = new Map();

    if (buildingIds.length === 0) return statsMap;

    try {
      // Create placeholders for IN clause
      const placeholders = buildingIds.map(() => "?").join(",");
      const query = `
        SELECT 
          building_id,
          COUNT(*) as equipment_count
        FROM equipment 
        WHERE building_id IN (${placeholders}) AND status = 'active'
        GROUP BY building_id
      `;

      const results = await database.query<{
        building_id: number;
        equipment_count: number;
      }>(query, buildingIds);

      results.forEach((row) => {
        statsMap.set(row.building_id, { equipment_count: row.equipment_count });
      });
    } catch (error) {
      logger.error("Error getting bulk equipment stats:", error);
    }

    return statsMap;
  }

  /**
   * Get audit statistics for multiple buildings
   */
  private async getBulkAuditStats(
    buildingIds: number[]
  ): Promise<Map<number, any>> {
    const statsMap = new Map();

    if (buildingIds.length === 0) return statsMap;

    try {
      const placeholders = buildingIds.map(() => "?").join(",");
      const query = `
        SELECT 
          building_id,
          COUNT(*) as audit_count,
          AVG(compliance_score) as avg_compliance_score
        FROM audits 
        WHERE building_id IN (${placeholders}) AND status = 'completed'
        GROUP BY building_id
      `;

      const results = await database.query<{
        building_id: number;
        audit_count: number;
        avg_compliance_score: number;
      }>(query, buildingIds);

      results.forEach((row) => {
        statsMap.set(row.building_id, {
          audit_count: row.audit_count,
          avg_compliance_score: row.avg_compliance_score,
        });
      });
    } catch (error) {
      logger.error("Error getting bulk audit stats:", error);
    }

    return statsMap;
  }

  /**
   * Get energy statistics for multiple buildings
   */
  private async getBulkEnergyStats(
    buildingIds: number[]
  ): Promise<Map<number, any>> {
    const statsMap = new Map();

    if (buildingIds.length === 0) return statsMap;

    try {
      const placeholders = buildingIds.map(() => "?").join(",");
      const query = `
        SELECT 
          building_id,
          MAX(recorded_at) as last_energy_reading
        FROM energy_consumption 
        WHERE building_id IN (${placeholders})
        GROUP BY building_id
      `;

      const results = await database.query<{
        building_id: number;
        last_energy_reading: Date;
      }>(query, buildingIds);

      results.forEach((row) => {
        statsMap.set(row.building_id, {
          last_energy_reading: row.last_energy_reading,
        });
      });
    } catch (error) {
      logger.error("Error getting bulk energy stats:", error);
    }

    return statsMap;
  }

  /**
   * Get equipment statistics for a single building
   */
  private async getEquipmentStatsForBuilding(buildingId: number) {
    try {
      const result = await database.queryOne<{
        equipment_count: number;
        total_equipment: number;
      }>(
        `SELECT 
          COUNT(CASE WHEN status = 'active' THEN 1 END) as equipment_count,
          COUNT(*) as total_equipment
        FROM equipment 
        WHERE building_id = ?`,
        [buildingId]
      );
      return result || { equipment_count: 0, total_equipment: 0 };
    } catch (error) {
      logger.error("Error getting equipment stats:", error);
      return { equipment_count: 0, total_equipment: 0 };
    }
  }

  /**
   * Get audit statistics for a single building
   */
  private async getAuditStatsForBuilding(buildingId: number) {
    try {
      const result = await database.queryOne<{
        audit_count: number;
        avg_compliance_score: number;
      }>(
        `SELECT 
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as audit_count,
          AVG(CASE WHEN status = 'completed' THEN compliance_score END) as avg_compliance_score
        FROM audits 
        WHERE building_id = ?`,
        [buildingId]
      );
      return result || { audit_count: 0, avg_compliance_score: undefined };
    } catch (error) {
      logger.error("Error getting audit stats:", error);
      return { audit_count: 0, avg_compliance_score: undefined };
    }
  }

  /**
   * Get energy statistics for a single building
   */
  private async getEnergyStatsForBuilding(buildingId: number) {
    try {
      const result = await database.queryOne<{
        last_energy_reading: Date;
        total_consumption_kwh: number;
        avg_power_factor: number;
      }>(
        `SELECT 
          MAX(recorded_at) as last_energy_reading,
          SUM(consumption_kwh) as total_consumption_kwh,
          AVG(power_factor) as avg_power_factor
        FROM energy_consumption 
        WHERE building_id = ?`,
        [buildingId]
      );
      return (
        result || {
          last_energy_reading: undefined,
          total_consumption_kwh: undefined,
          avg_power_factor: undefined,
        }
      );
    } catch (error) {
      logger.error("Error getting energy stats:", error);
      return {
        last_energy_reading: undefined,
        total_consumption_kwh: undefined,
        avg_power_factor: undefined,
      };
    }
  }
}

export default new BuildingController();
