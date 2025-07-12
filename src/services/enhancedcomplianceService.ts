import { database } from "@/config/database";
import { StandardType, ComplianceStatus } from "@/types/enums";
import { IComplianceAnalysis } from "@/interfaces/IAnalytics";
import { logger } from "@/utils/logger";
import { COMPLIANCE_STANDARDS } from "@/utils/constants";
import alertService from "./alertService";
import { AlertType, AlertSeverity } from "@/interfaces/IAlert";

interface ComplianceRule {
  rule_id: string;
  section_code: string;
  title: string;
  description: string;
  requirement_type:
    | "measurement"
    | "documentation"
    | "inspection"
    | "calculation";
  severity: "low" | "medium" | "high" | "critical";
  automated_check: boolean;
  check_function?: (data: any, context: any) => ComplianceCheckResult;
  required_parameters: string[];
  tolerance?: number;
  unit?: string;
  frequency?: "monthly" | "quarterly" | "annually" | "continuous";
  metadata?: Record<string, any>;
}

interface ComplianceCheckResult {
  compliant: boolean;
  actual_value?: number;
  required_value?: number;
  deviation?: number;
  confidence_score: number;
  evidence?: string[];
  recommendations?: string[];
  corrective_actions?: string[];
  estimated_cost?: number;
  priority?: "low" | "medium" | "high" | "critical";
}

interface ComplianceContext {
  building_data: any;
  equipment_data: any[];
  energy_data: any[];
  power_quality_data: any[];
  maintenance_records: any[];
  audit_history: any[];
}

interface ComplianceGap {
  rule_id: string;
  section_code: string;
  title: string;
  current_compliance?: number;
  required_compliance?: number;
  gap_magnitude?: number;
  estimated_cost?: number;
  priority: "low" | "medium" | "high" | "critical";
  corrective_actions?: string[];
  timeline?: string;
}

interface StandardGaps {
  standard: StandardType;
  gaps: ComplianceGap[];
  overall_compliance_percentage: number;
  priority_actions: ComplianceGap[];
}

interface ImplementationRoadmap {
  immediate: ComplianceGap[]; // 0-30 days
  short_term: ComplianceGap[]; // 1-6 months
  medium_term: ComplianceGap[]; // 6-12 months
  long_term: ComplianceGap[]; // 12+ months
}

interface ComplianceBenchmarks {
  peer_comparison: {
    current_score: number;
    peer_average: number;
    ranking_percentile: number;
  };
  industry_percentile: number;
  improvement_opportunities: string[];
  cost_benefit_analysis: {
    estimated_investment: number;
    projected_savings: number;
    payback_period_months: number;
    risk_reduction_value: number;
  };
  recommendations: string[];
}

interface GapAnalysisResult {
  audit_id: number;
  analysis_date: Date;
  standards_analyzed: StandardType[];
  compliance_gaps: StandardGaps[];
  total_estimated_cost: number;
  implementation_roadmap: ImplementationRoadmap;
}

interface BenchmarkingReport {
  building_id: number;
  current_score: number;
  historical_trend: number;
  peer_comparison: ComplianceBenchmarks["peer_comparison"];
  industry_percentile: number;
  improvement_opportunities: string[];
  cost_benefit_analysis: ComplianceBenchmarks["cost_benefit_analysis"];
  recommendations: string[];
}

class EnhancedComplianceService {
  // PEC 2017 Rules Implementation
  private pec2017Rules: ComplianceRule[] = [
    {
      rule_id: "PEC_1075_001",
      section_code: "Rule 1075",
      title: "Minimum Illumination Levels",
      description:
        "Academic spaces must maintain minimum illumination of 300 lux",
      requirement_type: "measurement",
      severity: "medium",
      automated_check: true,
      required_parameters: ["illuminance_lux", "space_type"],
      tolerance: 10, // 10% tolerance
      unit: "lux",
      frequency: "quarterly",
      check_function: (data, context) => {
        const required = data.space_type === "academic" ? 300 : 200;
        const actual = data.illuminance_lux || 0;
        const compliant = actual >= required * 0.9; // 10% tolerance
        return {
          compliant,
          actual_value: actual,
          required_value: required,
          deviation: ((required - actual) / required) * 100,
          confidence_score: 95,
          recommendations: compliant
            ? []
            : ["Increase lighting levels", "Check luminaire efficiency"],
          corrective_actions: compliant
            ? []
            : ["Install additional lighting fixtures", "Replace with LED"],
        };
      },
    },
    {
      rule_id: "PEC_2095_001",
      section_code: "Rule 2095",
      title: "Grounding System Requirements",
      description: "Grounding resistance must not exceed 25 ohms",
      requirement_type: "measurement",
      severity: "high",
      automated_check: true,
      required_parameters: ["grounding_resistance_ohms"],
      tolerance: 0,
      unit: "ohms",
      frequency: "annually",
      check_function: (data, context) => {
        const required = 25;
        const actual = data.grounding_resistance_ohms || 999;
        const compliant = actual <= required;
        return {
          compliant,
          actual_value: actual,
          required_value: required,
          deviation:
            actual > required ? ((actual - required) / required) * 100 : 0,
          confidence_score: 90,
          recommendations: compliant
            ? []
            : ["Improve grounding system", "Add additional ground rods"],
          corrective_actions: compliant
            ? []
            : [
                "Install additional grounding electrodes",
                "Improve soil conductivity",
              ],
          estimated_cost: compliant ? 0 : 25000,
          priority: actual > 50 ? "critical" : "high",
        };
      },
    },
    {
      rule_id: "PEC_2101_001",
      section_code: "Rule 2101",
      title: "Circuit Loading Limits",
      description: "Circuit loading must not exceed 80% of rated capacity",
      requirement_type: "calculation",
      severity: "high",
      automated_check: true,
      required_parameters: ["actual_load_amps", "rated_capacity_amps"],
      tolerance: 5,
      unit: "percentage",
      frequency: "continuous",
      check_function: (data, context) => {
        const loadPercentage =
          (data.actual_load_amps / data.rated_capacity_amps) * 100;
        const compliant = loadPercentage <= 80;
        return {
          compliant,
          actual_value: loadPercentage,
          required_value: 80,
          deviation: Math.max(0, loadPercentage - 80),
          confidence_score: 95,
          recommendations: compliant
            ? []
            : ["Redistribute loads", "Upgrade circuit capacity"],
          corrective_actions: compliant
            ? []
            : ["Install additional circuits", "Upgrade panel capacity"],
          estimated_cost: compliant ? 0 : loadPercentage > 95 ? 50000 : 30000,
          priority: loadPercentage > 95 ? "critical" : "high",
        };
      },
    },
    {
      rule_id: "PEC_2107_001",
      section_code: "Rule 2107",
      title: "GFCI Protection Requirements",
      description:
        "GFCI protection required for wet locations and outdoor outlets",
      requirement_type: "inspection",
      severity: "critical",
      automated_check: false,
      required_parameters: ["gfci_installed", "location_type"],
      frequency: "quarterly",
    },
  ];

  // OSHS Rules Implementation
  private oshsRules: ComplianceRule[] = [
    {
      rule_id: "OSHS_3_1_001",
      section_code: "Section 3.1",
      title: "Electrical Safety Protection",
      description:
        "All electrical installations must have proper protective devices",
      requirement_type: "inspection",
      severity: "critical",
      automated_check: true,
      required_parameters: [
        "circuit_breakers_installed",
        "fuses_installed",
        "protective_devices_functional",
      ],
      frequency: "quarterly",
      check_function: (data, context) => {
        const hasProtection =
          data.circuit_breakers_installed || data.fuses_installed;
        const functional = data.protective_devices_functional;
        const compliant = hasProtection && functional;
        return {
          compliant,
          confidence_score: 100,
          recommendations: compliant
            ? []
            : [
                "Install proper protective devices",
                "Test device functionality",
              ],
          corrective_actions: compliant
            ? []
            : ["Install circuit breakers", "Replace faulty protection devices"],
          estimated_cost: compliant ? 0 : 15000,
          priority: "critical",
        };
      },
    },
    {
      rule_id: "OSHS_3_5_001",
      section_code: "Section 3.5",
      title: "Emergency Lighting Requirements",
      description: "Emergency lighting must be functional and tested regularly",
      requirement_type: "inspection",
      severity: "high",
      automated_check: true,
      required_parameters: [
        "emergency_lighting_installed",
        "emergency_lighting_functional",
        "last_test_date",
      ],
      frequency: "monthly",
      check_function: (data, context) => {
        const installed = data.emergency_lighting_installed;
        const functional = data.emergency_lighting_functional;
        const lastTest = new Date(data.last_test_date);
        const daysSinceTest = Math.floor(
          (Date.now() - lastTest.getTime()) / (1000 * 60 * 60 * 24)
        );
        const testCurrent = daysSinceTest <= 30;
        const compliant = installed && functional && testCurrent;
        return {
          compliant,
          confidence_score: 90,
          recommendations: compliant
            ? []
            : ["Test emergency lighting", "Repair non-functional units"],
          corrective_actions: compliant
            ? []
            : ["Replace emergency lighting", "Establish testing schedule"],
          estimated_cost: compliant ? 0 : 20000,
          priority: !functional ? "critical" : "medium",
        };
      },
    },
    {
      rule_id: "OSHS_4_2_001",
      section_code: "Section 4.2",
      title: "Electrical Safety Training",
      description: "Personnel must receive electrical safety training",
      requirement_type: "documentation",
      severity: "medium",
      automated_check: false,
      required_parameters: [
        "training_records",
        "personnel_count",
        "certification_dates",
      ],
      frequency: "annually",
    },
  ];

  // RA 11285 (Energy Efficiency) Rules Implementation
  private ra11285Rules: ComplianceRule[] = [
    {
      rule_id: "RA11285_001",
      section_code: "Section 7",
      title: "Energy Audit Requirements",
      description:
        "Energy audits must be conducted annually for designated establishments",
      requirement_type: "documentation",
      severity: "medium",
      automated_check: true,
      required_parameters: [
        "last_energy_audit_date",
        "building_energy_consumption",
      ],
      frequency: "annually",
      check_function: (data, context) => {
        const lastAudit = new Date(data.last_energy_audit_date);
        const daysSinceAudit = Math.floor(
          (Date.now() - lastAudit.getTime()) / (1000 * 60 * 60 * 24)
        );
        const compliant = daysSinceAudit <= 365;
        const overdueDays = Math.max(0, daysSinceAudit - 365);
        return {
          compliant,
          actual_value: daysSinceAudit,
          required_value: 365,
          deviation: overdueDays,
          confidence_score: 100,
          recommendations: compliant
            ? []
            : ["Schedule energy audit", "Engage certified energy auditor"],
          corrective_actions: compliant
            ? []
            : ["Conduct comprehensive energy audit"],
          estimated_cost: compliant ? 0 : 50000,
          priority: overdueDays > 90 ? "high" : "medium",
        };
      },
    },
    {
      rule_id: "RA11285_002",
      section_code: "Section 8",
      title: "Energy Manager Designation",
      description:
        "Designated establishments must have a certified energy manager",
      requirement_type: "documentation",
      severity: "medium",
      automated_check: false,
      required_parameters: [
        "energy_manager_assigned",
        "energy_manager_certified",
        "certification_expiry",
      ],
      frequency: "annually",
    },
    {
      rule_id: "RA11285_003",
      section_code: "Section 12",
      title: "Energy Efficiency Targets",
      description:
        "Must achieve minimum 5% energy efficiency improvement annually",
      requirement_type: "calculation",
      severity: "medium",
      automated_check: true,
      required_parameters: [
        "current_year_consumption",
        "previous_year_consumption",
        "efficiency_measures_implemented",
      ],
      frequency: "annually",
      check_function: (data, context) => {
        const currentConsumption = data.current_year_consumption;
        const previousConsumption = data.previous_year_consumption;
        const improvementPercentage =
          ((previousConsumption - currentConsumption) / previousConsumption) *
          100;
        const compliant = improvementPercentage >= 5;
        return {
          compliant,
          actual_value: improvementPercentage,
          required_value: 5,
          deviation: Math.max(0, 5 - improvementPercentage),
          confidence_score: 85,
          recommendations: compliant
            ? ["Continue efficiency programs"]
            : ["Implement energy efficiency measures", "Upgrade equipment"],
          corrective_actions: compliant
            ? []
            : [
                "Install efficient lighting",
                "Upgrade HVAC systems",
                "Implement building automation",
              ],
          estimated_cost: compliant ? 0 : 100000,
          priority: improvementPercentage < 0 ? "high" : "medium",
        };
      },
    },
  ];

  /**
   * Perform comprehensive compliance analysis for an audit
   */
  public async performComprehensiveAnalysis(
    auditId: number
  ): Promise<IComplianceAnalysis> {
    try {
      // Get audit context
      const context = await this.buildComplianceContext(auditId);

      // Run all applicable compliance checks
      const pec2017Results = await this.runStandardChecks(
        StandardType.PEC2017,
        context,
        auditId
      );
      const oshsResults = await this.runStandardChecks(
        StandardType.OSHS,
        context,
        auditId
      );
      const ra11285Results = await this.runStandardChecks(
        StandardType.RA11285,
        context,
        auditId
      );

      // Calculate overall compliance metrics
      const allResults = [...pec2017Results, ...oshsResults, ...ra11285Results];
      const analysis = this.calculateComplianceAnalysis(allResults, auditId);

      // Store analysis results
      const storedAnalysis = await this.storeComplianceAnalysis(analysis);

      // Generate alerts for critical violations
      await this.generateComplianceAlerts(allResults, context.building_data.id);

      return storedAnalysis;
    } catch (error) {
      logger.error(
        "Error performing comprehensive compliance analysis:",
        error
      );
      throw error;
    }
  }

  /**
   * Real-time compliance monitoring
   */
  public async monitorRealTimeCompliance(
    buildingId: number,
    triggerType: "energy" | "power_quality" | "equipment" | "manual",
    data: any
  ): Promise<void> {
    try {
      const context = await this.buildBuildingComplianceContext(buildingId);
      const alerts = [];

      if (triggerType === "energy") {
        // Check energy-related compliance rules
        const energyViolations = await this.checkEnergyCompliance(
          data,
          context
        );
        alerts.push(...energyViolations);
      }

      if (triggerType === "power_quality") {
        // Check power quality compliance rules
        const pqViolations = await this.checkPowerQualityCompliance(
          data,
          context
        );
        alerts.push(...pqViolations);
      }

      // Generate alerts for violations
      for (const violation of alerts) {
        await alertService.createAlert({
          type: AlertType.COMPLIANCE_VIOLATION,
          severity: this.mapSeverityToAlert(violation.severity),
          title: `Compliance Violation: ${violation.rule_title}`,
          message: violation.description,
          building_id: buildingId,
          metadata: { compliance_violation: violation },
        });
      }
    } catch (error) {
      logger.error("Error monitoring real-time compliance:", error);
    }
  }

  /**
   * Generate compliance benchmarking report
   */
  public async generateBenchmarkingReport(
    buildingId: number
  ): Promise<BenchmarkingReport> {
    try {
      // Get building's compliance history
      const complianceHistory = await database.query(
        `SELECT * FROM compliance_analyses 
         WHERE audit_id IN (
           SELECT id FROM audits WHERE building_id = ?
         ) 
         ORDER BY analysis_date DESC`,
        [buildingId]
      );

      // Get peer buildings for comparison
      const peerBuildings = await this.findPeerBuildings(buildingId);
      const peerCompliance = await this.getPeerComplianceData(peerBuildings);

      // Calculate benchmarks
      const benchmarks = this.calculateComplianceBenchmarks(
        complianceHistory,
        peerCompliance
      );

      return {
        building_id: buildingId,
        current_score: complianceHistory[0]?.overall_score || 0,
        historical_trend: this.calculateTrend(complianceHistory),
        peer_comparison: benchmarks.peer_comparison,
        industry_percentile: benchmarks.industry_percentile,
        improvement_opportunities: benchmarks.improvement_opportunities,
        cost_benefit_analysis: benchmarks.cost_benefit_analysis,
        recommendations: benchmarks.recommendations,
      };
    } catch (error) {
      logger.error("Error generating benchmarking report:", error);
      throw error;
    }
  }

  /**
   * Automated compliance gap analysis
   */
  public async performGapAnalysis(
    auditId: number,
    targetStandards: StandardType[]
  ): Promise<GapAnalysisResult> {
    try {
      const context = await this.buildComplianceContext(auditId);
      const gaps: StandardGaps[] = [];

      for (const standard of targetStandards) {
        const rules = this.getRulesForStandard(standard);
        const standardGaps: ComplianceGap[] = [];

        for (const rule of rules) {
          if (rule.automated_check && rule.check_function) {
            const result = rule.check_function(context, context);
            if (!result.compliant) {
              standardGaps.push({
                rule_id: rule.rule_id,
                section_code: rule.section_code,
                title: rule.title,
                current_compliance: result.actual_value,
                required_compliance: result.required_value,
                gap_magnitude: result.deviation,
                estimated_cost: result.estimated_cost,
                priority: result.priority || "medium",
                corrective_actions: result.corrective_actions,
                timeline: this.estimateImplementationTimeline(rule, result),
              });
            }
          }
        }

        gaps.push({
          standard: standard,
          gaps: standardGaps,
          overall_compliance_percentage: this.calculateStandardCompliance(
            standardGaps,
            rules.length
          ),
          priority_actions: standardGaps.filter(
            (g) => g.priority === "critical" || g.priority === "high"
          ),
        });
      }

      return {
        audit_id: auditId,
        analysis_date: new Date(),
        standards_analyzed: targetStandards,
        compliance_gaps: gaps,
        total_estimated_cost: gaps.reduce(
          (sum, std) =>
            sum +
            std.gaps.reduce(
              (gapSum: number, gap: ComplianceGap) =>
                gapSum + (gap.estimated_cost || 0),
              0
            ),
          0
        ),
        implementation_roadmap: this.generateImplementationRoadmap(gaps),
      };
    } catch (error) {
      logger.error("Error performing gap analysis:", error);
      throw error;
    }
  }

  // Private helper methods

  private async buildComplianceContext(
    auditId: number
  ): Promise<ComplianceContext> {
    // Get audit and building information
    const audit = await database.queryOne(
      "SELECT * FROM audits a JOIN buildings b ON a.building_id = b.id WHERE a.id = ?",
      [auditId]
    );

    if (!audit) {
      throw new Error("Audit not found");
    }

    // Get equipment data
    const equipment = await database.query(
      "SELECT * FROM equipment WHERE building_id = ?",
      [audit.building_id]
    );

    // Get energy consumption data
    const energyData = await database.query(
      `SELECT * FROM energy_consumption 
       WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)`,
      [audit.building_id]
    );

    // Get power quality data
    const powerQualityData = await database.query(
      `SELECT * FROM power_quality 
       WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)`,
      [audit.building_id]
    );

    // Get maintenance records
    const maintenanceRecords = await database.query(
      `SELECT em.*, e.name as equipment_name 
       FROM equipment_maintenance em 
       JOIN equipment e ON em.equipment_id = e.id 
       WHERE e.building_id = ?`,
      [audit.building_id]
    );

    // Get audit history
    const auditHistory = await database.query(
      `SELECT * FROM audits 
       WHERE building_id = ? AND status = 'completed'
       ORDER BY completed_date DESC`,
      [audit.building_id]
    );

    return {
      building_data: audit,
      equipment_data: equipment,
      energy_data: energyData,
      power_quality_data: powerQualityData,
      maintenance_records: maintenanceRecords,
      audit_history: auditHistory,
    };
  }

  private async buildBuildingComplianceContext(
    buildingId: number
  ): Promise<ComplianceContext> {
    // Similar to buildComplianceContext but for a building rather than specific audit
    const building = await database.queryOne(
      "SELECT * FROM buildings WHERE id = ?",
      [buildingId]
    );

    if (!building) {
      throw new Error("Building not found");
    }

    return {
      building_data: building,
      equipment_data: await database.query(
        "SELECT * FROM equipment WHERE building_id = ?",
        [buildingId]
      ),
      energy_data: await database.query(
        `SELECT * FROM energy_consumption 
         WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [buildingId]
      ),
      power_quality_data: await database.query(
        `SELECT * FROM power_quality 
         WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [buildingId]
      ),
      maintenance_records: [],
      audit_history: [],
    };
  }

  private async runStandardChecks(
    standard: StandardType,
    context: ComplianceContext,
    auditId: number
  ): Promise<any[]> {
    const rules = this.getRulesForStandard(standard);
    const results = [];

    for (const rule of rules) {
      if (rule.automated_check && rule.check_function) {
        try {
          const checkResult = rule.check_function(context, context);

          // Store compliance check result
          await database.query(
            `INSERT INTO compliance_checks 
             (audit_id, standard_type, section_code, check_description, status, severity, 
              details, corrective_action, due_date, responsible_person)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              auditId,
              standard,
              rule.section_code,
              rule.description,
              checkResult.compliant
                ? ComplianceStatus.COMPLIANT
                : ComplianceStatus.NON_COMPLIANT,
              rule.severity,
              JSON.stringify({
                actual_value: checkResult.actual_value,
                required_value: checkResult.required_value,
                deviation: checkResult.deviation,
                confidence_score: checkResult.confidence_score,
              }),
              JSON.stringify(checkResult.corrective_actions),
              checkResult.priority === "critical"
                ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                : null,
              null,
            ]
          );

          results.push({
            rule,
            result: checkResult,
            standard,
          });
        } catch (error) {
          logger.error(`Error checking rule ${rule.rule_id}:`, error);
        }
      }
    }

    return results;
  }

  private getRulesForStandard(standard: StandardType): ComplianceRule[] {
    switch (standard) {
      case StandardType.PEC2017:
        return this.pec2017Rules;
      case StandardType.OSHS:
        return this.oshsRules;
      case StandardType.RA11285:
        return this.ra11285Rules;
      default:
        return [];
    }
  }

  private calculateComplianceAnalysis(results: any[], auditId: number): any {
    const totalChecks = results.length;
    const compliantChecks = results.filter((r) => r.result.compliant).length;
    const violations = results.filter((r) => !r.result.compliant);

    const violationsBySeverity = {
      critical: violations.filter((v) => v.rule.severity === "critical").length,
      high: violations.filter((v) => v.rule.severity === "high").length,
      medium: violations.filter((v) => v.rule.severity === "medium").length,
      low: violations.filter((v) => v.rule.severity === "low").length,
    };

    const overallScore =
      totalChecks > 0 ? (compliantChecks / totalChecks) * 100 : 0;
    const weightedScore = this.calculateWeightedScore(results);

    return {
      audit_id: auditId,
      analysis_date: new Date(),
      overall_score: Math.round(overallScore),
      weighted_score: Math.round(weightedScore),
      critical_violations: violationsBySeverity.critical,
      high_violations: violationsBySeverity.high,
      medium_violations: violationsBySeverity.medium,
      low_violations: violationsBySeverity.low,
      improvement_trend: 0, // Would need historical data
      risk_assessment: this.assessRiskLevel(violationsBySeverity),
      priority_actions: this.extractPriorityActions(violations),
      compliance_gaps: this.identifyComplianceGaps(violations),
      cost_of_compliance: this.calculateComplianceCost(violations),
      estimated_penalties: this.estimatePotentialPenalties(violations),
      metadata: { total_rules_checked: totalChecks, automation_coverage: 100 },
    };
  }

  private calculateWeightedScore(results: any[]): number {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    let totalWeight = 0;
    let achievedWeight = 0;

    results.forEach((result) => {
      const weight = weights[result.rule.severity as keyof typeof weights] || 1;
      totalWeight += weight;
      if (result.result.compliant) {
        achievedWeight += weight;
      }
    });

    return totalWeight > 0 ? (achievedWeight / totalWeight) * 100 : 0;
  }

  private assessRiskLevel(
    violations: any
  ): "low" | "medium" | "high" | "critical" {
    if (violations.critical > 0) return "critical";
    if (violations.high > 2) return "high";
    if (violations.high > 0 || violations.medium > 5) return "medium";
    return "low";
  }

  private extractPriorityActions(violations: any[]): string[] {
    return violations
      .filter(
        (v) => v.rule.severity === "critical" || v.rule.severity === "high"
      )
      .flatMap((v) => v.result.corrective_actions || [])
      .slice(0, 10); // Top 10 priority actions
  }

  private identifyComplianceGaps(violations: any[]): Record<string, any> {
    const gaps: Record<string, any> = {};

    violations.forEach((violation) => {
      const standard = violation.standard;
      if (!gaps[standard]) {
        gaps[standard] = {
          total_violations: 0,
          critical_violations: 0,
          estimated_cost: 0,
          key_issues: [],
        };
      }

      gaps[standard].total_violations++;
      if (violation.rule.severity === "critical") {
        gaps[standard].critical_violations++;
      }
      gaps[standard].estimated_cost += violation.result.estimated_cost || 0;
      if (violation.result.corrective_actions?.length > 0) {
        gaps[standard].key_issues.push(...violation.result.corrective_actions);
      }
    });

    return gaps;
  }

  private calculateComplianceCost(violations: any[]): number {
    return violations.reduce((total, violation) => {
      return total + (violation.result.estimated_cost || 0);
    }, 0);
  }

  private estimatePotentialPenalties(violations: any[]): number {
    // Simplified penalty estimation based on severity
    const penaltyRates = {
      critical: 50000,
      high: 25000,
      medium: 10000,
      low: 5000,
    };

    return violations.reduce((total, violation) => {
      const rate =
        penaltyRates[violation.rule.severity as keyof typeof penaltyRates] || 0;
      return total + rate;
    }, 0);
  }

  private async storeComplianceAnalysis(
    analysis: any
  ): Promise<IComplianceAnalysis> {
    const result = await database.query(
      `INSERT INTO compliance_analyses 
       (audit_id, analysis_date, overall_score, weighted_score, critical_violations,
        high_violations, medium_violations, low_violations, improvement_trend,
        risk_assessment, priority_actions, compliance_gaps, cost_of_compliance,
        estimated_penalties, certification_status, next_review_date, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        analysis.audit_id,
        analysis.analysis_date,
        analysis.overall_score,
        analysis.weighted_score,
        analysis.critical_violations,
        analysis.high_violations,
        analysis.medium_violations,
        analysis.low_violations,
        analysis.improvement_trend,
        analysis.risk_assessment,
        JSON.stringify(analysis.priority_actions),
        JSON.stringify(analysis.compliance_gaps),
        analysis.cost_of_compliance,
        analysis.estimated_penalties,
        null, // certification_status
        null, // next_review_date
        JSON.stringify(analysis.metadata),
      ]
    );

    const analysisId = (result as any).insertId;
    const storedAnalysis = await database.queryOne<IComplianceAnalysis>(
      "SELECT * FROM compliance_analyses WHERE id = ?",
      [analysisId]
    );

    return storedAnalysis!;
  }

  private async generateComplianceAlerts(
    results: any[],
    buildingId: number
  ): Promise<void> {
    for (const result of results) {
      if (
        !result.result.compliant &&
        (result.rule.severity === "critical" || result.rule.severity === "high")
      ) {
        await alertService.createAlert({
          type: AlertType.COMPLIANCE_VIOLATION,
          severity:
            result.rule.severity === "critical"
              ? AlertSeverity.CRITICAL
              : AlertSeverity.HIGH,
          title: `Compliance Violation: ${result.rule.title}`,
          message: `${result.rule.description} - Immediate action required`,
          building_id: buildingId,
          metadata: {
            standard: result.standard,
            rule_id: result.rule.rule_id,
            section_code: result.rule.section_code,
            compliance_result: result.result,
          },
        });
      }
    }
  }

  private async checkEnergyCompliance(
    data: any,
    context: ComplianceContext
  ): Promise<any[]> {
    // Implementation for real-time energy compliance monitoring
    return [];
  }

  private async checkPowerQualityCompliance(
    data: any,
    context: ComplianceContext
  ): Promise<any[]> {
    // Implementation for real-time power quality compliance monitoring
    return [];
  }

  private mapSeverityToAlert(severity: string): AlertSeverity {
    switch (severity) {
      case "critical":
        return AlertSeverity.CRITICAL;
      case "high":
        return AlertSeverity.HIGH;
      case "medium":
        return AlertSeverity.MEDIUM;
      default:
        return AlertSeverity.LOW;
    }
  }

  private async findPeerBuildings(buildingId: number): Promise<number[]> {
    // Find similar buildings for benchmarking
    const building = await database.queryOne(
      "SELECT building_type, area_sqm FROM buildings WHERE id = ?",
      [buildingId]
    );

    if (!building) return [];

    const peers = await database.query(
      `SELECT id FROM buildings 
       WHERE building_type = ? 
       AND area_sqm BETWEEN ? AND ?
       AND id != ?
       AND status = 'active'`,
      [
        building.building_type,
        building.area_sqm * 0.8,
        building.area_sqm * 1.2,
        buildingId,
      ]
    );

    return peers.map((p: any) => p.id);
  }

  private async getPeerComplianceData(
    peerBuildingIds: number[]
  ): Promise<any[]> {
    if (peerBuildingIds.length === 0) return [];

    const peerData = await database.query(
      `SELECT ca.* FROM compliance_analyses ca
       JOIN audits a ON ca.audit_id = a.id
       WHERE a.building_id IN (${peerBuildingIds.map(() => "?").join(",")})
       AND ca.analysis_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)`,
      peerBuildingIds
    );

    return peerData;
  }

  private calculateComplianceBenchmarks(
    history: any[],
    peerData: any[]
  ): ComplianceBenchmarks {
    const currentScore = history[0]?.overall_score || 0;
    const peerScores = peerData.map((p) => p.overall_score);
    const avgPeerScore =
      peerScores.length > 0
        ? peerScores.reduce((a, b) => a + b, 0) / peerScores.length
        : 0;

    return {
      peer_comparison: {
        current_score: currentScore,
        peer_average: avgPeerScore,
        ranking_percentile: this.calculatePercentile(currentScore, peerScores),
      },
      industry_percentile: this.calculateIndustryPercentile(currentScore),
      improvement_opportunities: this.identifyImprovementOpportunities(history),
      cost_benefit_analysis: this.performCostBenefitAnalysis(history),
      recommendations: this.generateBenchmarkingRecommendations(
        currentScore,
        avgPeerScore
      ),
    };
  }

  private calculatePercentile(score: number, peerScores: number[]): number {
    if (peerScores.length === 0) return 50;
    const lowerScores = peerScores.filter((s) => s < score).length;
    return Math.round((lowerScores / peerScores.length) * 100);
  }

  private calculateIndustryPercentile(score: number): number {
    // Simplified industry benchmarking
    if (score >= 90) return 95;
    if (score >= 80) return 80;
    if (score >= 70) return 60;
    if (score >= 60) return 40;
    return 20;
  }

  private identifyImprovementOpportunities(history: any[]): string[] {
    // Analyze historical trends to identify improvement opportunities
    return [
      "Implement automated monitoring systems",
      "Establish regular compliance review cycles",
      "Invest in staff training programs",
    ];
  }

  private performCostBenefitAnalysis(
    history: any[]
  ): ComplianceBenchmarks["cost_benefit_analysis"] {
    return {
      estimated_investment: 100000,
      projected_savings: 50000,
      payback_period_months: 24,
      risk_reduction_value: 75000,
    };
  }

  private generateBenchmarkingRecommendations(
    currentScore: number,
    peerAverage: number
  ): string[] {
    const recommendations = [];

    if (currentScore < peerAverage) {
      recommendations.push(
        "Focus on critical compliance gaps to match peer performance"
      );
      recommendations.push(
        "Implement best practices from top-performing peer buildings"
      );
    } else {
      recommendations.push("Maintain current compliance standards");
      recommendations.push("Share best practices with industry peers");
    }

    return recommendations;
  }

  private calculateTrend(history: any[]): number {
    if (history.length < 2) return 0;
    const recent = history[0].overall_score;
    const previous = history[1].overall_score;
    return recent - previous;
  }

  private calculateStandardCompliance(
    gaps: ComplianceGap[],
    totalRules: number
  ): number {
    const compliantRules = totalRules - gaps.length;
    return totalRules > 0 ? (compliantRules / totalRules) * 100 : 0;
  }

  private estimateImplementationTimeline(
    rule: ComplianceRule,
    result: ComplianceCheckResult
  ): string {
    if (result.priority === "critical") return "1-2 weeks";
    if (result.priority === "high") return "1-2 months";
    if (result.priority === "medium") return "3-6 months";
    return "6-12 months";
  }

  private generateImplementationRoadmap(
    gaps: StandardGaps[]
  ): ImplementationRoadmap {
    // Create prioritized implementation roadmap
    const roadmap: ImplementationRoadmap = {
      immediate: [], // 0-30 days
      short_term: [], // 1-6 months
      medium_term: [], // 6-12 months
      long_term: [], // 12+ months
    };

    gaps.forEach((standardGaps) => {
      standardGaps.gaps.forEach((gap: ComplianceGap) => {
        if (gap.priority === "critical") {
          roadmap.immediate.push(gap);
        } else if (gap.priority === "high") {
          roadmap.short_term.push(gap);
        } else if (gap.priority === "medium") {
          roadmap.medium_term.push(gap);
        } else {
          roadmap.long_term.push(gap);
        }
      });
    });

    return roadmap;
  }

  /**
   * Get compliance report for an audit
   */
  public async getComplianceReport(auditId: number): Promise<any> {
    try {
      // Get all compliance checks for the audit
      const checks = await database.query(
        `SELECT cc.*, a.building_id, b.name as building_name 
         FROM compliance_checks cc
         JOIN audits a ON cc.audit_id = a.id
         JOIN buildings b ON a.building_id = b.id
         WHERE cc.audit_id = ?
         ORDER BY cc.standard_type, cc.section_code`,
        [auditId]
      );

      if (checks.length === 0) {
        throw new Error("No compliance checks found for this audit");
      }

      // Calculate summary statistics
      const totalChecks = checks.length;
      const compliantChecks = checks.filter(
        (c) => c.status === "compliant"
      ).length;
      const nonCompliantChecks = checks.filter(
        (c) => c.status === "non_compliant"
      ).length;
      const needsReviewChecks = checks.filter(
        (c) => c.status === "needs_review"
      ).length;
      const criticalIssues = checks.filter(
        (c) => c.severity === "critical" && c.status === "non_compliant"
      ).length;
      const highIssues = checks.filter(
        (c) => c.severity === "high" && c.status === "non_compliant"
      ).length;

      // Group by standard
      const byStandard = checks.reduce((acc: any, check: any) => {
        if (!acc[check.standard_type]) {
          acc[check.standard_type] = {
            standard_type: check.standard_type,
            total_checks: 0,
            compliant_checks: 0,
            compliance_percentage: 0,
          };
        }
        acc[check.standard_type].total_checks++;
        if (check.status === "compliant") {
          acc[check.standard_type].compliant_checks++;
        }
        return acc;
      }, {});

      // Calculate compliance percentages
      Object.values(byStandard).forEach((standard: any) => {
        standard.compliance_percentage =
          standard.total_checks > 0
            ? Math.round(
                (standard.compliant_checks / standard.total_checks) * 100
              )
            : 0;
      });

      const criticalIssuesList = checks.filter(
        (c) => c.severity === "critical" && c.status === "non_compliant"
      );

      const complianceScore =
        totalChecks > 0 ? Math.round((compliantChecks / totalChecks) * 100) : 0;

      return {
        audit_id: auditId,
        building_name: checks[0]?.building_name || "Unknown",
        summary: {
          total_checks: totalChecks,
          compliant_checks: compliantChecks,
          non_compliant_checks: nonCompliantChecks,
          needs_review_checks: needsReviewChecks,
          critical_issues: criticalIssues,
          high_issues: highIssues,
        },
        by_standard: Object.values(byStandard),
        critical_issues: criticalIssuesList,
        compliance_score: complianceScore,
        all_checks: checks,
      };
    } catch (error) {
      logger.error("Error generating compliance report:", error);
      throw error;
    }
  }

  /**
   * Get compliance trends for a building
   */
  public async getComplianceTrends(
    buildingId: string,
    days: number = 90
  ): Promise<any[]> {
    try {
      const trends = await database.query(
        `SELECT 
          DATE(ca.analysis_date) as date,
          AVG(ca.overall_score) as avg_compliance_score,
          COUNT(DISTINCT a.id) as audits_completed
         FROM compliance_analyses ca
         JOIN audits a ON ca.audit_id = a.id
         WHERE a.building_id = ? 
         AND ca.analysis_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(ca.analysis_date)
         ORDER BY date DESC`,
        [buildingId, days]
      );

      return trends.map((trend: any) => ({
        date: trend.date,
        avg_compliance_score: Math.round(trend.avg_compliance_score || 0),
        audits_completed: trend.audits_completed || 0,
      }));
    } catch (error) {
      logger.error("Error getting compliance trends:", error);
      throw error;
    }
  }

  /**
   * Perform a single compliance check
   */
  public async performComplianceCheck(
    auditId: number,
    standardType: string,
    checkData: any
  ): Promise<any[]> {
    try {
      // Get audit context
      const audit = await database.queryOne(
        "SELECT * FROM audits WHERE id = ?",
        [auditId]
      );

      if (!audit) {
        throw new Error("Audit not found");
      }

      // Get the appropriate rules for the standard
      const rules = this.getRulesForStandard(standardType as any);

      if (rules.length === 0) {
        throw new Error(`No rules found for standard: ${standardType}`);
      }

      const results = [];

      // If specific check data is provided, run targeted checks
      if (checkData.rule_id) {
        const rule = rules.find((r) => r.rule_id === checkData.rule_id);
        if (rule && rule.automated_check && rule.check_function) {
          const result = rule.check_function(checkData, { audit });

          // Store the check result
          await database.query(
            `INSERT INTO compliance_checks 
             (audit_id, standard_type, section_code, check_description, status, severity, 
              details, corrective_action, responsible_person)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              auditId,
              standardType,
              rule.section_code,
              rule.description,
              result.compliant ? "compliant" : "non_compliant",
              rule.severity,
              JSON.stringify({
                actual_value: result.actual_value,
                required_value: result.required_value,
                deviation: result.deviation,
                confidence_score: result.confidence_score,
              }),
              JSON.stringify(result.corrective_actions || []),
              checkData.responsible_person || null,
            ]
          );

          results.push({
            rule_id: rule.rule_id,
            section_code: rule.section_code,
            title: rule.title,
            compliant: result.compliant,
            result: result,
          });
        }
      } else {
        // Run all automated checks for the standard
        for (const rule of rules.filter(
          (r) => r.automated_check && r.check_function
        )) {
          try {
            const result = rule.check_function!(checkData, { audit });

            // Store the check result
            await database.query(
              `INSERT INTO compliance_checks 
               (audit_id, standard_type, section_code, check_description, status, severity, 
                details, corrective_action, responsible_person)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                auditId,
                standardType,
                rule.section_code,
                rule.description,
                result.compliant ? "compliant" : "non_compliant",
                rule.severity,
                JSON.stringify({
                  actual_value: result.actual_value,
                  required_value: result.required_value,
                  deviation: result.deviation,
                  confidence_score: result.confidence_score,
                }),
                JSON.stringify(result.corrective_actions || []),
                checkData.responsible_person || null,
              ]
            );

            results.push({
              rule_id: rule.rule_id,
              section_code: rule.section_code,
              title: rule.title,
              compliant: result.compliant,
              result: result,
            });
          } catch (error) {
            logger.error(`Error checking rule ${rule.rule_id}:`, error);
          }
        }
      }

      return results;
    } catch (error) {
      logger.error("Error performing compliance check:", error);
      throw error;
    }
  }
}

export default new EnhancedComplianceService();
