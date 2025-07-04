import { Request, Response } from "express";
import { ApiResponse } from "@/interfaces/IResponse";
import { database } from "@/config/database";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";

interface DashboardOverview {
  totalBuildings: number;
  activeBuildings: number;
  totalEquipment: number;
  equipmentNeedingMaintenance: number;
  totalAudits: number;
  completedAudits: number;
  averageComplianceScore: number;
  totalEnergyConsumption: number;
  lastMonthConsumption: number;
  energyTrend: string;
  criticalAlerts: number;
  powerQualityIssues: number;
  systemHealthScore: number;
}

interface RealTimeMetrics {
  currentPowerConsumption: number;
  averagePowerFactor: number;
  voltageStability: number;
  frequencyStability: number;
  activeFaults: number;
  systemStatus: string;
  lastUpdateTime: Date;
}

interface Alert {
  id: number;
  type: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  buildingName?: string;
  timestamp: Date;
  status: string;
}

class DashboardController {
  public getDashboardOverview = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting dashboard overview");

      try {
        // Get all statistics in parallel for better performance
        const [
          buildingStats,
          equipmentStats,
          auditStats,
          energyStats,
          alertStats,
          powerQualityStats,
          systemHealth,
        ] = await Promise.all([
          this.getBuildingStatistics(),
          this.getEquipmentStatistics(),
          this.getAuditStatistics(),
          this.getEnergyStatistics(),
          this.getAlertStatistics(),
          this.getPowerQualityStatistics(),
          this.getSystemHealthScore(),
        ]);

        // Calculate energy trend
        const currentMonth = energyStats?.last_month_consumption || 0;
        const previousMonth = energyStats?.previous_month_consumption || 0;
        let energyTrend = "stable";
        if (previousMonth > 0) {
          const change = ((currentMonth - previousMonth) / previousMonth) * 100;
          if (change > 5) energyTrend = "increasing";
          else if (change < -5) energyTrend = "decreasing";
        }

        const overview: DashboardOverview = {
          totalBuildings: buildingStats?.total_buildings || 0,
          activeBuildings: buildingStats?.active_buildings || 0,
          totalEquipment: equipmentStats?.total_equipment || 0,
          equipmentNeedingMaintenance:
            equipmentStats?.equipment_needing_maintenance || 0,
          totalAudits: auditStats?.total_audits || 0,
          completedAudits: auditStats?.completed_audits || 0,
          averageComplianceScore: Math.round(
            auditStats?.average_compliance_score || 0
          ),
          totalEnergyConsumption: energyStats?.total_consumption || 0,
          lastMonthConsumption: currentMonth,
          energyTrend,
          criticalAlerts: alertStats?.critical_alerts || 0,
          powerQualityIssues: powerQualityStats?.pq_issues || 0,
          systemHealthScore: systemHealth?.health_score || 0,
        };

        logger.info("Successfully retrieved dashboard overview");

        const response: ApiResponse<DashboardOverview> = {
          success: true,
          message: "Dashboard overview fetched successfully",
          data: overview,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching dashboard overview:", error);
        throw new CustomError("Failed to fetch dashboard overview", 500);
      }
    }
  );

  public getRealTimeMetrics = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting real-time metrics");

      try {
        // Get latest power consumption
        const latestPower = await database.queryOne<any>(
          `SELECT 
            SUM(demand_kw) as current_power,
            MAX(recorded_at) as last_update
           FROM energy_consumption ec
           WHERE ec.recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
           AND ec.recorded_at = (
             SELECT MAX(recorded_at) 
             FROM energy_consumption ec2
             WHERE ec2.building_id = ec.building_id
           )`
        );

        // Get latest power quality metrics
        const latestPQ = await database.queryOne<any>(
          `SELECT 
            AVG(power_factor) as avg_power_factor,
            AVG((voltage_l1 + voltage_l2 + voltage_l3) / 3) as avg_voltage,
            AVG(frequency) as avg_frequency,
            AVG(voltage_unbalance) as avg_voltage_unbalance,
            MAX(recorded_at) as last_pq_update
           FROM power_quality 
           WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`
        );

        // Calculate stability metrics
        const voltageStability = latestPQ?.avg_voltage_unbalance
          ? Math.max(0, 100 - latestPQ.avg_voltage_unbalance * 10)
          : 100;

        const frequencyStability = latestPQ?.avg_frequency
          ? latestPQ.avg_frequency >= 49.5 && latestPQ.avg_frequency <= 50.5
            ? 100
            : 80
          : 100;

        // Get active faults
        const activeFaults = await database.queryOne<any>(
          `SELECT 
            COUNT(*) as faults,
            SUM(CASE WHEN status = 'faulty' THEN 1 ELSE 0 END) as faulty_equipment,
            SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_equipment
           FROM equipment 
           WHERE status IN ('faulty', 'maintenance')`
        );

        // Determine system status
        let systemStatus = "normal";
        const totalFaults = activeFaults?.faults || 0;
        const powerFactor = latestPQ?.avg_power_factor || 1;

        if (totalFaults > 10 || powerFactor < 0.8 || voltageStability < 80) {
          systemStatus = "critical";
        } else if (
          totalFaults > 5 ||
          powerFactor < 0.85 ||
          voltageStability < 90
        ) {
          systemStatus = "warning";
        } else if (totalFaults > 0 || powerFactor < 0.9) {
          systemStatus = "caution";
        }

        const metrics: RealTimeMetrics = {
          currentPowerConsumption: latestPower?.current_power || 0,
          averagePowerFactor: latestPQ?.avg_power_factor || 0,
          voltageStability: Math.round(voltageStability),
          frequencyStability: Math.round(frequencyStability),
          activeFaults: totalFaults,
          systemStatus,
          lastUpdateTime:
            latestPower?.last_update || latestPQ?.last_pq_update || new Date(),
        };

        logger.info("Successfully retrieved real-time metrics");

        const response: ApiResponse<RealTimeMetrics> = {
          success: true,
          message: "Real-time metrics fetched successfully",
          data: metrics,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching real-time metrics:", error);
        throw new CustomError("Failed to fetch real-time metrics", 500);
      }
    }
  );

  public getEnergySummary = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting energy summary");

      try {
        const [currentPeriodStats, previousPeriodStats, buildingComparison] =
          await Promise.all([
            // Current period (last 30 days)
            database.queryOne<any>(
              `SELECT 
              SUM(consumption_kwh) as total_consumption,
              AVG(consumption_kwh) as average_consumption,
              MAX(demand_kw) as peak_demand,
              SUM(cost_php) as total_cost,
              AVG(power_factor) as average_power_factor,
              COUNT(DISTINCT building_id) as buildings_monitored,
              MIN(recorded_at) as period_start,
              MAX(recorded_at) as period_end
            FROM energy_consumption 
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
            ),

            // Previous period (30-60 days ago)
            database.queryOne<any>(
              `SELECT 
              SUM(consumption_kwh) as total_consumption,
              AVG(consumption_kwh) as average_consumption,
              SUM(cost_php) as total_cost
            FROM energy_consumption 
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
            AND recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
            ),

            // Building comparison
            database.query<any>(
              `SELECT 
              b.id,
              b.name,
              b.area_sqm,
              SUM(ec.consumption_kwh) as consumption,
              SUM(ec.cost_php) as cost,
              AVG(ec.power_factor) as avg_power_factor,
              CASE 
                WHEN b.area_sqm > 0 THEN SUM(ec.consumption_kwh) / b.area_sqm 
                ELSE NULL 
              END as consumption_per_sqm
            FROM buildings b
            LEFT JOIN energy_consumption ec ON b.id = ec.building_id 
              AND ec.recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            WHERE b.status = 'active'
            GROUP BY b.id, b.name, b.area_sqm
            HAVING consumption > 0
            ORDER BY consumption DESC
            LIMIT 10`
            ),
          ]);

        // Calculate trends
        const consumptionTrend =
          currentPeriodStats?.total_consumption &&
          previousPeriodStats?.total_consumption
            ? ((currentPeriodStats.total_consumption -
                previousPeriodStats.total_consumption) /
                previousPeriodStats.total_consumption) *
              100
            : 0;

        const costTrend =
          currentPeriodStats?.total_cost && previousPeriodStats?.total_cost
            ? ((currentPeriodStats.total_cost -
                previousPeriodStats.total_cost) /
                previousPeriodStats.total_cost) *
              100
            : 0;

        const summary = {
          current_period: {
            ...currentPeriodStats,
            consumption_trend: Math.round(consumptionTrend * 100) / 100,
            cost_trend: Math.round(costTrend * 100) / 100,
          },
          previous_period: previousPeriodStats,
          building_comparison: buildingComparison,
          performance_indicators: {
            efficiency_rating: this.calculateEfficiencyRating(
              currentPeriodStats?.average_power_factor
            ),
            cost_per_kwh:
              currentPeriodStats?.total_consumption > 0
                ? currentPeriodStats.total_cost /
                  currentPeriodStats.total_consumption
                : 0,
            demand_factor:
              currentPeriodStats?.peak_demand &&
              currentPeriodStats?.average_consumption
                ? currentPeriodStats.average_consumption /
                  currentPeriodStats.peak_demand
                : 0,
          },
        };

        logger.info("Successfully retrieved energy summary");

        const response: ApiResponse<any> = {
          success: true,
          message: "Energy summary fetched successfully",
          data: summary,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching energy summary:", error);
        throw new CustomError("Failed to fetch energy summary", 500);
      }
    }
  );

  public getPowerQualitySummary = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting power quality summary");

      try {
        const [currentStats, historicalTrends, eventsSummary] =
          await Promise.all([
            // Current statistics
            database.queryOne<any>(
              `SELECT 
              AVG((voltage_l1 + voltage_l2 + voltage_l3) / 3) as average_voltage,
              AVG(thd_voltage) as average_thd_voltage,
              AVG(thd_current) as average_thd_current,
              AVG(frequency) as average_frequency,
              AVG(power_factor) as average_power_factor,
              AVG(voltage_unbalance) as average_voltage_unbalance,
              AVG(current_unbalance) as average_current_unbalance,
              COUNT(*) as total_readings,
              SUM(CASE WHEN thd_voltage > 8 OR voltage_unbalance > 3 OR power_factor < 0.85 THEN 1 ELSE 0 END) as quality_issues,
              MIN(recorded_at) as period_start,
              MAX(recorded_at) as period_end
            FROM power_quality 
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
            ),

            // Historical trends (last 7 days)
            database.query<any>(
              `SELECT 
              DATE(recorded_at) as date,
              AVG((voltage_l1 + voltage_l2 + voltage_l3) / 3) as avg_voltage,
              AVG(thd_voltage) as avg_thd_voltage,
              AVG(power_factor) as avg_power_factor,
              AVG(frequency) as avg_frequency,
              COUNT(CASE WHEN thd_voltage > 8 OR voltage_unbalance > 3 THEN 1 END) as daily_issues
            FROM power_quality 
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(recorded_at)
            ORDER BY date ASC`
            ),

            // Power quality events summary
            database.query<any>(
              `SELECT 
              'voltage_sag' as event_type,
              COUNT(*) as count
            FROM power_quality 
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND (voltage_l1 < 207 OR voltage_l2 < 207 OR voltage_l3 < 207)
            
            UNION ALL
            
            SELECT 
              'voltage_swell' as event_type,
              COUNT(*) as count
            FROM power_quality 
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND (voltage_l1 > 253 OR voltage_l2 > 253 OR voltage_l3 > 253)
            
            UNION ALL
            
            SELECT 
              'high_thd_voltage' as event_type,
              COUNT(*) as count
            FROM power_quality 
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND thd_voltage > 8
            
            UNION ALL
            
            SELECT 
              'low_power_factor' as event_type,
              COUNT(*) as count
            FROM power_quality 
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND power_factor < 0.85`
            ),
          ]);

        // Calculate quality score
        const qualityScore = this.calculatePowerQualityScore(currentStats);

        const summary = {
          current_statistics: {
            ...currentStats,
            quality_score: qualityScore,
            compliance_rate:
              currentStats?.total_readings > 0
                ? ((currentStats.total_readings - currentStats.quality_issues) /
                    currentStats.total_readings) *
                  100
                : 100,
          },
          historical_trends: historicalTrends,
          events_summary: eventsSummary,
          standards_compliance: {
            ieee_519_voltage: currentStats?.average_thd_voltage <= 8,
            ieee_519_current: currentStats?.average_thd_current <= 15,
            voltage_regulation:
              currentStats?.average_voltage >= 207 &&
              currentStats?.average_voltage <= 253,
            frequency_regulation:
              currentStats?.average_frequency >= 49.5 &&
              currentStats?.average_frequency <= 50.5,
            power_factor_target: currentStats?.average_power_factor >= 0.95,
          },
        };

        logger.info("Successfully retrieved power quality summary");

        const response: ApiResponse<any> = {
          success: true,
          message: "Power quality summary fetched successfully",
          data: summary,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching power quality summary:", error);
        throw new CustomError("Failed to fetch power quality summary", 500);
      }
    }
  );

  public getAuditSummary = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting audit summary");

      try {
        const [overallStats, recentActivity, complianceBreakdown] =
          await Promise.all([
            // Overall audit statistics
            database.queryOne<any>(
              `SELECT 
              COUNT(*) as total_audits,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_audits,
              SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_audits,
              SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_audits,
              AVG(CASE WHEN status = 'completed' THEN compliance_score ELSE NULL END) as average_compliance_score,
              SUM(CASE WHEN priority = 'critical' OR priority = 'high' THEN 1 ELSE 0 END) as high_priority_audits,
              COUNT(CASE WHEN scheduled_date < CURDATE() AND status = 'scheduled' THEN 1 END) as overdue_audits
            FROM audits 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`
            ),

            // Recent audit activity
            database.query<any>(
              `SELECT 
              a.id,
              a.title,
              a.status,
              a.priority,
              a.scheduled_date,
              a.completed_date,
              b.name as building_name,
              u.first_name,
              u.last_name
            FROM audits a
            LEFT JOIN buildings b ON a.building_id = b.id
            LEFT JOIN users u ON a.auditor_id = u.id
            WHERE a.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY a.updated_at DESC
            LIMIT 10`
            ),

            // Compliance breakdown
            database.query<any>(
              `SELECT 
              a.audit_type,
              COUNT(DISTINCT a.id) as audit_count,
              AVG(a.compliance_score) as avg_compliance_score,
              COUNT(cc.id) as total_checks,
              SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) as compliant_checks,
              SUM(CASE WHEN cc.status = 'non_compliant' AND cc.severity = 'critical' THEN 1 ELSE 0 END) as critical_issues
            FROM audits a
            LEFT JOIN compliance_checks cc ON a.id = cc.audit_id
            WHERE a.status = 'completed'
            AND a.completed_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            GROUP BY a.audit_type`
            ),
          ]);

        // Calculate performance metrics
        const completionRate =
          overallStats?.total_audits > 0
            ? (overallStats.completed_audits / overallStats.total_audits) * 100
            : 0;

        const overdueRate =
          overallStats?.scheduled_audits > 0
            ? (overallStats.overdue_audits / overallStats.scheduled_audits) *
              100
            : 0;

        const summary = {
          overview: {
            ...overallStats,
            completion_rate: Math.round(completionRate * 100) / 100,
            overdue_rate: Math.round(overdueRate * 100) / 100,
          },
          recent_activity: recentActivity,
          compliance_breakdown: complianceBreakdown,
          performance_indicators: {
            audit_efficiency:
              completionRate > 80
                ? "excellent"
                : completionRate > 60
                  ? "good"
                  : "needs_improvement",
            compliance_trend:
              overallStats?.average_compliance_score > 85
                ? "improving"
                : "stable",
            workload_status:
              overallStats?.in_progress_audits > 10 ? "high" : "normal",
          },
        };

        logger.info("Successfully retrieved audit summary");

        const response: ApiResponse<any> = {
          success: true,
          message: "Audit summary fetched successfully",
          data: summary,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching audit summary:", error);
        throw new CustomError("Failed to fetch audit summary", 500);
      }
    }
  );

  public getComplianceSummary = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting compliance summary");

      try {
        const [overallStats, standardBreakdown, recentIssues] =
          await Promise.all([
            // Overall compliance statistics
            database.queryOne<any>(
              `SELECT 
              COUNT(*) as total_checks,
              SUM(CASE WHEN status = 'compliant' THEN 1 ELSE 0 END) as compliant_checks,
              SUM(CASE WHEN status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant_checks,
              SUM(CASE WHEN severity = 'critical' AND status = 'non_compliant' THEN 1 ELSE 0 END) as critical_issues,
              SUM(CASE WHEN severity = 'high' AND status = 'non_compliant' THEN 1 ELSE 0 END) as high_issues,
              ROUND((SUM(CASE WHEN status = 'compliant' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as compliance_percentage
            FROM compliance_checks cc
            JOIN audits a ON cc.audit_id = a.id
            WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`
            ),

            // Breakdown by standard
            database.query<any>(
              `SELECT 
              cc.standard_type,
              COUNT(*) as total_checks,
              SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) as compliant,
              SUM(CASE WHEN cc.status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant,
              ROUND((SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as compliance_rate
            FROM compliance_checks cc
            JOIN audits a ON cc.audit_id = a.id
            WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            GROUP BY cc.standard_type
            ORDER BY compliance_rate ASC`
            ),

            // Recent critical issues
            database.query<any>(
              `SELECT 
              cc.id,
              cc.section_code,
              cc.check_description,
              cc.severity,
              cc.due_date,
              cc.responsible_person,
              a.title as audit_title,
              b.name as building_name,
              DATEDIFF(cc.due_date, CURDATE()) as days_until_due
            FROM compliance_checks cc
            JOIN audits a ON cc.audit_id = a.id
            JOIN buildings b ON a.building_id = b.id
            WHERE cc.status = 'non_compliant'
            AND cc.severity IN ('critical', 'high')
            ORDER BY 
              FIELD(cc.severity, 'critical', 'high'),
              cc.due_date ASC
            LIMIT 10`
            ),
          ]);

        const summary = {
          overview: overallStats,
          standard_breakdown: standardBreakdown,
          recent_critical_issues: recentIssues,
          risk_assessment: {
            overall_risk: this.calculateComplianceRisk(overallStats),
            critical_issues_trend: "stable", // Could be calculated from historical data
            improvement_areas: standardBreakdown
              .filter((s: any) => s.compliance_rate < 80)
              .map((s: any) => s.standard_type),
          },
        };

        logger.info("Successfully retrieved compliance summary");

        const response: ApiResponse<any> = {
          success: true,
          message: "Compliance summary fetched successfully",
          data: summary,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching compliance summary:", error);
        throw new CustomError("Failed to fetch compliance summary", 500);
      }
    }
  );

  public getAlerts = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      logger.info("🚀 Getting dashboard alerts");

      try {
        const alerts = await database.query<Alert>(
          `SELECT 
            a.*,
            b.name as building_name,
            e.name as equipment_name,
            TIMESTAMPDIFF(MINUTE, a.created_at, NOW()) as age_minutes
          FROM alerts a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN equipment e ON a.equipment_id = e.id
          WHERE a.status = 'active'
          ORDER BY 
            FIELD(a.severity, 'critical', 'high', 'medium', 'low'),
            a.created_at DESC
          LIMIT 20`
        );

        const enhancedAlerts = alerts.map((alert) => ({
          ...alert,
          urgency: this.calculateAlertUrgency(alert),
          category: this.categorizeAlert(alert.type),
        }));

        logger.info(`Successfully retrieved ${alerts.length} active alerts`);

        const response: ApiResponse<typeof enhancedAlerts> = {
          success: true,
          message: "Alerts fetched successfully",
          data: enhancedAlerts,
        };

        res.json(response);
      } catch (error) {
        logger.error("Error fetching alerts:", error);
        throw new CustomError("Failed to fetch alerts", 500);
      }
    }
  );

  // Private helper methods

  private async getBuildingStatistics(): Promise<any> {
    return await database.queryOne<any>(
      `SELECT 
        COUNT(*) as total_buildings,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_buildings,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_buildings,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_buildings
      FROM buildings`
    );
  }

  private async getEquipmentStatistics(): Promise<any> {
    return await database.queryOne<any>(
      `SELECT 
        COUNT(*) as total_equipment,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_equipment,
        SUM(CASE WHEN status IN ('maintenance', 'faulty') THEN 1 ELSE 0 END) as equipment_needing_maintenance,
        SUM(CASE WHEN status = 'faulty' THEN 1 ELSE 0 END) as faulty_equipment
      FROM equipment`
    );
  }

  private async getAuditStatistics(): Promise<any> {
    return await database.queryOne<any>(
      `SELECT 
        COUNT(*) as total_audits,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_audits,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_audits,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_audits,
        AVG(CASE WHEN status = 'completed' THEN compliance_score ELSE NULL END) as average_compliance_score
      FROM audits`
    );
  }

  private async getEnergyStatistics(): Promise<any> {
    return await database.queryOne<any>(
      `SELECT 
        SUM(consumption_kwh) as total_consumption,
        SUM(CASE WHEN recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN consumption_kwh ELSE 0 END) as last_month_consumption,
        SUM(CASE WHEN recorded_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN consumption_kwh ELSE 0 END) as previous_month_consumption,
        AVG(power_factor) as average_power_factor,
        MAX(demand_kw) as peak_demand
      FROM energy_consumption`
    );
  }

  private async getAlertStatistics(): Promise<any> {
    return await database.queryOne<any>(
      `SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN severity = 'critical' AND status = 'active' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN severity = 'high' AND status = 'active' THEN 1 END) as high_alerts,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts
      FROM alerts`
    );
  }

  private async getPowerQualityStatistics(): Promise<any> {
    return await database.queryOne<any>(
      `SELECT 
        COUNT(*) as total_readings,
        COUNT(CASE WHEN thd_voltage > 8 OR voltage_unbalance > 3 OR power_factor < 0.85 THEN 1 END) as pq_issues,
        AVG(power_factor) as avg_power_factor,
        AVG(thd_voltage) as avg_thd_voltage
      FROM power_quality 
      WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
  }

  private async getSystemHealthScore(): Promise<any> {
    try {
      const metrics = await Promise.all([
        this.getBuildingStatistics(),
        this.getEquipmentStatistics(),
        this.getAlertStatistics(),
        this.getEnergyStatistics(),
      ]);

      const [buildings, equipment, alerts, energy] = metrics;

      // Calculate health score based on various factors
      let score = 100;

      // Building health (20% weight)
      const buildingHealth =
        buildings?.active_buildings > 0
          ? (buildings.active_buildings / buildings.total_buildings) * 20
          : 0;

      // Equipment health (30% weight)
      const equipmentHealth =
        equipment?.total_equipment > 0
          ? ((equipment.total_equipment -
              equipment.equipment_needing_maintenance) /
              equipment.total_equipment) *
            30
          : 30;

      // Alert status (25% weight)
      const alertHealth =
        alerts?.critical_alerts > 0
          ? Math.max(0, 25 - alerts.critical_alerts * 5)
          : 25;

      // Energy efficiency (25% weight)
      const energyHealth = energy?.average_power_factor
        ? energy.average_power_factor * 25
        : 15;

      score = Math.round(
        buildingHealth + equipmentHealth + alertHealth + energyHealth
      );

      return { health_score: Math.max(0, Math.min(100, score)) };
    } catch (error) {
      logger.error("Error calculating system health score:", error);
      return { health_score: 50 };
    }
  }

  private calculateEfficiencyRating(powerFactor: number): string {
    if (!powerFactor) return "unknown";
    if (powerFactor >= 0.95) return "excellent";
    if (powerFactor >= 0.9) return "good";
    if (powerFactor >= 0.85) return "fair";
    return "poor";
  }

  private calculatePowerQualityScore(stats: any): number {
    if (!stats) return 0;

    let score = 100;

    // THD voltage impact
    if (stats.average_thd_voltage > 8) score -= 20;
    else if (stats.average_thd_voltage > 5) score -= 10;

    // Power factor impact
    if (stats.average_power_factor < 0.85) score -= 25;
    else if (stats.average_power_factor < 0.9) score -= 15;
    else if (stats.average_power_factor < 0.95) score -= 5;

    // Voltage unbalance impact
    if (stats.average_voltage_unbalance > 3) score -= 15;
    else if (stats.average_voltage_unbalance > 2) score -= 8;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateComplianceRisk(stats: any): string {
    if (!stats || !stats.total_checks) return "unknown";

    const complianceRate = stats.compliance_percentage || 0;
    const criticalIssues = stats.critical_issues || 0;

    if (criticalIssues > 0 || complianceRate < 60) return "high";
    if (complianceRate < 80) return "medium";
    return "low";
  }

  private calculateAlertUrgency(
    alert: Alert
  ): "low" | "medium" | "high" | "critical" {
    const ageMinutes = (alert as any).age_minutes || 0;

    if (alert.severity === "critical") return "critical";
    if (alert.severity === "high" && ageMinutes > 60) return "critical";
    if (alert.severity === "high") return "high";
    if (ageMinutes > 480) return "high"; // 8+ hours old
    if (ageMinutes > 120) return "medium"; // 2+ hours old
    return "low";
  }

  private categorizeAlert(type: string): string {
    const categories: Record<string, string> = {
      energy_anomaly: "Energy",
      power_quality: "Power Quality",
      equipment_failure: "Equipment",
      compliance_violation: "Compliance",
      maintenance_due: "Maintenance",
      threshold_exceeded: "Monitoring",
      efficiency_degradation: "Performance",
    };

    return categories[type] || "System";
  }
}

export default new DashboardController();
