import { Request, Response } from "express";
import { ApiResponse } from "@/interfaces/IResponse";
import { database } from "@/config/database";
import { logger } from "@/utils/logger";
import { asyncHandler, CustomError } from "@/middleware/errorHandler";

interface DashboardOverview {
  timestamp: string;
  system_health: {
    overall_score: number;
    status: "excellent" | "good" | "fair" | "poor" | "critical";
    uptime_percentage: number;
    data_quality_score: number;
  };
  building_portfolio: {
    total_buildings: number;
    active_buildings: number;
    buildings_in_maintenance: number;
    total_area_sqm: number;
    average_efficiency_score: number;
  };
  energy_performance: {
    total_consumption_today_kwh: number;
    total_consumption_month_kwh: number;
    monthly_cost_php: number;
    efficiency_vs_baseline: number;
    carbon_footprint_kg_co2: number;
    renewable_energy_percentage: number;
  };
  alerts_summary: {
    active_critical: number;
    active_high: number;
    active_medium: number;
    active_low: number;
    total_active: number;
    average_response_time_minutes: number;
    resolution_rate_24h: number;
  };
  equipment_status: {
    total_equipment: number;
    operational: number;
    maintenance_required: number;
    offline: number;
    average_condition_score: number;
  };
  compliance_status: {
    overall_compliance_score: number;
    ieee519_compliance: number;
    pec2017_compliance: number;
    oshs_compliance: number;
    ra11285_compliance: number;
    upcoming_audits: number;
  };
  cost_optimization: {
    identified_savings_php: number;
    implemented_savings_php: number;
    potential_monthly_savings: number;
    roi_percentage: number;
  };
}

interface RealTimeMetrics {
  timestamp: string;
  current_energy: {
    total_demand_kw: number;
    total_consumption_today_kwh: number;
    average_power_factor: number;
  };
  building_status: {
    building_id: number;
    name: string;
    current_demand_kw: number;
    status: string;
    alert_count: number;
  }[];
  active_alerts: {
    id: number;
    severity: string;
    title: string;
    age_minutes: number;
  }[];
}

interface Alert {
  id: number;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: string;
  title: string;
  message: string;
  description?: string;
  building_id?: number;
  building_name?: string;
  equipment_id?: number;
  equipment_name?: string;
  detected_value?: number;
  threshold_value?: number;
  unit?: string;
  urgency: string;
  estimated_cost_impact?: number;
  estimated_downtime_hours?: number;
  age_minutes?: number;
  created_at: string;
  updated_at?: string;
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
        let efficiencyVsBaseline = 0;
        if (previousMonth > 0) {
          efficiencyVsBaseline =
            ((currentMonth - previousMonth) / previousMonth) * 100;
        }

        // Calculate system status
        const healthScore = systemHealth?.health_score || 0;
        let systemStatus: "excellent" | "good" | "fair" | "poor" | "critical" =
          "good";
        if (healthScore >= 95) systemStatus = "excellent";
        else if (healthScore >= 85) systemStatus = "good";
        else if (healthScore >= 70) systemStatus = "fair";
        else if (healthScore >= 50) systemStatus = "poor";
        else systemStatus = "critical";

        const overview: DashboardOverview = {
          timestamp: new Date().toISOString(),
          system_health: {
            overall_score: healthScore,
            status: systemStatus,
            uptime_percentage: 99.5, // Could be calculated from system metrics
            data_quality_score: 95.0, // Could be calculated from data validation
          },
          building_portfolio: {
            total_buildings: buildingStats?.total_buildings || 0,
            active_buildings: buildingStats?.active_buildings || 0,
            buildings_in_maintenance: buildingStats?.maintenance_buildings || 0,
            total_area_sqm: buildingStats?.total_area || 0,
            average_efficiency_score: buildingStats?.avg_efficiency || 0,
          },
          energy_performance: {
            total_consumption_today_kwh: energyStats?.today_consumption || 0,
            total_consumption_month_kwh: currentMonth,
            monthly_cost_php: energyStats?.monthly_cost || 0,
            efficiency_vs_baseline: efficiencyVsBaseline,
            carbon_footprint_kg_co2: currentMonth * 0.708 || 0, // Standard conversion factor
            renewable_energy_percentage: 0, // Could be calculated if renewable data is available
          },
          alerts_summary: {
            active_critical: alertStats?.critical_alerts || 0,
            active_high: alertStats?.high_alerts || 0,
            active_medium: alertStats?.medium_alerts || 0,
            active_low: alertStats?.low_alerts || 0,
            total_active: alertStats?.active_alerts || 0,
            average_response_time_minutes: alertStats?.avg_response_time || 0,
            resolution_rate_24h: alertStats?.resolution_rate || 0,
          },
          equipment_status: {
            total_equipment: equipmentStats?.total_equipment || 0,
            operational: equipmentStats?.operational_equipment || 0,
            maintenance_required:
              equipmentStats?.equipment_needing_maintenance || 0,
            offline: equipmentStats?.offline_equipment || 0,
            average_condition_score: equipmentStats?.avg_condition_score || 0,
          },
          compliance_status: {
            overall_compliance_score: auditStats?.average_compliance_score || 0,
            ieee519_compliance: powerQualityStats?.ieee519_compliance || 0,
            pec2017_compliance: 85.0, // Would need specific compliance data
            oshs_compliance: 90.0, // Would need specific compliance data
            ra11285_compliance: 78.0, // Would need specific compliance data
            upcoming_audits: auditStats?.scheduled_audits || 0,
          },
          cost_optimization: {
            identified_savings_php: 0, // Would come from analytics
            implemented_savings_php: 0, // Would come from analytics
            potential_monthly_savings: 0, // Would come from analytics
            roi_percentage: 0, // Would come from analytics
          },
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
            SUM(consumption_kwh) as today_consumption,
            AVG(power_factor) as avg_power_factor,
            MAX(recorded_at) as last_update
           FROM energy_consumption ec
           WHERE DATE(ec.recorded_at) = CURDATE()
           AND ec.recorded_at = (
             SELECT MAX(recorded_at) 
             FROM energy_consumption ec2
             WHERE ec2.building_id = ec.building_id
             AND DATE(ec2.recorded_at) = CURDATE()
           )`
        );

        // Get building status
        const buildingStatus = await database.query<any>(
          `SELECT 
            b.id as building_id,
            b.name,
            COALESCE(ec.demand_kw, 0) as current_demand_kw,
            CASE 
              WHEN b.status = 'active' THEN 'normal'
              WHEN b.status = 'maintenance' THEN 'warning'
              ELSE 'critical'
            END as status,
            COALESCE(alert_counts.alert_count, 0) as alert_count
           FROM buildings b
           LEFT JOIN (
             SELECT building_id, MAX(demand_kw) as demand_kw
             FROM energy_consumption 
             WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
             GROUP BY building_id
           ) ec ON b.id = ec.building_id
           LEFT JOIN (
             SELECT building_id, COUNT(*) as alert_count
             FROM alerts 
             WHERE status = 'active'
             GROUP BY building_id
           ) alert_counts ON b.id = alert_counts.building_id
           WHERE b.status = 'active'
           LIMIT 10`
        );

        // Get active alerts
        const activeAlerts = await database.query<any>(
          `SELECT 
            id,
            severity,
            title,
            TIMESTAMPDIFF(MINUTE, created_at, NOW()) as age_minutes
           FROM alerts 
           WHERE status = 'active'
           ORDER BY 
             FIELD(severity, 'critical', 'high', 'medium', 'low'),
             created_at DESC
           LIMIT 10`
        );

        const metrics: RealTimeMetrics = {
          timestamp: new Date().toISOString(),
          current_energy: {
            total_demand_kw: latestPower?.current_power || 0,
            total_consumption_today_kwh: latestPower?.today_consumption || 0,
            average_power_factor: latestPower?.avg_power_factor || 0.95,
          },
          building_status: buildingStatus || [],
          active_alerts: activeAlerts || [],
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
        const [currentPeriodStats, previousPeriodStats, buildingRankings] =
          await Promise.all([
            // Current period (last 30 days)
            database.queryOne<any>(
              `SELECT 
              SUM(consumption_kwh) as consumption,
              SUM(cost_php) as cost,
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
              SUM(consumption_kwh) as consumption,
              SUM(cost_php) as cost,
              AVG(power_factor) as average_power_factor
            FROM energy_consumption 
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
            AND recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
            ),

            // Building rankings - Fixed: changed b.building_code to b.code
            database.query<any>(
              `SELECT 
              b.id as building_id,
              b.name as building_name,
              b.code as building_code,
              SUM(ec.consumption_kwh) as consumption,
              CASE 
                WHEN b.area_sqm > 0 THEN SUM(ec.consumption_kwh) / b.area_sqm 
                ELSE NULL 
              END as consumption_per_sqm,
              AVG(CASE WHEN ec.consumption_kwh > 0 THEN 
                CASE 
                  WHEN ec.power_factor >= 0.95 THEN 100
                  WHEN ec.power_factor >= 0.90 THEN 85
                  WHEN ec.power_factor >= 0.85 THEN 70
                  ELSE 50
                END
                ELSE 0
              END) as efficiency_rank,
              CASE WHEN SUM(ec.consumption_kwh) > 0 THEN
                LEAST(100, GREATEST(0, 100 - ((SUM(ec.consumption_kwh) / b.area_sqm) * 0.1)))
                ELSE 0
              END as improvement_potential
            FROM buildings b
            LEFT JOIN energy_consumption ec ON b.id = ec.building_id 
              AND ec.recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            WHERE b.status = 'active'
            GROUP BY b.id, b.name, b.code, b.area_sqm
            HAVING consumption > 0
            ORDER BY consumption_per_sqm ASC
            LIMIT 10`
            ),
          ]);

        // Calculate trends
        const consumptionChange =
          currentPeriodStats?.consumption && previousPeriodStats?.consumption
            ? ((currentPeriodStats.consumption -
                previousPeriodStats.consumption) /
                previousPeriodStats.consumption) *
              100
            : 0;

        const costChange =
          currentPeriodStats?.cost && previousPeriodStats?.cost
            ? ((currentPeriodStats.cost - previousPeriodStats.cost) /
                previousPeriodStats.cost) *
              100
            : 0;

        // Determine trend direction
        let trend: "increasing" | "decreasing" | "stable" = "stable";
        if (Math.abs(consumptionChange) < 2) trend = "stable";
        else if (consumptionChange > 0) trend = "increasing";
        else trend = "decreasing";

        // Generate trends data (mock for now - would be actual historical data)
        const trends = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          trends.push({
            date: date.toISOString().split("T")[0],
            consumption: Math.round(1000 + Math.random() * 500),
            cost: Math.round(50000 + Math.random() * 25000),
          });
        }

        const summary = {
          period_consumption: {
            current_period: currentPeriodStats?.consumption || 0,
            previous_period: previousPeriodStats?.consumption || 0,
            change_percentage: Math.round(consumptionChange * 100) / 100,
            trend,
          },
          cost_analysis: {
            current_cost: currentPeriodStats?.cost || 0,
            previous_cost: previousPeriodStats?.cost || 0,
            potential_savings: Math.round(
              (currentPeriodStats?.cost || 0) * 0.1
            ), // 10% potential savings
            cost_per_kwh:
              currentPeriodStats?.consumption > 0
                ? currentPeriodStats.cost / currentPeriodStats.consumption
                : 0,
          },
          efficiency_metrics: {
            overall_efficiency_score: Math.round(
              (currentPeriodStats?.average_power_factor || 0.9) * 100
            ),
            power_factor_average: currentPeriodStats?.average_power_factor || 0,
            demand_factor: 0.75, // Would be calculated from actual demand data
          },
          building_rankings: buildingRankings || [],
          trends,
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
        const [currentStats, recentEvents, trends] = await Promise.all([
          // Current statistics
          database.queryOne<any>(
            `SELECT 
            AVG((voltage_l1 + voltage_l2 + voltage_l3) / 3) as average_voltage,
            AVG(thd_voltage) as average_thd_voltage,
            AVG(thd_current) as average_thd_current,
            AVG(frequency) as average_frequency,
            AVG(power_factor) as average_power_factor,
            AVG(voltage_unbalance) as voltage_stability,
            AVG(frequency) as frequency_stability,
            COUNT(*) as total_readings,
            SUM(CASE WHEN thd_voltage > 8 OR voltage_unbalance > 3 OR power_factor < 0.85 THEN 1 ELSE 0 END) as violations_count
          FROM power_quality 
          WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
          ),

          // Recent events - using actual power quality readings as events
          database.query<any>(
            `SELECT 
            'voltage_sag' as type,
            recorded_at as timestamp,
            building_id,
            'medium' as severity
          FROM power_quality 
          WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND (voltage_l1 < 207 OR voltage_l2 < 207 OR voltage_l3 < 207)
          
          UNION ALL
          
          SELECT 
            'high_thd_voltage' as type,
            recorded_at as timestamp,
            building_id,
            CASE WHEN thd_voltage > 12 THEN 'high' ELSE 'medium' END as severity
          FROM power_quality 
          WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND thd_voltage > 8
          
          ORDER BY timestamp DESC
          LIMIT 10`
          ),

          // Trends (last 7 days)
          database.query<any>(
            `SELECT 
            DATE(recorded_at) as date,
            AVG((voltage_l1 + voltage_l2 + voltage_l3) / 3) as avg_voltage,
            AVG(thd_voltage) as avg_thd_voltage,
            AVG(power_factor) as avg_power_factor,
            AVG(frequency) as avg_frequency,
            COUNT(CASE WHEN thd_voltage > 8 OR voltage_unbalance > 3 THEN 1 END) as violations
          FROM power_quality 
          WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY DATE(recorded_at)
          ORDER BY date ASC`
          ),
        ]);

        // Calculate compliance rates
        const ieee519ComplianceRate =
          currentStats?.total_readings > 0
            ? ((currentStats.total_readings - currentStats.violations_count) /
                currentStats.total_readings) *
              100
            : 100;

        const iticComplianceRate = 88.7; // Would be calculated from actual ITIC curve analysis

        // Calculate overall quality score
        let qualityScore = 100;
        if (currentStats?.average_thd_voltage > 8) qualityScore -= 20;
        if (currentStats?.average_power_factor < 0.9) qualityScore -= 15;
        if (currentStats?.voltage_stability < 95) qualityScore -= 10;

        // Generate trend data with quality scores
        const trendsWithScores = (trends || []).map((trend: any) => ({
          date: trend.date,
          quality_score: Math.max(50, 100 - trend.violations * 5),
          violations: trend.violations,
        }));

        const summary = {
          overall_score: Math.max(0, qualityScore),
          compliance_status: {
            ieee519_compliance_rate:
              Math.round(ieee519ComplianceRate * 100) / 100,
            itic_compliance_rate: iticComplianceRate,
            violations_last_24h: currentStats?.violations_count || 0,
          },
          quality_metrics: {
            average_thd_voltage: currentStats?.average_thd_voltage || 0,
            average_thd_current: currentStats?.average_thd_current || 0,
            voltage_stability: currentStats?.voltage_stability || 100,
            frequency_stability: currentStats?.frequency_stability || 50,
          },
          recent_events: recentEvents || [],
          trends: trendsWithScores,
          improvement_recommendations:
            this.getPowerQualityRecommendations(currentStats),
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
        const [
          completionMetrics,
          recentActivities,
          performanceIndicators,
          upcomingAudits,
        ] = await Promise.all([
          // Completion metrics
          database.queryOne<any>(
            `SELECT 
              COUNT(*) as total_audits,
              SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_audits,
              SUM(CASE WHEN a.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_audits,
              ROUND((SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as completion_rate
            FROM audits a
            WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`
          ),

          // Recent activities
          database.query<any>(
            `SELECT 
              a.id,
              a.title,
              a.status,
              COALESCE(a.compliance_score, 0) as completion_percentage,
              CASE 
                WHEN a.status = 'completed' THEN 'normal'
                WHEN a.status = 'in_progress' THEN 'high'
                ELSE 'medium'
              END as priority
            FROM audits a
            WHERE a.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ORDER BY a.updated_at DESC
            LIMIT 5`
          ),

          // Performance indicators
          database.queryOne<any>(
            `SELECT 
              AVG(CASE WHEN a.status = 'completed' AND a.scheduled_date IS NOT NULL AND a.completed_date IS NOT NULL 
                THEN DATEDIFF(a.completed_date, a.scheduled_date) ELSE NULL END) as average_audit_duration,
              AVG(CASE WHEN a.status = 'completed' THEN a.compliance_score ELSE NULL END) as efficiency_improvement_rate,
              COUNT(CASE WHEN a.status = 'completed' THEN 1 END) / COUNT(*) * 100 as issues_resolution_rate
            FROM audits a
            WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`
          ),

          // Upcoming audits
          database.query<any>(
            `SELECT 
              a.id,
              a.title,
              a.scheduled_date,
              b.name as building_name
            FROM audits a
            LEFT JOIN buildings b ON a.building_id = b.id
            WHERE a.status = 'scheduled'
            AND a.scheduled_date >= CURDATE()
            ORDER BY a.scheduled_date ASC
            LIMIT 5`
          ),
        ]);

        // Calculate compliance overview
        const complianceOverview = await database.queryOne<any>(
          `SELECT 
          AVG(CASE WHEN a.status = 'completed' THEN a.compliance_score ELSE NULL END) as average_compliance_score,
          COUNT(CASE WHEN a.status = 'completed' AND a.compliance_score >= 90 THEN 1 END) as fully_compliant_audits,
          COUNT(CASE WHEN a.status = 'completed' AND a.compliance_score < 60 THEN 1 END) as audits_with_critical_issues
        FROM audits a
        WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`
        );

        const summary = {
          completion_metrics: {
            total_audits: completionMetrics?.total_audits || 0,
            completed_audits: completionMetrics?.completed_audits || 0,
            in_progress_audits: completionMetrics?.in_progress_audits || 0,
            completion_rate: completionMetrics?.completion_rate || 0,
          },
          compliance_overview: {
            average_compliance_score:
              complianceOverview?.average_compliance_score || 0,
            fully_compliant_audits:
              complianceOverview?.fully_compliant_audits || 0,
            audits_with_critical_issues:
              complianceOverview?.audits_with_critical_issues || 0,
          },
          recent_activities: recentActivities || [],
          performance_indicators: {
            average_audit_duration:
              performanceIndicators?.average_audit_duration || 0,
            efficiency_improvement_rate:
              performanceIndicators?.efficiency_improvement_rate || 0,
            issues_resolution_rate:
              performanceIndicators?.issues_resolution_rate || 0,
          },
          upcoming_audits: upcomingAudits || [],
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
            // Overall compliance statistics - Fixed ambiguous column references
            database.queryOne<any>(
              `SELECT 
            COUNT(*) as total_checks,
            SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) as compliant_checks,
            SUM(CASE WHEN cc.status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant_checks,
            SUM(CASE WHEN cc.severity = 'critical' AND cc.status = 'non_compliant' THEN 1 ELSE 0 END) as critical_violations,
            SUM(CASE WHEN cc.severity = 'high' AND cc.status = 'non_compliant' THEN 1 ELSE 0 END) as high_violations,
            ROUND((SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as compliance_percentage,
            CASE 
              WHEN SUM(CASE WHEN cc.severity = 'critical' AND cc.status = 'non_compliant' THEN 1 ELSE 0 END) > 0 THEN 'high'
              WHEN ROUND((SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) < 80 THEN 'medium'
              ELSE 'low'
            END as risk_level
          FROM compliance_checks cc
          JOIN audits a ON cc.audit_id = a.id
          WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`
            ),

            // Breakdown by standard - Fixed ambiguous column references
            database.query<any>(
              `SELECT 
            cc.standard_type as standard,
            COUNT(*) as total_checks,
            SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) as compliant,
            SUM(CASE WHEN cc.status = 'non_compliant' THEN 1 ELSE 0 END) as violations,
            ROUND((SUM(CASE WHEN cc.status = 'compliant' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as compliance_rate,
            MAX(a.completed_date) as last_assessment
          FROM compliance_checks cc
          JOIN audits a ON cc.audit_id = a.id
          WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
          AND cc.standard_type IS NOT NULL
          GROUP BY cc.standard_type
          ORDER BY compliance_rate ASC`
            ),

            // Recent critical issues - Fixed ambiguous column references
            database.query<any>(
              `SELECT 
            cc.id,
            cc.check_description as description,
            cc.severity,
            cc.due_date,
            b.name as building_name,
            DATEDIFF(cc.due_date, CURDATE()) as days_until_due
          FROM compliance_checks cc
          JOIN audits a ON cc.audit_id = a.id
          JOIN buildings b ON a.building_id = b.id
          WHERE cc.status = 'non_compliant'
          AND cc.severity IN ('critical', 'high')
          AND cc.due_date IS NOT NULL
          ORDER BY 
            FIELD(cc.severity, 'critical', 'high'),
            cc.due_date ASC
          LIMIT 5`
            ),
          ]);

        // Calculate improvement areas
        const improvementAreas = (standardBreakdown || [])
          .filter((s: any) => s.compliance_rate < 80)
          .map((s: any) => ({
            area: s.standard,
            priority: s.compliance_rate < 60 ? "high" : "medium",
            estimated_cost: Math.round(10000 + Math.random() * 50000), // Mock data
            impact: "Regulatory compliance and operational efficiency",
          }));

        const summary = {
          overall_status: {
            compliance_percentage: overallStats?.compliance_percentage || 0,
            risk_level: overallStats?.risk_level || "unknown",
            total_violations: overallStats?.non_compliant_checks || 0,
            critical_violations: overallStats?.critical_violations || 0,
          },
          by_standard: standardBreakdown || [],
          recent_issues: recentIssues || [],
          improvement_areas: improvementAreas,
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
        const { severity, limit = 10 } = req.query;

        let whereClause = "WHERE a.status = 'active'";
        if (severity) {
          whereClause += ` AND a.severity = '${severity}'`;
        }

        // Fixed: Removed a.priority column that doesn't exist in schema
        const alerts = await database.query<Alert>(
          `SELECT 
            a.id,
            a.type,
            a.severity,
            a.status,
            a.title,
            a.message,
            a.building_id,
            a.equipment_id,
            a.detected_value,
            a.threshold_value,
            a.created_at,
            a.updated_at,
            b.name as building_name,
            e.name as equipment_name,
            TIMESTAMPDIFF(MINUTE, a.created_at, NOW()) as age_minutes
          FROM alerts a
          LEFT JOIN buildings b ON a.building_id = b.id
          LEFT JOIN equipment e ON a.equipment_id = e.id
          ${whereClause}
          ORDER BY 
            FIELD(a.severity, 'critical', 'high', 'medium', 'low'),
            a.created_at DESC
          LIMIT ${limit}`
        );

        const enhancedAlerts = alerts.map((alert) => ({
          ...alert,
          urgency: this.calculateAlertUrgency(alert),
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
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_buildings,
        SUM(area_sqm) as total_area,
        AVG(CASE WHEN status = 'active' THEN 85 ELSE 60 END) as avg_efficiency
      FROM buildings`
    );
  }

  private async getEquipmentStatistics(): Promise<any> {
    // Fixed: Changed 'operational' to 'active' and 'offline' to 'inactive' to match schema
    return await database.queryOne<any>(
      `SELECT 
        COUNT(*) as total_equipment,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as operational_equipment,
        SUM(CASE WHEN status IN ('maintenance', 'faulty', 'inactive') THEN 1 ELSE 0 END) as equipment_needing_maintenance,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as offline_equipment,
        AVG(CASE 
          WHEN status = 'active' THEN 90
          WHEN status = 'maintenance' THEN 70
          WHEN status = 'faulty' THEN 40
          WHEN status = 'inactive' THEN 30
          ELSE 50
        END) as avg_condition_score
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
        SUM(CASE WHEN DATE(recorded_at) = CURDATE() THEN consumption_kwh ELSE 0 END) as today_consumption,
        SUM(CASE WHEN recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN consumption_kwh ELSE 0 END) as last_month_consumption,
        SUM(CASE WHEN recorded_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN consumption_kwh ELSE 0 END) as previous_month_consumption,
        SUM(CASE WHEN recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN cost_php ELSE 0 END) as monthly_cost,
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
        COUNT(CASE WHEN severity = 'medium' AND status = 'active' THEN 1 END) as medium_alerts,
        COUNT(CASE WHEN severity = 'low' AND status = 'active' THEN 1 END) as low_alerts,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts,
        AVG(CASE WHEN status = 'resolved' AND acknowledged_at IS NOT NULL 
          THEN TIMESTAMPDIFF(MINUTE, created_at, acknowledged_at) ELSE NULL END) as avg_response_time,
        COUNT(CASE WHEN status = 'resolved' AND resolved_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) /
        NULLIF(COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END), 0) * 100 as resolution_rate
      FROM alerts`
    );
  }

  private async getPowerQualityStatistics(): Promise<any> {
    return await database.queryOne<any>(
      `SELECT 
        COUNT(*) as total_readings,
        COUNT(CASE WHEN thd_voltage > 8 OR voltage_unbalance > 3 OR power_factor < 0.85 THEN 1 END) as pq_issues,
        AVG(power_factor) as avg_power_factor,
        AVG(thd_voltage) as avg_thd_voltage,
        CASE WHEN COUNT(*) > 0 THEN
          (COUNT(*) - COUNT(CASE WHEN thd_voltage > 8 THEN 1 END)) / COUNT(*) * 100
          ELSE 100
        END as ieee519_compliance
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

  private getPowerQualityRecommendations(stats: any): string[] {
    const recommendations = [];

    if (stats?.average_thd_voltage > 8) {
      recommendations.push("Install harmonic filters to reduce voltage THD");
    }
    if (stats?.average_power_factor < 0.9) {
      recommendations.push("Install power factor correction capacitors");
    }
    if (stats?.voltage_stability < 95) {
      recommendations.push("Check voltage regulation and transformer taps");
    }
    if (recommendations.length === 0) {
      recommendations.push(
        "Power quality parameters are within acceptable limits"
      );
    }

    return recommendations;
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
}

export default new DashboardController();
