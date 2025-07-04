import { database } from "@/config/database";
import { socketManager } from "@/config/socket";
import {
  IAlert,
  IAlertCreate,
  IAlertUpdate,
  IAlertThreshold,
  IAlertThresholdCreate,
  AlertType,
  AlertSeverity,
  AlertStatus,
} from "@/interfaces/IAlert";
import { logger } from "@/utils/logger";
import { ENERGY_THRESHOLDS, SOCKET_EVENTS } from "@/utils/constants";

interface NotificationChannel {
  type: "email" | "sms" | "push" | "webhook";
  config: Record<string, any>;
  enabled: boolean;
}

interface EscalationRule {
  severity: AlertSeverity;
  escalation_minutes: number;
  escalation_levels: Array<{
    level: number;
    notification_channels: NotificationChannel[];
    recipients: string[];
  }>;
}

class AlertService {
  private escalationRules: EscalationRule[] = [
    {
      severity: AlertSeverity.CRITICAL,
      escalation_minutes: 5,
      escalation_levels: [
        {
          level: 1,
          notification_channels: [
            { type: "email", config: {}, enabled: true },
            { type: "sms", config: {}, enabled: true },
            { type: "push", config: {}, enabled: true },
          ],
          recipients: ["facility_manager", "energy_manager"],
        },
        {
          level: 2,
          notification_channels: [
            { type: "email", config: {}, enabled: true },
            { type: "sms", config: {}, enabled: true },
          ],
          recipients: ["department_head", "admin"],
        },
      ],
    },
    {
      severity: AlertSeverity.HIGH,
      escalation_minutes: 15,
      escalation_levels: [
        {
          level: 1,
          notification_channels: [
            { type: "email", config: {}, enabled: true },
            { type: "push", config: {}, enabled: true },
          ],
          recipients: ["facility_manager", "energy_manager"],
        },
      ],
    },
    {
      severity: AlertSeverity.MEDIUM,
      escalation_minutes: 60,
      escalation_levels: [
        {
          level: 1,
          notification_channels: [{ type: "email", config: {}, enabled: true }],
          recipients: ["energy_manager"],
        },
      ],
    },
  ];

  /**
   * Create a new alert
   */
  public async createAlert(alertData: IAlertCreate): Promise<IAlert> {
    try {
      // Check for duplicate alerts (prevent spam)
      const duplicateCheck = await this.checkForDuplicateAlert(alertData);
      if (duplicateCheck) {
        logger.info(
          "Duplicate alert detected, updating existing alert instead"
        );
        return await this.updateAlert(duplicateCheck.id, {
          status: AlertStatus.ACTIVE,
          metadata: alertData.metadata,
        });
      }

      const result = await database.query(
        `INSERT INTO alerts 
         (type, severity, status, title, message, building_id, equipment_id, audit_id,
          energy_reading_id, pq_reading_id, threshold_config, detected_value, threshold_value,
          notification_sent, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          alertData.type,
          alertData.severity,
          AlertStatus.ACTIVE,
          alertData.title,
          alertData.message,
          alertData.building_id || null,
          alertData.equipment_id || null,
          alertData.audit_id || null,
          alertData.energy_reading_id || null,
          alertData.pq_reading_id || null,
          JSON.stringify(alertData.threshold_config || {}),
          alertData.detected_value || null,
          alertData.threshold_value || null,
          false,
          JSON.stringify(alertData.metadata || {}),
        ]
      );

      const alertId = (result as any).insertId;
      const newAlert = await database.queryOne<IAlert>(
        "SELECT * FROM alerts WHERE id = ?",
        [alertId]
      );

      if (!newAlert) {
        throw new Error("Failed to create alert");
      }

      // Send immediate notifications and start escalation process
      await this.processNewAlert(newAlert);

      logger.info(`Alert created: ${alertData.type} - ${alertData.title}`);
      return newAlert;
    } catch (error) {
      logger.error("Error creating alert:", error);
      throw error;
    }
  }

  /**
   * Update an existing alert
   */
  public async updateAlert(
    alertId: number,
    updateData: IAlertUpdate
  ): Promise<IAlert> {
    try {
      const existingAlert = await database.queryOne<IAlert>(
        "SELECT * FROM alerts WHERE id = ?",
        [alertId]
      );

      if (!existingAlert) {
        throw new Error("Alert not found");
      }

      // Build update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === "metadata") {
            updateFields.push(`${key} = ?`);
            updateValues.push(JSON.stringify(value));
          } else {
            updateFields.push(`${key} = ?`);
            updateValues.push(value);
          }
        }
      });

      // Add timestamp fields based on status changes
      if (
        updateData.status === AlertStatus.ACKNOWLEDGED &&
        !updateData.acknowledged_by
      ) {
        updateFields.push("acknowledged_at = CURRENT_TIMESTAMP");
      }
      if (
        updateData.status === AlertStatus.RESOLVED &&
        !updateData.resolved_by
      ) {
        updateFields.push("resolved_at = CURRENT_TIMESTAMP");
      }

      if (updateFields.length > 0) {
        updateFields.push("updated_at = CURRENT_TIMESTAMP");
        updateValues.push(alertId);

        await database.query(
          `UPDATE alerts SET ${updateFields.join(", ")} WHERE id = ?`,
          updateValues
        );
      }

      const updatedAlert = await database.queryOne<IAlert>(
        "SELECT * FROM alerts WHERE id = ?",
        [alertId]
      );

      if (!updatedAlert) {
        throw new Error("Failed to update alert");
      }

      // Handle status change notifications
      if (updateData.status && updateData.status !== existingAlert.status) {
        await this.handleStatusChange(updatedAlert, existingAlert.status);
      }

      return updatedAlert;
    } catch (error) {
      logger.error("Error updating alert:", error);
      throw error;
    }
  }

  /**
   * Create or update alert threshold configuration
   */
  public async createThreshold(
    thresholdData: IAlertThresholdCreate
  ): Promise<IAlertThreshold> {
    try {
      const result = await database.query(
        `INSERT INTO alert_thresholds 
         (building_id, equipment_id, parameter_name, parameter_type, min_value, max_value,
          threshold_type, severity, enabled, escalation_minutes, notification_emails, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          thresholdData.building_id || null,
          thresholdData.equipment_id || null,
          thresholdData.parameter_name,
          thresholdData.parameter_type,
          thresholdData.min_value || null,
          thresholdData.max_value || null,
          thresholdData.threshold_type,
          thresholdData.severity,
          thresholdData.enabled ?? true,
          thresholdData.escalation_minutes || null,
          JSON.stringify(thresholdData.notification_emails || []),
          JSON.stringify(thresholdData.metadata || {}),
        ]
      );

      const thresholdId = (result as any).insertId;
      const newThreshold = await database.queryOne<IAlertThreshold>(
        "SELECT * FROM alert_thresholds WHERE id = ?",
        [thresholdId]
      );

      if (!newThreshold) {
        throw new Error("Failed to create threshold");
      }

      logger.info(
        `Threshold created: ${thresholdData.parameter_name} for ${thresholdData.parameter_type}`
      );
      return newThreshold;
    } catch (error) {
      logger.error("Error creating threshold:", error);
      throw error;
    }
  }

  /**
   * Monitor energy consumption against thresholds
   */
  public async monitorEnergyThresholds(
    buildingId: number,
    energyData: {
      consumption_kwh: number;
      demand_kw?: number;
      power_factor?: number;
      recorded_at: Date;
    }
  ): Promise<IAlert[]> {
    try {
      const alerts: IAlert[] = [];

      // Get active thresholds for this building
      const thresholds = await database.query<IAlertThreshold>(
        `SELECT * FROM alert_thresholds 
         WHERE (building_id = ? OR building_id IS NULL)
         AND parameter_type = 'energy' 
         AND enabled = true`,
        [buildingId]
      );

      for (const threshold of thresholds) {
        const violation = this.checkEnergyThresholdViolation(
          energyData,
          threshold
        );
        if (violation) {
          const alert = await this.createAlert({
            type: AlertType.THRESHOLD_EXCEEDED,
            severity: threshold.severity,
            title: `Energy Threshold Exceeded: ${threshold.parameter_name}`,
            message: violation.message,
            building_id: buildingId,
            threshold_config: threshold,
            detected_value: violation.detectedValue,
            threshold_value: violation.thresholdValue,
            metadata: { threshold_id: threshold.id, energy_data: energyData },
          });
          alerts.push(alert);
        }
      }

      // Check standard power quality thresholds
      if (
        energyData.power_factor &&
        energyData.power_factor < ENERGY_THRESHOLDS.POWER_FACTOR_MIN
      ) {
        const alert = await this.createAlert({
          type: AlertType.POWER_QUALITY,
          severity: AlertSeverity.MEDIUM,
          title: "Low Power Factor Detected",
          message: `Power factor ${energyData.power_factor} is below minimum threshold of ${ENERGY_THRESHOLDS.POWER_FACTOR_MIN}`,
          building_id: buildingId,
          detected_value: energyData.power_factor,
          threshold_value: ENERGY_THRESHOLDS.POWER_FACTOR_MIN,
          metadata: { energy_data: energyData },
        });
        alerts.push(alert);
      }

      return alerts;
    } catch (error) {
      logger.error("Error monitoring energy thresholds:", error);
      throw error;
    }
  }

  /**
   * Monitor power quality against thresholds
   */
  public async monitorPowerQualityThresholds(
    buildingId: number,
    pqData: {
      voltage_l1?: number;
      voltage_l2?: number;
      voltage_l3?: number;
      thd_voltage?: number;
      thd_current?: number;
      frequency?: number;
      voltage_unbalance?: number;
      current_unbalance?: number;
      recorded_at: Date;
    }
  ): Promise<IAlert[]> {
    try {
      const alerts: IAlert[] = [];

      // Voltage range checks
      const voltages = [
        pqData.voltage_l1,
        pqData.voltage_l2,
        pqData.voltage_l3,
      ].filter((v) => v !== undefined) as number[];

      for (let i = 0; i < voltages.length; i++) {
        const voltage = voltages[i];
        if (
          voltage < ENERGY_THRESHOLDS.VOLTAGE_MIN ||
          voltage > ENERGY_THRESHOLDS.VOLTAGE_MAX
        ) {
          const severity =
            Math.abs(voltage - 230) / 230 > 0.15
              ? AlertSeverity.HIGH
              : AlertSeverity.MEDIUM;
          const alert = await this.createAlert({
            type: AlertType.POWER_QUALITY,
            severity,
            title: `Voltage Out of Range: Phase L${i + 1}`,
            message: `Voltage ${voltage}V is outside acceptable range (${ENERGY_THRESHOLDS.VOLTAGE_MIN}-${ENERGY_THRESHOLDS.VOLTAGE_MAX}V)`,
            building_id: buildingId,
            detected_value: voltage,
            threshold_value:
              voltage < 230
                ? ENERGY_THRESHOLDS.VOLTAGE_MIN
                : ENERGY_THRESHOLDS.VOLTAGE_MAX,
            metadata: { phase: `L${i + 1}`, pq_data: pqData },
          });
          alerts.push(alert);
        }
      }

      // THD checks
      if (
        pqData.thd_voltage &&
        pqData.thd_voltage > ENERGY_THRESHOLDS.THD_VOLTAGE_MAX
      ) {
        const alert = await this.createAlert({
          type: AlertType.POWER_QUALITY,
          severity:
            pqData.thd_voltage > 12 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          title: "High Voltage THD Detected",
          message: `Voltage THD ${pqData.thd_voltage}% exceeds limit of ${ENERGY_THRESHOLDS.THD_VOLTAGE_MAX}%`,
          building_id: buildingId,
          detected_value: pqData.thd_voltage,
          threshold_value: ENERGY_THRESHOLDS.THD_VOLTAGE_MAX,
          metadata: { pq_data: pqData },
        });
        alerts.push(alert);
      }

      if (
        pqData.thd_current &&
        pqData.thd_current > ENERGY_THRESHOLDS.THD_CURRENT_MAX
      ) {
        const alert = await this.createAlert({
          type: AlertType.POWER_QUALITY,
          severity:
            pqData.thd_current > 20 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          title: "High Current THD Detected",
          message: `Current THD ${pqData.thd_current}% exceeds limit of ${ENERGY_THRESHOLDS.THD_CURRENT_MAX}%`,
          building_id: buildingId,
          detected_value: pqData.thd_current,
          threshold_value: ENERGY_THRESHOLDS.THD_CURRENT_MAX,
          metadata: { pq_data: pqData },
        });
        alerts.push(alert);
      }

      // Frequency checks
      if (
        pqData.frequency &&
        (pqData.frequency < ENERGY_THRESHOLDS.FREQUENCY_MIN ||
          pqData.frequency > ENERGY_THRESHOLDS.FREQUENCY_MAX)
      ) {
        const alert = await this.createAlert({
          type: AlertType.POWER_QUALITY,
          severity: AlertSeverity.HIGH,
          title: "Frequency Deviation Detected",
          message: `Frequency ${pqData.frequency}Hz is outside acceptable range (${ENERGY_THRESHOLDS.FREQUENCY_MIN}-${ENERGY_THRESHOLDS.FREQUENCY_MAX}Hz)`,
          building_id: buildingId,
          detected_value: pqData.frequency,
          threshold_value:
            pqData.frequency < 50
              ? ENERGY_THRESHOLDS.FREQUENCY_MIN
              : ENERGY_THRESHOLDS.FREQUENCY_MAX,
          metadata: { pq_data: pqData },
        });
        alerts.push(alert);
      }

      // Voltage unbalance check
      if (
        pqData.voltage_unbalance &&
        pqData.voltage_unbalance > ENERGY_THRESHOLDS.VOLTAGE_UNBALANCE_MAX
      ) {
        const alert = await this.createAlert({
          type: AlertType.POWER_QUALITY,
          severity:
            pqData.voltage_unbalance > 5
              ? AlertSeverity.HIGH
              : AlertSeverity.MEDIUM,
          title: "High Voltage Unbalance Detected",
          message: `Voltage unbalance ${pqData.voltage_unbalance}% exceeds limit of ${ENERGY_THRESHOLDS.VOLTAGE_UNBALANCE_MAX}%`,
          building_id: buildingId,
          detected_value: pqData.voltage_unbalance,
          threshold_value: ENERGY_THRESHOLDS.VOLTAGE_UNBALANCE_MAX,
          metadata: { pq_data: pqData },
        });
        alerts.push(alert);
      }

      return alerts;
    } catch (error) {
      logger.error("Error monitoring power quality thresholds:", error);
      throw error;
    }
  }

  /**
   * Monitor equipment for predictive maintenance alerts
   */
  public async monitorEquipmentHealth(equipmentId: number): Promise<IAlert[]> {
    try {
      const alerts: IAlert[] = [];

      // Get equipment details
      const equipment = await database.queryOne(
        "SELECT * FROM equipment WHERE id = ?",
        [equipmentId]
      );

      if (!equipment) {
        return alerts;
      }

      // Get latest maintenance prediction
      const prediction = await database.queryOne(
        `SELECT * FROM maintenance_predictions 
         WHERE equipment_id = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [equipmentId]
      );

      if (prediction && prediction.risk_level === "critical") {
        const alert = await this.createAlert({
          type: AlertType.EQUIPMENT_FAILURE,
          severity: AlertSeverity.CRITICAL,
          title: `Critical Equipment Risk: ${equipment.name}`,
          message: `Equipment requires immediate attention - predicted ${prediction.prediction_type} on ${prediction.predicted_date}`,
          equipment_id: equipmentId,
          building_id: equipment.building_id,
          metadata: { prediction_details: prediction },
        });
        alerts.push(alert);
      } else if (prediction && prediction.risk_level === "high") {
        const alert = await this.createAlert({
          type: AlertType.MAINTENANCE_DUE,
          severity: AlertSeverity.HIGH,
          title: `Maintenance Required: ${equipment.name}`,
          message: `Equipment maintenance should be scheduled soon - predicted ${prediction.prediction_type} on ${prediction.predicted_date}`,
          equipment_id: equipmentId,
          building_id: equipment.building_id,
          metadata: { prediction_details: prediction },
        });
        alerts.push(alert);
      }

      return alerts;
    } catch (error) {
      logger.error("Error monitoring equipment health:", error);
      throw error;
    }
  }

  /**
   * Get active alerts with filtering and pagination
   */
  public async getActiveAlerts(
    filters: {
      building_id?: number;
      equipment_id?: number;
      type?: AlertType;
      severity?: AlertSeverity;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ alerts: IAlert[]; total: number }> {
    try {
      const conditions = ["status = ?"];
      const params: any[] = [AlertStatus.ACTIVE];

      if (filters.building_id) {
        conditions.push("building_id = ?");
        params.push(filters.building_id);
      }

      if (filters.equipment_id) {
        conditions.push("equipment_id = ?");
        params.push(filters.equipment_id);
      }

      if (filters.type) {
        conditions.push("type = ?");
        params.push(filters.type);
      }

      if (filters.severity) {
        conditions.push("severity = ?");
        params.push(filters.severity);
      }

      const whereClause = `WHERE ${conditions.join(" AND ")}`;

      // Get total count
      const countResult = await database.queryOne<{ total: number }>(
        `SELECT COUNT(*) as total FROM alerts ${whereClause}`,
        params
      );

      // Get alerts
      const alertsQuery = `
        SELECT a.*, b.name as building_name, e.name as equipment_name
        FROM alerts a
        LEFT JOIN buildings b ON a.building_id = b.id
        LEFT JOIN equipment e ON a.equipment_id = e.id
        ${whereClause}
        ORDER BY 
          FIELD(a.severity, 'critical', 'high', 'medium', 'low'),
          a.created_at DESC
        ${filters.limit ? `LIMIT ${filters.limit}` : ""}
        ${filters.offset ? `OFFSET ${filters.offset}` : ""}
      `;

      const alerts = await database.query<IAlert>(alertsQuery, params);

      return {
        alerts,
        total: countResult?.total || 0,
      };
    } catch (error) {
      logger.error("Error getting active alerts:", error);
      throw error;
    }
  }

  /**
   * Process escalation for unacknowledged alerts
   */
  public async processEscalations(): Promise<void> {
    try {
      const unacknowledgedAlerts = await database.query<IAlert>(
        `SELECT * FROM alerts 
         WHERE status = ? 
         AND acknowledged_at IS NULL 
         AND created_at <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
        [AlertStatus.ACTIVE]
      );

      for (const alert of unacknowledgedAlerts) {
        await this.escalateAlert(alert);
      }
    } catch (error) {
      logger.error("Error processing escalations:", error);
    }
  }

  // Private helper methods

  private async processNewAlert(alert: IAlert): Promise<void> {
    // Send real-time notification via WebSocket
    socketManager.emitToBuilding(
      alert.building_id?.toString() || "system",
      SOCKET_EVENTS.NEW_AUDIT_ASSIGNED,
      alert
    );

    // Send notifications based on severity
    const escalationRule = this.escalationRules.find(
      (rule) => rule.severity === alert.severity
    );
    if (escalationRule && escalationRule.escalation_levels.length > 0) {
      await this.sendNotifications(alert, escalationRule.escalation_levels[0]);
    }

    // Schedule escalation if needed
    if (escalationRule && escalationRule.escalation_minutes > 0) {
      setTimeout(
        async () => {
          const currentAlert = await database.queryOne<IAlert>(
            "SELECT * FROM alerts WHERE id = ? AND status = ?",
            [alert.id, AlertStatus.ACTIVE]
          );
          if (currentAlert && !currentAlert.acknowledged_at) {
            await this.escalateAlert(currentAlert);
          }
        },
        escalationRule.escalation_minutes * 60 * 1000
      );
    }
  }

  private async escalateAlert(alert: IAlert): Promise<void> {
    const escalationRule = this.escalationRules.find(
      (rule) => rule.severity === alert.severity
    );
    if (!escalationRule) return;

    const currentLevel = (alert.escalation_level || 0) + 1;
    const escalationLevel = escalationRule.escalation_levels[currentLevel - 1];

    if (escalationLevel) {
      await this.updateAlert(alert.id, {
        escalation_level: currentLevel,
        status: AlertStatus.ESCALATED,
      });

      await this.sendNotifications(alert, escalationLevel);

      logger.warn(`Alert ${alert.id} escalated to level ${currentLevel}`);
    }
  }

  private async sendNotifications(
    alert: IAlert,
    escalationLevel: any
  ): Promise<void> {
    // Implementation would send actual notifications via email, SMS, etc.
    // For now, just log the notification
    logger.info(
      `Sending notifications for alert ${alert.id} to level ${escalationLevel.level} recipients`
    );

    // Mark notification as sent - update directly in database since notification_sent is not in IAlertUpdate
    await database.query(
      "UPDATE alerts SET notification_sent = true WHERE id = ?",
      [alert.id]
    );
  }

  private async handleStatusChange(
    alert: IAlert,
    previousStatus: AlertStatus
  ): Promise<void> {
    // Send real-time update
    socketManager.emitToBuilding(
      alert.building_id?.toString() || "system",
      "alertStatusChanged",
      { alert, previousStatus }
    );

    if (alert.status === AlertStatus.RESOLVED) {
      logger.info(`Alert ${alert.id} resolved`);
    } else if (alert.status === AlertStatus.ACKNOWLEDGED) {
      logger.info(`Alert ${alert.id} acknowledged`);
    }
  }

  private async checkForDuplicateAlert(
    alertData: IAlertCreate
  ): Promise<IAlert | null> {
    const duplicateAlert = await database.queryOne<IAlert>(
      `SELECT * FROM alerts 
       WHERE type = ? 
       AND building_id = ? 
       AND equipment_id = ? 
       AND status = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [
        alertData.type,
        alertData.building_id || null,
        alertData.equipment_id || null,
        AlertStatus.ACTIVE,
      ]
    );

    return duplicateAlert;
  }

  private checkEnergyThresholdViolation(
    energyData: any,
    threshold: IAlertThreshold
  ): { message: string; detectedValue: number; thresholdValue: number } | null {
    let detectedValue: number;
    let message: string;

    switch (threshold.parameter_name) {
      case "consumption_kwh":
        detectedValue = energyData.consumption_kwh;
        break;
      case "demand_kw":
        detectedValue = energyData.demand_kw || 0;
        break;
      case "power_factor":
        detectedValue = energyData.power_factor || 0;
        break;
      default:
        return null;
    }

    // Check threshold violation - handle both null and undefined
    if (threshold.min_value != null && detectedValue < threshold.min_value) {
      message = `${threshold.parameter_name} ${detectedValue} is below minimum threshold of ${threshold.min_value}`;
      return { message, detectedValue, thresholdValue: threshold.min_value };
    }

    if (threshold.max_value != null && detectedValue > threshold.max_value) {
      message = `${threshold.parameter_name} ${detectedValue} exceeds maximum threshold of ${threshold.max_value}`;
      return { message, detectedValue, thresholdValue: threshold.max_value };
    }

    return null;
  }
}

export default new AlertService();
