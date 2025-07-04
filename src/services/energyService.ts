import { database } from "@/config/database";
import {
  IEnergyConsumption,
  IEnergyStats,
} from "@/interfaces/IEnergyConsumption";
import { logger } from "@/utils/logger";

class EnergyService {
  public async getRealTimeConsumption(
    buildingId: string
  ): Promise<IEnergyConsumption[]> {
    try {
      const data = await database.query<IEnergyConsumption>(
        `SELECT * FROM energy_consumption 
         WHERE building_id = ? 
         AND recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
         ORDER BY recorded_at DESC
         LIMIT 60`,
        [buildingId]
      );

      return data;
    } catch (error) {
      logger.error("Error fetching real-time consumption:", error);
      throw error;
    }
  }

  public async getHistoricalConsumption(
    buildingId: string,
    startDate: string,
    endDate: string,
    interval: string = "daily"
  ): Promise<any[]> {
    try {
      let dateFormat: string;
      let groupBy: string;

      switch (interval) {
        case "hourly":
          dateFormat = "%Y-%m-%d %H:00:00";
          groupBy = 'DATE_FORMAT(recorded_at, "%Y-%m-%d %H:00:00")';
          break;
        case "weekly":
          dateFormat = "%Y-%u";
          groupBy = "YEARWEEK(recorded_at)";
          break;
        case "monthly":
          dateFormat = "%Y-%m";
          groupBy = 'DATE_FORMAT(recorded_at, "%Y-%m")';
          break;
        default: // daily
          dateFormat = "%Y-%m-%d";
          groupBy = "DATE(recorded_at)";
      }

      const data = await database.query(
        `SELECT 
          DATE_FORMAT(recorded_at, '${dateFormat}') as date,
          SUM(consumption_kwh) as total_consumption,
          AVG(consumption_kwh) as avg_consumption,
          MAX(demand_kw) as peak_demand,
          SUM(cost_php) as total_cost,
          AVG(power_factor) as avg_power_factor
         FROM energy_consumption 
         WHERE building_id = ? 
         AND recorded_at BETWEEN ? AND ?
         GROUP BY ${groupBy}
         ORDER BY recorded_at ASC`,
        [buildingId, startDate, endDate]
      );

      return data;
    } catch (error) {
      logger.error("Error fetching historical consumption:", error);
      throw error;
    }
  }

  public async addReading(readingData: any): Promise<IEnergyConsumption> {
    try {
      const result = await database.query(
        `INSERT INTO energy_consumption 
         (building_id, consumption_kwh, cost_php, recorded_at, meter_reading, 
          demand_kw, power_factor, energy_type, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          readingData.building_id,
          readingData.consumption_kwh,
          readingData.cost_php,
          readingData.recorded_at,
          readingData.meter_reading,
          readingData.demand_kw,
          readingData.power_factor,
          readingData.energy_type || "total",
          readingData.created_by,
        ]
      );

      const insertId = (result as any).insertId;
      const newReading = await database.queryOne<IEnergyConsumption>(
        "SELECT * FROM energy_consumption WHERE id = ?",
        [insertId]
      );

      if (!newReading) {
        throw new Error("Failed to retrieve created reading");
      }

      return newReading;
    } catch (error) {
      logger.error("Error adding energy reading:", error);
      throw error;
    }
  }

  public async calculateEfficiencyMetrics(
    buildingId: string
  ): Promise<IEnergyStats> {
    try {
      const stats = await database.queryOne<IEnergyStats>(
        `SELECT 
          SUM(consumption_kwh) as total_consumption,
          AVG(consumption_kwh) as average_consumption,
          MAX(demand_kw) as peak_demand,
          SUM(cost_php) as total_cost,
          AVG(power_factor) as average_power_factor,
          CASE 
            WHEN AVG(power_factor) >= 0.95 THEN 100
            WHEN AVG(power_factor) >= 0.90 THEN 85
            WHEN AVG(power_factor) >= 0.85 THEN 70
            ELSE 50
          END as efficiency_score
        FROM energy_consumption 
        WHERE building_id = ? 
        AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [buildingId]
      );

      if (!stats) {
        return {
          total_consumption: 0,
          average_consumption: 0,
          peak_demand: 0,
          total_cost: 0,
          average_power_factor: 0,
          efficiency_score: 0,
        };
      }

      return stats;
    } catch (error) {
      logger.error("Error calculating efficiency metrics:", error);
      throw error;
    }
  }

  public async detectAnomalies(buildingId: string): Promise<any[]> {
    try {
      // Detect consumption spikes (>150% of average)
      const anomalies = await database.query(
        `SELECT 
          ec.*,
          avg_consumption,
          (ec.consumption_kwh / avg_consumption) * 100 as spike_percentage
        FROM energy_consumption ec
        CROSS JOIN (
          SELECT AVG(consumption_kwh) as avg_consumption
          FROM energy_consumption 
          WHERE building_id = ? 
          AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ) avg_data
        WHERE ec.building_id = ?
        AND ec.recorded_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND ec.consumption_kwh > (avg_consumption * 1.5)
        ORDER BY ec.recorded_at DESC`,
        [buildingId, buildingId]
      );

      return anomalies;
    } catch (error) {
      logger.error("Error detecting anomalies:", error);
      throw error;
    }
  }
}

export default new EnergyService();
