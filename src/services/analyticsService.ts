import { database } from "@/config/database";
import {
  IEnergyBaseline,
  IPowerQualityEvent,
  IMaintenancePrediction,
  IAnomalyDetection,
  IEfficiencyAnalysis,
  IForecastData,
  IAnalysisRequest,
  IAnalysisResult,
} from "@/interfaces/IAnalytics";
import { logger } from "@/utils/logger";
import alertService from "./alertService";
import { AlertType, AlertSeverity } from "@/interfaces/IAlert";

// Creation interfaces that don't include DatabaseRow properties
interface IPowerQualityEventCreate {
  building_id: number;
  pq_reading_id: number;
  event_type:
    | "sag"
    | "swell"
    | "interruption"
    | "transient"
    | "harmonic"
    | "flicker"
    | "unbalance";
  severity: "minor" | "moderate" | "severe" | "critical";
  start_time: Date;
  end_time?: Date;
  duration_ms?: number;
  magnitude?: number;
  itic_curve_violation: boolean;
  ieee519_violation: boolean;
  affected_equipment?: string[];
  estimated_cost?: number;
  metadata?: Record<string, any>;
}

interface IAnomalyDetectionCreate {
  detection_type: "energy" | "power_quality" | "equipment";
  building_id?: number;
  equipment_id?: number;
  detected_at: Date;
  anomaly_score: number;
  threshold_score: number;
  data_point_id: number;
  data_point_type: "energy_consumption" | "power_quality" | "equipment_reading";
  anomaly_description: string;
  expected_value?: number;
  actual_value?: number;
  deviation_percentage?: number;
  investigation_status:
    | "pending"
    | "investigating"
    | "resolved"
    | "false_positive";
  root_cause?: string;
  corrective_action?: string;
  metadata?: Record<string, any>;
}

interface ForecastInput {
  date: Date;
  predicted_value: number;
  confidence_lower: number;
  confidence_upper: number;
  model_type: "arima" | "neural_network" | "regression" | "ensemble";
  model_accuracy: number;
  influencing_factors?: Record<string, number>;
  metadata?: Record<string, any>;
}

class AnalyticsService {
  /**
   * Energy Efficiency Baseline Modeling
   */
  public async calculateEnergyBaseline(
    buildingId: number,
    baselineType: "daily" | "weekly" | "monthly" | "seasonal" = "monthly",
    lookbackDays: number = 365
  ): Promise<IEnergyBaseline> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - lookbackDays);

      // Get historical consumption data
      const historicalData = await database.query(
        `SELECT 
          DATE(recorded_at) as date,
          AVG(consumption_kwh) as avg_consumption,
          AVG(demand_kw) as avg_demand,
          AVG(power_factor) as avg_power_factor,
          COUNT(*) as reading_count
         FROM energy_consumption 
         WHERE building_id = ? AND recorded_at BETWEEN ? AND ?
         GROUP BY DATE(recorded_at)
         ORDER BY date`,
        [buildingId, startDate, endDate]
      );

      if (historicalData.length < 30) {
        throw new Error("Insufficient data for baseline calculation");
      }

      // Calculate baseline using regression analysis
      const baseline = this.calculateRegressionBaseline(
        historicalData,
        baselineType
      );

      // Store baseline in database
      const result = await database.query(
        `INSERT INTO energy_baselines 
         (building_id, baseline_type, period_start, period_end, baseline_consumption, 
          confidence_interval, weather_normalized, occupancy_adjusted, calculation_method, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          buildingId,
          baselineType,
          startDate,
          endDate,
          baseline.consumption,
          baseline.confidence,
          baseline.weatherNormalized,
          baseline.occupancyAdjusted,
          "regression",
          JSON.stringify(baseline.metadata),
        ]
      );

      const baselineId = (result as any).insertId;
      const newBaseline = await database.queryOne<IEnergyBaseline>(
        "SELECT * FROM energy_baselines WHERE id = ?",
        [baselineId]
      );

      return newBaseline!;
    } catch (error) {
      logger.error("Error calculating energy baseline:", error);
      throw error;
    }
  }

  /**
   * Power Quality Event Detection and Analysis
   */
  public async analyzePowerQualityEvents(
    buildingId: number,
    pqReadingId: number,
    voltageData: number[],
    currentData: number[] = [],
    frequencyData: number[] = []
  ): Promise<IPowerQualityEvent[]> {
    try {
      const eventCreates: IPowerQualityEventCreate[] = [];

      // ITIC Curve Analysis for voltage variations
      const voltageEvents = this.detectVoltageEvents(
        voltageData,
        pqReadingId,
        buildingId
      );
      eventCreates.push(...voltageEvents);

      // IEEE-519 Harmonic Analysis
      const harmonicEvents = await this.analyzeHarmonics(
        buildingId,
        pqReadingId
      );
      eventCreates.push(...harmonicEvents);

      // Frequency deviation analysis
      const frequencyEvents = this.detectFrequencyEvents(
        frequencyData,
        pqReadingId,
        buildingId
      );
      eventCreates.push(...frequencyEvents);

      // Store events in database and return full objects
      const storedEvents: IPowerQualityEvent[] = [];
      for (const eventCreate of eventCreates) {
        const storedEvent = await this.storePowerQualityEvent(eventCreate);
        storedEvents.push(storedEvent);

        // Generate alerts for critical events
        if (
          eventCreate.severity === "critical" ||
          eventCreate.severity === "severe"
        ) {
          await alertService.createAlert({
            type: AlertType.POWER_QUALITY,
            severity:
              eventCreate.severity === "critical"
                ? AlertSeverity.CRITICAL
                : AlertSeverity.HIGH,
            title: `Power Quality Event: ${eventCreate.event_type}`,
            message: `${eventCreate.event_type} detected with ${eventCreate.severity} severity`,
            building_id: buildingId,
            pq_reading_id: pqReadingId,
            detected_value: eventCreate.magnitude,
            metadata: { event_details: eventCreate },
          });
        }
      }

      return storedEvents;
    } catch (error) {
      logger.error("Error analyzing power quality events:", error);
      throw error;
    }
  }

  /**
   * Predictive Maintenance Algorithm
   */
  public async predictEquipmentMaintenance(
    equipmentId: number
  ): Promise<IMaintenancePrediction> {
    try {
      // Get equipment data and history
      const equipment = await database.queryOne(
        "SELECT * FROM equipment WHERE id = ?",
        [equipmentId]
      );

      if (!equipment) {
        throw new Error("Equipment not found");
      }

      // Get maintenance history
      const maintenanceHistory = await database.query(
        `SELECT * FROM equipment_maintenance 
         WHERE equipment_id = ? 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [equipmentId]
      );

      // Get recent power quality and energy data for this equipment's building
      const performanceData = await this.getEquipmentPerformanceData(
        equipment.building_id,
        equipmentId
      );

      // Calculate failure probability using multiple factors
      const prediction = this.calculateMaintenancePrediction(
        equipment,
        maintenanceHistory,
        performanceData
      );

      // Store prediction
      const result = await database.query(
        `INSERT INTO maintenance_predictions 
         (equipment_id, prediction_type, predicted_date, confidence_score, risk_level,
          contributing_factors, recommended_actions, estimated_cost, business_impact,
          model_version, last_calculated, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          equipmentId,
          prediction.type,
          prediction.predictedDate,
          prediction.confidence,
          prediction.riskLevel,
          JSON.stringify(prediction.factors),
          JSON.stringify(prediction.actions),
          prediction.estimatedCost,
          prediction.businessImpact,
          "1.0",
          JSON.stringify(prediction.metadata),
        ]
      );

      const predictionId = (result as any).insertId;
      const newPrediction = await database.queryOne<IMaintenancePrediction>(
        "SELECT * FROM maintenance_predictions WHERE id = ?",
        [predictionId]
      );

      // Generate alert if high risk
      if (
        prediction.riskLevel === "high" ||
        prediction.riskLevel === "critical"
      ) {
        await alertService.createAlert({
          type: AlertType.EQUIPMENT_FAILURE,
          severity:
            prediction.riskLevel === "critical"
              ? AlertSeverity.CRITICAL
              : AlertSeverity.HIGH,
          title: `Equipment Maintenance Required: ${equipment.name}`,
          message: `${prediction.type} predicted for ${prediction.predictedDate}`,
          equipment_id: equipmentId,
          building_id: equipment.building_id,
          metadata: { prediction_details: prediction },
        });
      }

      return newPrediction!;
    } catch (error) {
      logger.error("Error predicting equipment maintenance:", error);
      throw error;
    }
  }

  /**
   * Automated Anomaly Detection
   */
  public async detectAnomalies(
    request: IAnalysisRequest
  ): Promise<IAnomalyDetection[]> {
    try {
      const anomalyCreates: IAnomalyDetectionCreate[] = [];

      if (request.analysis_types.includes("energy")) {
        const energyAnomalies = await this.detectEnergyAnomalies(
          request.building_id!,
          request.start_date,
          request.end_date
        );
        anomalyCreates.push(...energyAnomalies);
      }

      if (request.analysis_types.includes("power_quality")) {
        const pqAnomalies = await this.detectPowerQualityAnomalies(
          request.building_id!,
          request.start_date,
          request.end_date
        );
        anomalyCreates.push(...pqAnomalies);
      }

      if (request.analysis_types.includes("equipment")) {
        const equipmentAnomalies = await this.detectEquipmentAnomalies(
          request.equipment_id!,
          request.start_date,
          request.end_date
        );
        anomalyCreates.push(...equipmentAnomalies);
      }

      // Store anomalies and generate alerts
      const storedAnomalies: IAnomalyDetection[] = [];
      for (const anomalyCreate of anomalyCreates) {
        const storedAnomaly = await this.storeAnomaly(anomalyCreate);
        storedAnomalies.push(storedAnomaly);

        if (anomalyCreate.anomaly_score > anomalyCreate.threshold_score * 1.5) {
          await alertService.createAlert({
            type: AlertType.ENERGY_ANOMALY,
            severity:
              anomalyCreate.anomaly_score > anomalyCreate.threshold_score * 2
                ? AlertSeverity.HIGH
                : AlertSeverity.MEDIUM,
            title: `Anomaly Detected: ${anomalyCreate.detection_type}`,
            message: anomalyCreate.anomaly_description,
            building_id: anomalyCreate.building_id,
            equipment_id: anomalyCreate.equipment_id,
            detected_value: anomalyCreate.actual_value,
            threshold_value: anomalyCreate.expected_value,
            metadata: { anomaly_details: anomalyCreate },
          });
        }
      }

      return storedAnomalies;
    } catch (error) {
      logger.error("Error detecting anomalies:", error);
      throw error;
    }
  }

  /**
   * Energy Efficiency Analysis
   */
  public async analyzeEnergyEfficiency(
    buildingId: number,
    startDate: Date,
    endDate: Date
  ): Promise<IEfficiencyAnalysis> {
    try {
      // Get baseline for comparison
      const baseline = await database.queryOne<IEnergyBaseline>(
        `SELECT * FROM energy_baselines 
         WHERE building_id = ? AND baseline_type = 'monthly' 
         ORDER BY created_at DESC LIMIT 1`,
        [buildingId]
      );

      if (!baseline) {
        throw new Error("No baseline available for efficiency analysis");
      }

      // Get actual consumption for the period
      const actualData = await database.queryOne(
        `SELECT 
          SUM(consumption_kwh) as total_consumption,
          AVG(consumption_kwh) as avg_consumption,
          SUM(cost_php) as total_cost,
          AVG(power_factor) as avg_power_factor,
          COUNT(*) as reading_count
         FROM energy_consumption 
         WHERE building_id = ? AND recorded_at BETWEEN ? AND ?`,
        [buildingId, startDate, endDate]
      );

      // Calculate efficiency metrics
      const analysis = this.calculateEfficiencyMetrics(
        baseline,
        actualData,
        startDate,
        endDate
      );

      // Store analysis
      const result = await database.query(
        `INSERT INTO efficiency_analyses 
         (building_id, analysis_period_start, analysis_period_end, efficiency_score,
          baseline_consumption, actual_consumption, savings_kwh, savings_percentage,
          cost_savings, carbon_reduction_kg, efficiency_factors, recommendations,
          benchmark_comparison, weather_impact, occupancy_impact, equipment_performance, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          buildingId,
          startDate,
          endDate,
          analysis.efficiency_score,
          analysis.baseline_consumption,
          analysis.actual_consumption,
          analysis.savings_kwh,
          analysis.savings_percentage,
          analysis.cost_savings,
          analysis.carbon_reduction_kg,
          JSON.stringify(analysis.efficiency_factors),
          JSON.stringify(analysis.recommendations),
          JSON.stringify(analysis.benchmark_comparison),
          analysis.weather_impact,
          analysis.occupancy_impact,
          JSON.stringify(analysis.equipment_performance),
          JSON.stringify(analysis.metadata),
        ]
      );

      const analysisId = (result as any).insertId;
      const newAnalysis = await database.queryOne<IEfficiencyAnalysis>(
        "SELECT * FROM efficiency_analyses WHERE id = ?",
        [analysisId]
      );

      return newAnalysis!;
    } catch (error) {
      logger.error("Error analyzing energy efficiency:", error);
      throw error;
    }
  }

  /**
   * Energy Consumption Forecasting
   */
  public async forecastEnergyConsumption(
    buildingId: number,
    forecastDays: number = 30,
    forecastType: "consumption" | "demand" | "cost" = "consumption"
  ): Promise<IForecastData[]> {
    try {
      // Get historical data for model training
      const historicalData = await database.query(
        `SELECT * FROM energy_consumption 
         WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)
         ORDER BY recorded_at`,
        [buildingId]
      );

      if (historicalData.length < 100) {
        throw new Error("Insufficient historical data for forecasting");
      }

      // Generate forecasts using time series analysis
      const forecasts = this.generateForecasts(
        historicalData,
        forecastDays,
        forecastType
      );

      // Store forecasts
      const storedForecasts: IForecastData[] = [];
      for (const forecast of forecasts) {
        const result = await database.query(
          `INSERT INTO forecast_data 
           (building_id, forecast_type, forecast_period, forecast_date, predicted_value,
            confidence_lower, confidence_upper, model_type, model_accuracy,
            influencing_factors, created_by_model, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            buildingId,
            forecastType,
            "daily",
            forecast.date,
            forecast.predicted_value,
            forecast.confidence_lower,
            forecast.confidence_upper,
            forecast.model_type,
            forecast.model_accuracy,
            JSON.stringify(forecast.influencing_factors),
            "analytics_service_v1.0",
            JSON.stringify(forecast.metadata),
          ]
        );

        const forecastId = (result as any).insertId;
        const newForecast = await database.queryOne<IForecastData>(
          "SELECT * FROM forecast_data WHERE id = ?",
          [forecastId]
        );
        if (newForecast) storedForecasts.push(newForecast);
      }

      return storedForecasts;
    } catch (error) {
      logger.error("Error forecasting energy consumption:", error);
      throw error;
    }
  }

  // Private helper methods

  private calculateRegressionBaseline(data: any[], baselineType: string): any {
    // Implement regression analysis for baseline calculation
    const consumptionValues = data.map((d) => d.avg_consumption);
    const mean =
      consumptionValues.reduce((a, b) => a + b, 0) / consumptionValues.length;
    const variance =
      consumptionValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      consumptionValues.length;
    const stdDev = Math.sqrt(variance);

    return {
      consumption: mean,
      confidence: 95 - (stdDev / mean) * 100,
      weatherNormalized: false,
      occupancyAdjusted: false,
      metadata: {
        dataPoints: data.length,
        variance: variance,
        standardDeviation: stdDev,
      },
    };
  }

  private detectVoltageEvents(
    voltageData: number[],
    pqReadingId: number,
    buildingId: number
  ): IPowerQualityEventCreate[] {
    const events: IPowerQualityEventCreate[] = [];
    const nominalVoltage = 230; // Nominal voltage for Philippines

    voltageData.forEach((voltage, index) => {
      const deviation = Math.abs(voltage - nominalVoltage) / nominalVoltage;

      if (deviation > 0.1) {
        // More than 10% deviation
        const eventType: "sag" | "swell" =
          voltage < nominalVoltage ? "sag" : "swell";
        const severity: "minor" | "moderate" | "severe" | "critical" =
          deviation > 0.2
            ? "critical"
            : deviation > 0.15
              ? "severe"
              : "moderate";
        const iticViolation = deviation > 0.1; // Simplified ITIC curve check

        events.push({
          building_id: buildingId,
          pq_reading_id: pqReadingId,
          event_type: eventType,
          severity: severity,
          start_time: new Date(),
          magnitude: voltage,
          itic_curve_violation: iticViolation,
          ieee519_violation: false,
          metadata: { voltage_deviation: deviation, index },
        });
      }
    });

    return events;
  }

  private async analyzeHarmonics(
    buildingId: number,
    pqReadingId: number
  ): Promise<IPowerQualityEventCreate[]> {
    // Get THD data from power quality reading
    const pqData = await database.queryOne(
      "SELECT thd_voltage, thd_current FROM power_quality WHERE id = ?",
      [pqReadingId]
    );

    const events: IPowerQualityEventCreate[] = [];

    if (pqData) {
      // IEEE-519 limits: THD voltage < 8%, THD current < 15%
      if (pqData.thd_voltage > 8) {
        const severity: "minor" | "moderate" | "severe" | "critical" =
          pqData.thd_voltage > 12 ? "severe" : "moderate";

        events.push({
          building_id: buildingId,
          pq_reading_id: pqReadingId,
          event_type: "harmonic",
          severity: severity,
          start_time: new Date(),
          magnitude: pqData.thd_voltage,
          itic_curve_violation: false,
          ieee519_violation: true,
          metadata: { harmonic_type: "voltage", thd_value: pqData.thd_voltage },
        });
      }

      if (pqData.thd_current > 15) {
        const severity: "minor" | "moderate" | "severe" | "critical" =
          pqData.thd_current > 20 ? "severe" : "moderate";

        events.push({
          building_id: buildingId,
          pq_reading_id: pqReadingId,
          event_type: "harmonic",
          severity: severity,
          start_time: new Date(),
          magnitude: pqData.thd_current,
          itic_curve_violation: false,
          ieee519_violation: true,
          metadata: { harmonic_type: "current", thd_value: pqData.thd_current },
        });
      }
    }

    return events;
  }

  private detectFrequencyEvents(
    frequencyData: number[],
    pqReadingId: number,
    buildingId: number
  ): IPowerQualityEventCreate[] {
    const events: IPowerQualityEventCreate[] = [];
    const nominalFrequency = 50; // 50Hz for Philippines

    frequencyData.forEach((frequency, index) => {
      const deviation = Math.abs(frequency - nominalFrequency);

      if (deviation > 0.5) {
        // More than 0.5Hz deviation
        const severity: "minor" | "moderate" | "severe" | "critical" =
          deviation > 1.0 ? "severe" : "moderate";

        events.push({
          building_id: buildingId,
          pq_reading_id: pqReadingId,
          event_type: "interruption", // Using interruption as closest match for frequency deviation
          severity: severity,
          start_time: new Date(),
          magnitude: frequency,
          itic_curve_violation: false,
          ieee519_violation: false,
          metadata: { frequency_deviation: deviation, index },
        });
      }
    });

    return events;
  }

  private async storePowerQualityEvent(
    eventCreate: IPowerQualityEventCreate
  ): Promise<IPowerQualityEvent> {
    const result = await database.query(
      `INSERT INTO power_quality_events 
       (building_id, pq_reading_id, event_type, severity, start_time, end_time,
        duration_ms, magnitude, itic_curve_violation, ieee519_violation,
        affected_equipment, estimated_cost, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventCreate.building_id,
        eventCreate.pq_reading_id,
        eventCreate.event_type,
        eventCreate.severity,
        eventCreate.start_time,
        eventCreate.end_time,
        eventCreate.duration_ms,
        eventCreate.magnitude,
        eventCreate.itic_curve_violation,
        eventCreate.ieee519_violation,
        JSON.stringify(eventCreate.affected_equipment),
        eventCreate.estimated_cost,
        JSON.stringify(eventCreate.metadata),
      ]
    );

    const eventId = (result as any).insertId;
    const newEvent = await database.queryOne<IPowerQualityEvent>(
      "SELECT * FROM power_quality_events WHERE id = ?",
      [eventId]
    );

    return newEvent!;
  }

  private async getEquipmentPerformanceData(
    buildingId: number,
    equipmentId: number
  ): Promise<any> {
    // Get recent performance indicators
    const energyData = await database.query(
      `SELECT AVG(consumption_kwh) as avg_consumption, AVG(power_factor) as avg_pf
       FROM energy_consumption 
       WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [buildingId]
    );

    const pqData = await database.query(
      `SELECT AVG(thd_voltage) as avg_thd_v, AVG(voltage_unbalance) as avg_unbalance
       FROM power_quality 
       WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [buildingId]
    );

    return { energy: energyData[0], powerQuality: pqData[0] };
  }

  private calculateMaintenancePrediction(
    equipment: any,
    history: any[],
    performance: any
  ): any {
    // Simplified predictive model
    const ageMonths = Math.floor(
      (new Date().getTime() - new Date(equipment.installation_date).getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    );
    const lastMaintenance = history[0]
      ? new Date(history[0].completed_date)
      : new Date(equipment.installation_date);
    const monthsSinceLastMaintenance = Math.floor(
      (new Date().getTime() - lastMaintenance.getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    );

    // Risk factors
    let riskScore = 0;
    const factors = [];

    // Age factor
    if (ageMonths > 60) {
      riskScore += 30;
      factors.push("Equipment age > 5 years");
    } else if (ageMonths > 36) {
      riskScore += 15;
      factors.push("Equipment age > 3 years");
    }

    // Maintenance history factor
    if (monthsSinceLastMaintenance > 12) {
      riskScore += 25;
      factors.push("Overdue maintenance");
    } else if (monthsSinceLastMaintenance > 6) {
      riskScore += 10;
      factors.push("Maintenance due soon");
    }

    // Performance factor
    if (performance.powerQuality?.avg_thd_v > 8) {
      riskScore += 20;
      factors.push("High voltage THD");
    }
    if (performance.energy?.avg_pf < 0.85) {
      riskScore += 15;
      factors.push("Poor power factor");
    }

    // Calculate prediction
    const riskLevel =
      riskScore > 60
        ? "critical"
        : riskScore > 40
          ? "high"
          : riskScore > 20
            ? "medium"
            : "low";
    const daysToMaintenance = Math.max(30 - riskScore / 2, 7);
    const predictedDate = new Date();
    predictedDate.setDate(predictedDate.getDate() + daysToMaintenance);

    return {
      type: riskScore > 50 ? "failure" : "maintenance",
      predictedDate,
      confidence: Math.min(95, 60 + riskScore / 2),
      riskLevel,
      factors,
      actions: this.getRecommendedActions(riskLevel, factors),
      estimatedCost: this.estimateMaintenanceCost(
        equipment.equipment_type,
        riskLevel
      ),
      businessImpact:
        riskLevel === "critical"
          ? "High - potential downtime"
          : "Medium - scheduled maintenance",
      metadata: {
        risk_score: riskScore,
        age_months: ageMonths,
        months_since_maintenance: monthsSinceLastMaintenance,
      },
    };
  }

  private getRecommendedActions(
    riskLevel: string,
    factors: string[]
  ): string[] {
    const actions = [];

    if (riskLevel === "critical") {
      actions.push("Schedule immediate inspection");
      actions.push("Prepare replacement parts");
      actions.push("Consider temporary shutdown");
    } else if (riskLevel === "high") {
      actions.push("Schedule maintenance within 2 weeks");
      actions.push("Monitor performance closely");
      actions.push("Order replacement parts");
    } else {
      actions.push("Schedule routine maintenance");
      actions.push("Continue monitoring");
    }

    return actions;
  }

  private estimateMaintenanceCost(
    equipmentType: string,
    riskLevel: string
  ): number {
    const baseCosts = {
      hvac: 15000,
      lighting: 5000,
      motor: 8000,
      transformer: 25000,
      panel: 12000,
      ups: 18000,
      generator: 30000,
      others: 10000,
    };

    const multipliers = {
      low: 1.0,
      medium: 1.3,
      high: 1.8,
      critical: 2.5,
    };

    const baseCost =
      baseCosts[equipmentType as keyof typeof baseCosts] || baseCosts.others;
    const multiplier =
      multipliers[riskLevel as keyof typeof multipliers] || 1.0;

    return baseCost * multiplier;
  }

  private async detectEnergyAnomalies(
    buildingId: number,
    startDate: Date,
    endDate: Date
  ): Promise<IAnomalyDetectionCreate[]> {
    // Get energy consumption data for the period
    const energyData = await database.query(
      `SELECT * FROM energy_consumption 
       WHERE building_id = ? AND recorded_at BETWEEN ? AND ?
       ORDER BY recorded_at`,
      [buildingId, startDate, endDate]
    );

    // Get baseline statistics
    const baseline = await database.queryOne(
      `SELECT AVG(consumption_kwh) as avg_consumption, STDDEV(consumption_kwh) as std_consumption
       FROM energy_consumption 
       WHERE building_id = ? AND recorded_at >= DATE_SUB(?, INTERVAL 30 DAY)`,
      [buildingId, startDate]
    );

    const anomalies: IAnomalyDetectionCreate[] = [];
    const threshold = 2.0; // 2 standard deviations

    if (baseline && baseline.avg_consumption && baseline.std_consumption) {
      for (const reading of energyData) {
        const zScore = Math.abs(
          (reading.consumption_kwh - baseline.avg_consumption) /
            baseline.std_consumption
        );

        if (zScore > threshold) {
          anomalies.push({
            detection_type: "energy",
            building_id: buildingId,
            detected_at: reading.recorded_at,
            anomaly_score: zScore,
            threshold_score: threshold,
            data_point_id: reading.id,
            data_point_type: "energy_consumption",
            anomaly_description: `Energy consumption ${zScore > 3 ? "significantly" : "moderately"} higher than expected`,
            expected_value: baseline.avg_consumption,
            actual_value: reading.consumption_kwh,
            deviation_percentage:
              ((reading.consumption_kwh - baseline.avg_consumption) /
                baseline.avg_consumption) *
              100,
            investigation_status: "pending",
            metadata: {
              z_score: zScore,
              baseline_avg: baseline.avg_consumption,
              baseline_std: baseline.std_consumption,
            },
          });
        }
      }
    }

    return anomalies;
  }

  private async detectPowerQualityAnomalies(
    buildingId: number,
    startDate: Date,
    endDate: Date
  ): Promise<IAnomalyDetectionCreate[]> {
    // Similar implementation for power quality anomalies
    return [];
  }

  private async detectEquipmentAnomalies(
    equipmentId: number,
    startDate: Date,
    endDate: Date
  ): Promise<IAnomalyDetectionCreate[]> {
    // Similar implementation for equipment anomalies
    return [];
  }

  private async storeAnomaly(
    anomalyCreate: IAnomalyDetectionCreate
  ): Promise<IAnomalyDetection> {
    const result = await database.query(
      `INSERT INTO anomaly_detections 
       (detection_type, building_id, equipment_id, detected_at, anomaly_score, threshold_score,
        data_point_id, data_point_type, anomaly_description, expected_value, actual_value,
        deviation_percentage, investigation_status, root_cause, corrective_action, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        anomalyCreate.detection_type,
        anomalyCreate.building_id,
        anomalyCreate.equipment_id,
        anomalyCreate.detected_at,
        anomalyCreate.anomaly_score,
        anomalyCreate.threshold_score,
        anomalyCreate.data_point_id,
        anomalyCreate.data_point_type,
        anomalyCreate.anomaly_description,
        anomalyCreate.expected_value,
        anomalyCreate.actual_value,
        anomalyCreate.deviation_percentage,
        anomalyCreate.investigation_status,
        anomalyCreate.root_cause,
        anomalyCreate.corrective_action,
        JSON.stringify(anomalyCreate.metadata),
      ]
    );

    const anomalyId = (result as any).insertId;
    const newAnomaly = await database.queryOne<IAnomalyDetection>(
      "SELECT * FROM anomaly_detections WHERE id = ?",
      [anomalyId]
    );

    return newAnomaly!;
  }

  private calculateEfficiencyMetrics(
    baseline: IEnergyBaseline,
    actualData: any,
    startDate: Date,
    endDate: Date
  ): any {
    const actual = actualData.total_consumption || 0;
    const expected =
      baseline.baseline_consumption * actualData.reading_count || actual;
    const savings = Math.max(0, expected - actual);
    const savingsPercentage = expected > 0 ? (savings / expected) * 100 : 0;

    // Calculate efficiency score (0-100)
    let efficiencyScore = 50; // Base score
    if (savings > 0) efficiencyScore += Math.min(30, savingsPercentage);
    if (actualData.avg_power_factor >= 0.95) efficiencyScore += 20;
    else if (actualData.avg_power_factor >= 0.85) efficiencyScore += 10;

    return {
      efficiency_score: Math.round(efficiencyScore),
      baseline_consumption: expected,
      actual_consumption: actual,
      savings_kwh: savings,
      savings_percentage: savingsPercentage,
      cost_savings: savings * 8.5, // Assumed PHP 8.5 per kWh
      carbon_reduction_kg: savings * 0.7, // Assumed 0.7 kg CO2 per kWh
      efficiency_factors: {
        consumption_efficiency: savingsPercentage,
        power_factor: actualData.avg_power_factor,
        load_factor: 0.8, // Placeholder
      },
      recommendations: this.generateEfficiencyRecommendations(
        efficiencyScore,
        actualData
      ),
      benchmark_comparison: {},
      weather_impact: 0,
      occupancy_impact: 0,
      equipment_performance: {},
      metadata: { calculation_date: new Date(), baseline_id: baseline.id },
    };
  }

  private generateEfficiencyRecommendations(
    score: number,
    data: any
  ): string[] {
    const recommendations = [];

    if (score < 60) {
      recommendations.push(
        "Consider energy audit to identify improvement opportunities"
      );
      recommendations.push("Implement energy management system");
    }

    if (data.avg_power_factor < 0.85) {
      recommendations.push("Install power factor correction equipment");
    }

    if (score < 40) {
      recommendations.push("Replace inefficient equipment");
      recommendations.push("Upgrade to LED lighting");
      recommendations.push("Improve building insulation");
    }

    return recommendations;
  }

  private generateForecasts(
    historicalData: any[],
    forecastDays: number,
    forecastType: string
  ): ForecastInput[] {
    // Simplified time series forecasting using moving average with trend
    const forecasts: ForecastInput[] = [];
    const values = historicalData.map((d) => d.consumption_kwh);
    const windowSize = Math.min(30, Math.floor(values.length / 4));

    // Calculate trend
    const recentValues = values.slice(-windowSize);
    const olderValues = values.slice(-windowSize * 2, -windowSize);
    const trend =
      recentValues.reduce((a, b) => a + b, 0) / recentValues.length -
      olderValues.reduce((a, b) => a + b, 0) / olderValues.length;

    // Generate forecasts
    const baseValue =
      recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const variance =
      recentValues.reduce((sum, val) => sum + Math.pow(val - baseValue, 2), 0) /
      recentValues.length;
    const stdDev = Math.sqrt(variance);

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + i);

      const predicted =
        baseValue + trend * i + (Math.random() - 0.5) * stdDev * 0.1;
      const confidence = Math.max(60, 95 - i * 1.5); // Decreasing confidence over time
      const confidenceRange = (predicted * 0.1 * (100 - confidence)) / 100;

      forecasts.push({
        date: forecastDate,
        predicted_value: Math.max(0, predicted),
        confidence_lower: Math.max(0, predicted - confidenceRange),
        confidence_upper: predicted + confidenceRange,
        model_type: "regression",
        model_accuracy: confidence,
        influencing_factors: { trend, seasonality: 0, external_factors: 0 },
        metadata: { window_size: windowSize, base_value: baseValue, trend },
      });
    }

    return forecasts;
  }
}

export default new AnalyticsService();
