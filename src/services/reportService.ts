// reportService.ts - Updated with Comprehensive Energy Audit Report
import { database } from "@/config/database";
import { IReport } from "@/interfaces/IReport";
import { ReportType, ReportStatus } from "@/types/enums";
import { logger } from "@/utils/logger";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

// Import autotable and handle TypeScript
require("jspdf-autotable");

// Type definitions for jsPDF with autotable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: {
      startY?: number;
      head?: any[][];
      body?: any[][];
      styles?: any;
      headStyles?: any;
      columnStyles?: any;
      margin?: any;
      tableWidth?: string | number;
    }) => jsPDF;
    lastAutoTable?: {
      finalY: number;
    };
  }
}

interface ReportParams {
  buildingId?: number;
  auditId?: number;
  startDate?: string;
  endDate?: string;
  title: string;
  generatedBy: number;
  includeCompliance?: boolean;
  includeRecommendations?: boolean;
}

// Enhanced interfaces for comprehensive energy audit reports
interface EnergyConservationOpportunity {
  id: string;
  description: string;
  location: string;
  category:
    | "lighting"
    | "hvac"
    | "motors"
    | "building_envelope"
    | "controls"
    | "power_quality"
    | "other";
  annual_energy_savings_kwh: number;
  annual_cost_savings_php: number;
  implementation_cost_php: number;
  simple_payback_years: number;
  npv_php?: number;
  irr_percentage?: number;
  co2_reduction_kg: number;
  priority: "high" | "medium" | "low";
  implementation_complexity: "simple" | "moderate" | "complex";
  estimated_implementation_months: number;
}

interface AuditReportData {
  audit: any;
  building: any;
  auditor: any;
  equipment_list: any[];
  energy_data: any[];
  power_quality_data: any[];
  compliance_checks: any[];
  utility_bills: any[];
  ecos: EnergyConservationOpportunity[];
  baseline_consumption: number;
  baseline_cost: number;
  facility_hours_per_year: number;
}

class ReportService {
  private reportsDir = path.join(process.cwd(), "reports");

  constructor() {
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  public async generateEnergyConsumptionReport(
    params: ReportParams
  ): Promise<IReport> {
    try {
      // Create report record
      const reportId = await this.createReportRecord(
        ReportType.ENERGY_CONSUMPTION,
        params
      );

      // Get energy data
      const conditions = [];
      const queryParams: any[] = [];

      if (params.buildingId) {
        conditions.push("ec.building_id = ?");
        queryParams.push(params.buildingId);
      }

      if (params.startDate) {
        conditions.push("ec.recorded_at >= ?");
        queryParams.push(params.startDate);
      }

      if (params.endDate) {
        conditions.push("ec.recorded_at <= ?");
        queryParams.push(params.endDate);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const energyData = await database.query(
        `SELECT 
          ec.*,
          b.name as building_name,
          b.code as building_code
        FROM energy_consumption ec
        LEFT JOIN buildings b ON ec.building_id = b.id
        ${whereClause}
        ORDER BY ec.recorded_at DESC`,
        queryParams
      );

      // Generate PDF
      const fileName = `energy-report-${reportId}-${Date.now()}.pdf`;
      const filePath = path.join(this.reportsDir, fileName);

      await this.generateEnergyPDF(energyData, filePath, params);

      // Update report record
      await this.updateReportRecord(reportId, {
        file_path: filePath,
        file_name: fileName,
        file_size: fs.statSync(filePath).size,
        status: ReportStatus.COMPLETED,
        data: { total_records: energyData.length },
      });

      return await this.getReportById(reportId);
    } catch (error) {
      logger.error("Error generating energy consumption report:", error);
      throw error;
    }
  }

  public async generatePowerQualityReport(
    params: ReportParams
  ): Promise<IReport> {
    try {
      const reportId = await this.createReportRecord(
        ReportType.POWER_QUALITY,
        params
      );

      // Get power quality data
      const conditions = ["pq.building_id = ?"];
      const queryParams: any[] = [params.buildingId];

      if (params.startDate) {
        conditions.push("pq.recorded_at >= ?");
        queryParams.push(params.startDate);
      }

      if (params.endDate) {
        conditions.push("pq.recorded_at <= ?");
        queryParams.push(params.endDate);
      }

      const pqData = await database.query(
        `SELECT 
          pq.*,
          b.name as building_name,
          b.code as building_code
        FROM power_quality pq
        LEFT JOIN buildings b ON pq.building_id = b.id
        WHERE ${conditions.join(" AND ")}
        ORDER BY pq.recorded_at DESC`,
        queryParams
      );

      // Generate PDF
      const fileName = `pq-report-${reportId}-${Date.now()}.pdf`;
      const filePath = path.join(this.reportsDir, fileName);

      await this.generatePowerQualityPDF(pqData, filePath, params);

      // Update report record
      await this.updateReportRecord(reportId, {
        file_path: filePath,
        file_name: fileName,
        file_size: fs.statSync(filePath).size,
        status: ReportStatus.COMPLETED,
        data: { total_records: pqData.length },
      });

      return await this.getReportById(reportId);
    } catch (error) {
      logger.error("Error generating power quality report:", error);
      throw error;
    }
  }

  /**
   * UPDATED: Comprehensive Energy Audit Report Generator
   * Replaces the old basic audit summary with professional energy audit report
   */
  public async generateAuditSummaryReport(
    params: ReportParams
  ): Promise<IReport> {
    try {
      const reportId = await this.createReportRecord(
        ReportType.AUDIT_SUMMARY,
        params
      );

      logger.info(
        `Starting comprehensive energy audit report generation for audit ID: ${params.auditId}`
      );

      // Gather comprehensive audit data
      const auditData = await this.gatherComprehensiveAuditData(
        params.auditId!
      );

      // Generate Energy Conservation Opportunities (ECOs)
      const ecos = await this.generateECOs(auditData);
      auditData.ecos = ecos;

      // Generate comprehensive PDF report
      const fileName = `comprehensive-energy-audit-report-${reportId}-${Date.now()}.pdf`;
      const filePath = path.join(this.reportsDir, fileName);

      await this.generateComprehensiveEnergyAuditPDF(
        auditData,
        filePath,
        params
      );

      // Update report record with comprehensive data
      await this.updateReportRecord(reportId, {
        file_path: filePath,
        file_name: fileName,
        file_size: fs.statSync(filePath).size,
        status: ReportStatus.COMPLETED,
        data: {
          audit_id: params.auditId,
          compliance_checks_count: auditData.compliance_checks.length,
          total_ecos: ecos.length,
          total_annual_savings_php: ecos.reduce(
            (sum, eco) => sum + eco.annual_cost_savings_php,
            0
          ),
          total_implementation_cost_php: ecos.reduce(
            (sum, eco) => sum + eco.implementation_cost_php,
            0
          ),
          average_payback_years:
            ecos.length > 0
              ? ecos.reduce((sum, eco) => sum + eco.simple_payback_years, 0) /
                ecos.length
              : 0,
          baseline_consumption_kwh: auditData.baseline_consumption,
          baseline_cost_php: auditData.baseline_cost,
        },
      });

      logger.info(
        `Comprehensive energy audit report generated successfully: ${fileName}`
      );
      return await this.getReportById(reportId);
    } catch (error) {
      logger.error(
        "Error generating comprehensive energy audit report:",
        error
      );
      throw error;
    }
  }

  /**
   * Gather comprehensive audit data from all related tables
   */
  private async gatherComprehensiveAuditData(
    auditId: number
  ): Promise<AuditReportData> {
    // Get audit details with building and auditor information
    const audit = await database.queryOne(
      `SELECT a.*, b.*, u.first_name, u.last_name, u.email,
              b.name as building_name, b.address, b.area_sqm, b.floors, 
              b.occupancy_type, b.construction_year, b.operating_hours_per_day,
              b.operating_days_per_week, b.operating_weeks_per_year
       FROM audits a
       JOIN buildings b ON a.building_id = b.id
       JOIN users u ON a.auditor_id = u.id
       WHERE a.id = ?`,
      [auditId]
    );

    if (!audit) {
      throw new Error("Audit not found");
    }

    // Calculate facility operating hours per year
    const facility_hours_per_year =
      (audit.operating_hours_per_day || 12) *
      (audit.operating_days_per_week || 6) *
      (audit.operating_weeks_per_year || 50);

    // Get equipment list with specifications
    const equipment_list = await database.query(
      `SELECT e.*, et.name as equipment_type_name, et.category
       FROM equipment e
       LEFT JOIN equipment_types et ON e.equipment_type_id = et.id
       WHERE e.building_id = ?`,
      [audit.building_id]
    );

    // Get recent energy consumption data (last 12 months)
    const energy_data = await database.query(
      `SELECT * FROM energy_consumption 
       WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       ORDER BY recorded_at DESC`,
      [audit.building_id]
    );

    // Get power quality data
    const power_quality_data = await database.query(
      `SELECT * FROM power_quality 
       WHERE building_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       ORDER BY recorded_at DESC`,
      [audit.building_id]
    );

    // Get compliance checks
    const compliance_checks = await database.query(
      `SELECT * FROM compliance_checks WHERE audit_id = ?`,
      [auditId]
    );

    // Get utility bills
    const utility_bills = await database.query(
      `SELECT * FROM utility_bills 
       WHERE building_id = ? AND bill_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       ORDER BY bill_date DESC`,
      [audit.building_id]
    );

    // Calculate baseline consumption and cost
    const baseline_consumption = energy_data.reduce(
      (sum, record) => sum + (record.consumption_kwh || 0),
      0
    );
    const baseline_cost = energy_data.reduce(
      (sum, record) => sum + (record.cost_php || 0),
      0
    );

    // Enhanced energy data with additional metrics
    const enhanced_energy_data = energy_data.map((record) => ({
      ...record,
      cost_per_kwh:
        record.consumption_kwh > 0
          ? record.cost_php / record.consumption_kwh
          : 0,
    }));

    return {
      audit,
      building: audit,
      auditor: {
        name: `${audit.first_name} ${audit.last_name}`,
        email: audit.email,
      },
      equipment_list,
      energy_data: enhanced_energy_data,
      power_quality_data,
      compliance_checks,
      utility_bills,
      ecos: [], // Will be populated by generateECOs
      baseline_consumption,
      baseline_cost,
      facility_hours_per_year,
    };
  }

  /**
   * Generate Energy Conservation Opportunities based on comprehensive analysis
   */
  private async generateECOs(
    auditData: AuditReportData
  ): Promise<EnergyConservationOpportunity[]> {
    const ecos: EnergyConservationOpportunity[] = [];
    let ecoCounter = 1;

    // Analyze lighting opportunities
    const lightingEquipment = auditData.equipment_list.filter(
      (eq) =>
        eq.equipment_type_name?.toLowerCase().includes("light") ||
        eq.name?.toLowerCase().includes("light") ||
        eq.equipment_type_name?.toLowerCase().includes("fluorescent") ||
        eq.equipment_type_name?.toLowerCase().includes("incandescent")
    );

    if (lightingEquipment.length > 0) {
      const totalLightingPower = lightingEquipment.reduce(
        (sum, eq) => sum + (eq.rated_power || 100),
        0
      );
      const annualHours = auditData.facility_hours_per_year;
      const energySavings = (totalLightingPower * annualHours * 0.5) / 1000; // 50% savings
      const costSavings = energySavings * 8.5; // ₱8.5/kWh
      const implementationCost = lightingEquipment.length * 2500; // ₱2,500 per fixture

      ecos.push({
        id: `ECO-${String(ecoCounter++).padStart(3, "0")}`,
        description:
          "LED Lighting Retrofit - Replace existing fluorescent and incandescent lighting with high-efficiency LED fixtures",
        location: "Throughout facility - all lighting areas",
        category: "lighting",
        annual_energy_savings_kwh: energySavings,
        annual_cost_savings_php: costSavings,
        implementation_cost_php: implementationCost,
        simple_payback_years: implementationCost / costSavings,
        co2_reduction_kg: energySavings * 0.92, // kg CO2 per kWh
        priority: "high",
        implementation_complexity: "simple",
        estimated_implementation_months: 2,
      });
    }

    // Analyze HVAC opportunities
    const hvacEquipment = auditData.equipment_list.filter(
      (eq) =>
        eq.equipment_type_name?.toLowerCase().includes("hvac") ||
        eq.equipment_type_name?.toLowerCase().includes("air") ||
        eq.equipment_type_name?.toLowerCase().includes("cooling") ||
        eq.name?.toLowerCase().includes("aircond") ||
        eq.name?.toLowerCase().includes("chiller")
    );

    if (hvacEquipment.length > 0) {
      const totalHVACPower = hvacEquipment.reduce(
        (sum, eq) => sum + (eq.rated_power || 5000),
        0
      );
      const energySavings =
        (totalHVACPower * auditData.facility_hours_per_year * 0.15) / 1000; // 15% savings
      const costSavings = energySavings * 8.5;
      const implementationCost = hvacEquipment.length * 15000; // ₱15,000 per unit

      ecos.push({
        id: `ECO-${String(ecoCounter++).padStart(3, "0")}`,
        description:
          "HVAC System Optimization - Install programmable thermostats, optimize scheduling, and improve controls",
        location: "HVAC systems and control rooms",
        category: "hvac",
        annual_energy_savings_kwh: energySavings,
        annual_cost_savings_php: costSavings,
        implementation_cost_php: implementationCost,
        simple_payback_years: implementationCost / costSavings,
        co2_reduction_kg: energySavings * 0.92,
        priority: "high",
        implementation_complexity: "moderate",
        estimated_implementation_months: 3,
      });
    }

    // Analyze power factor correction opportunities
    if (auditData.power_quality_data.length > 0) {
      const avgPowerFactor =
        auditData.power_quality_data.reduce(
          (sum, pq) => sum + (pq.power_factor || 0.85),
          0
        ) / auditData.power_quality_data.length;

      if (avgPowerFactor < 0.95) {
        const totalDemand = auditData.energy_data.reduce(
          (sum, ed) => Math.max(sum, ed.demand_kw || 0),
          0
        );
        const penaltyCost = totalDemand * 50 * 12; // ₱50/kW penalty per month
        const implementationCost = totalDemand * 1500; // ₱1,500 per kW

        ecos.push({
          id: `ECO-${String(ecoCounter++).padStart(3, "0")}`,
          description:
            "Power Factor Correction - Install capacitor banks to improve power factor to >0.95 and eliminate utility penalties",
          location: "Main electrical panels and distribution boards",
          category: "power_quality",
          annual_energy_savings_kwh: 0, // No energy savings, but cost savings from penalty elimination
          annual_cost_savings_php: penaltyCost,
          implementation_cost_php: implementationCost,
          simple_payback_years: implementationCost / penaltyCost,
          co2_reduction_kg: 0,
          priority: avgPowerFactor < 0.9 ? "high" : "medium",
          implementation_complexity: "moderate",
          estimated_implementation_months: 2,
        });
      }
    }

    // Analyze building envelope opportunities
    if (
      auditData.building.construction_year &&
      auditData.building.construction_year < 2010
    ) {
      const envelopeSavings = auditData.baseline_consumption * 0.08; // 8% savings
      const costSavings = auditData.baseline_cost * 0.08;
      const implementationCost = auditData.building.area_sqm * 500; // ₱500 per sqm

      ecos.push({
        id: `ECO-${String(ecoCounter++).padStart(3, "0")}`,
        description:
          "Building Envelope Improvements - Install window films, improve insulation, and seal air leaks",
        location: "Building envelope - windows, walls, and roof",
        category: "building_envelope",
        annual_energy_savings_kwh: envelopeSavings,
        annual_cost_savings_php: costSavings,
        implementation_cost_php: implementationCost,
        simple_payback_years: implementationCost / costSavings,
        co2_reduction_kg: envelopeSavings * 0.92,
        priority: "medium",
        implementation_complexity: "complex",
        estimated_implementation_months: 6,
      });
    }

    // Analyze motor efficiency opportunities
    const motorEquipment = auditData.equipment_list.filter(
      (eq) =>
        eq.equipment_type_name?.toLowerCase().includes("motor") ||
        eq.equipment_type_name?.toLowerCase().includes("pump") ||
        eq.equipment_type_name?.toLowerCase().includes("fan") ||
        eq.name?.toLowerCase().includes("motor") ||
        eq.name?.toLowerCase().includes("pump")
    );

    if (motorEquipment.length > 0) {
      const totalMotorPower = motorEquipment.reduce(
        (sum, eq) => sum + (eq.rated_power || 1000),
        0
      );
      const energySavings =
        (totalMotorPower * auditData.facility_hours_per_year * 0.04) / 1000; // 4% savings
      const costSavings = energySavings * 8.5;
      const implementationCost = motorEquipment.length * 25000; // ₱25,000 per motor

      ecos.push({
        id: `ECO-${String(ecoCounter++).padStart(3, "0")}`,
        description:
          "High-Efficiency Motors - Replace standard motors with premium efficiency motors and variable frequency drives",
        location: "Motor-driven equipment throughout facility",
        category: "motors",
        annual_energy_savings_kwh: energySavings,
        annual_cost_savings_php: costSavings,
        implementation_cost_php: implementationCost,
        simple_payback_years: implementationCost / costSavings,
        co2_reduction_kg: energySavings * 0.92,
        priority: "medium",
        implementation_complexity: "moderate",
        estimated_implementation_months: 4,
      });
    }

    // Analyze energy management system opportunities
    const hasEMS = auditData.equipment_list.some(
      (eq) =>
        eq.equipment_type_name?.toLowerCase().includes("management") ||
        eq.equipment_type_name?.toLowerCase().includes("control") ||
        eq.name?.toLowerCase().includes("bms") ||
        eq.name?.toLowerCase().includes("ems")
    );

    if (!hasEMS && auditData.building.area_sqm > 1000) {
      const systemSavings = auditData.baseline_consumption * 0.12; // 12% savings
      const costSavings = auditData.baseline_cost * 0.12;
      const implementationCost = auditData.building.area_sqm * 200; // ₱200 per sqm

      ecos.push({
        id: `ECO-${String(ecoCounter++).padStart(3, "0")}`,
        description:
          "Energy Management System - Install comprehensive building automation and energy monitoring system",
        location: "Centralized control room with sensors throughout facility",
        category: "controls",
        annual_energy_savings_kwh: systemSavings,
        annual_cost_savings_php: costSavings,
        implementation_cost_php: implementationCost,
        simple_payback_years: implementationCost / costSavings,
        co2_reduction_kg: systemSavings * 0.92,
        priority: "medium",
        implementation_complexity: "complex",
        estimated_implementation_months: 8,
      });
    }

    // Sort ECOs by simple payback period (best opportunities first)
    return ecos.sort((a, b) => a.simple_payback_years - b.simple_payback_years);
  }

  /**
   * UPDATED: Generate Energy Audit PDF with Title Page + following EXACT user format
   * Includes professional title page + strictly follows the provided Energy Audit Report Format
   */
  private async generateComprehensiveEnergyAuditPDF(
    auditData: AuditReportData,
    filePath: string,
    params: ReportParams
  ): Promise<void> {
    const doc = new jsPDF();
    let currentPage = 1;
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 20;

    // Calculate these values once at the top to avoid redeclaration
    const totalSavings = auditData.ecos.reduce(
      (sum, eco) => sum + eco.annual_cost_savings_php,
      0
    );
    const totalImplementationCost = auditData.ecos.reduce(
      (sum, eco) => sum + eco.implementation_cost_php,
      0
    );
    const averagePayback =
      auditData.ecos.length > 0
        ? auditData.ecos.reduce(
            (sum, eco) => sum + eco.simple_payback_years,
            0
          ) / auditData.ecos.length
        : 0;

    // Create ECO table data once for reuse
    const ecoTableData = auditData.ecos.map((eco) => [
      eco.id,
      eco.description.substring(0, 35) +
        (eco.description.length > 35 ? "..." : ""),
      `₱${eco.annual_cost_savings_php.toLocaleString()}`,
      `₱${eco.implementation_cost_php.toLocaleString()}`,
      eco.simple_payback_years.toFixed(1),
      eco.priority.toUpperCase(),
    ]);

    // Helper functions
    const addNewPage = () => {
      doc.addPage();
      currentPage++;
      yPosition = 20;
    };

    const checkPageBreak = (neededSpace: number = 20) => {
      if (yPosition + neededSpace > pageHeight - 20) {
        addNewPage();
      }
    };

    // 1. TITLE PAGE
    doc.setFontSize(24);
    doc.text("ENERGY AUDIT REPORT", 105, 60, { align: "center" });

    doc.setFontSize(18);
    doc.text(auditData.building.building_name, 105, 80, { align: "center" });

    doc.setFontSize(14);
    doc.text(auditData.building.address || "Address Not Available", 105, 100, {
      align: "center",
    });

    doc.setFontSize(12);
    doc.text(
      `Audit Date: ${new Date(auditData.audit.created_at).toLocaleDateString()}`,
      105,
      120,
      { align: "center" }
    );
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 105, 135, {
      align: "center",
    });
    doc.text(`Auditor: ${auditData.auditor.name}`, 105, 150, {
      align: "center",
    });

    addNewPage();

    // 2. EXECUTIVE SUMMARY
    doc.setFontSize(16);
    doc.text("EXECUTIVE SUMMARY", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(11);
    // Use the pre-calculated values instead of redeclaring
    const summaryText = [
      `This comprehensive energy audit was conducted for ${auditData.building.building_name} to identify`,
      `energy conservation opportunities and recommend cost-effective improvements. The facility`,
      `consumes approximately ${auditData.baseline_consumption.toLocaleString()} kWh annually at a cost of`,
      `₱${auditData.baseline_cost.toLocaleString()}.`,
      "",
      `${auditData.ecos.length} Energy Conservation Opportunities (ECOs) were identified with a total`,
      `potential annual savings of ₱${totalSavings.toLocaleString()} and an average simple payback of`,
      `${averagePayback.toFixed(1)} years. Total implementation cost is estimated at ₱${totalImplementationCost.toLocaleString()}.`,
      "",
      "Key findings include opportunities in lighting systems, HVAC optimization, power factor",
      "correction, and building envelope improvements. Implementation of these measures will result",
      "in significant energy cost reductions and improved operational efficiency.",
    ];

    summaryText.forEach((line) => {
      checkPageBreak();
      doc.text(line, 20, yPosition);
      yPosition += 6;
    });

    yPosition += 10;
    checkPageBreak(50);

    // ECO Summary Table
    doc.setFontSize(12);
    doc.text("ENERGY CONSERVATION OPPORTUNITIES SUMMARY", 20, yPosition);
    yPosition += 10;

    doc.autoTable({
      startY: yPosition,
      head: [
        [
          "ECO ID",
          "Description",
          "Annual Savings",
          "Cost",
          "Payback (yrs)",
          "Priority",
        ],
      ],
      body: ecoTableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 139, 202] },
      columnStyles: {
        1: { cellWidth: 55 },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 20, halign: "center" },
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;
    addNewPage();

    // 3. TABLE OF CONTENTS (Following exact format)
    doc.setFontSize(16);
    doc.text("TABLE OF CONTENTS", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(11);
    const tocItems = [
      "Purpose of the Energy Audit",
      "Need for a continuing energy cost control program",
      "Facility Description",
      "Energy Bill Analysis",
      "Energy Conservation Opportunities (ECOs)",
      "Action Plan",
      "Conclusion",
    ];

    tocItems.forEach((item) => {
      checkPageBreak();
      doc.text(item, 20, yPosition);
      yPosition += 8;
    });

    addNewPage();

    // 4. PURPOSE OF THE ENERGY AUDIT (Combined section as per format)
    doc.setFontSize(16);
    doc.text("PURPOSE OF THE ENERGY AUDIT", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(11);
    const purposeText = [
      "This comprehensive energy audit was conducted to:",
      "",
      "• Assess current energy consumption patterns and costs",
      "• Identify energy conservation opportunities",
      "• Evaluate the economic feasibility of energy efficiency improvements",
      "• Develop an implementation plan for cost-effective measures",
      "• Establish a baseline for ongoing energy management",
      "• Support compliance with energy efficiency regulations",
    ];

    purposeText.forEach((line) => {
      checkPageBreak();
      doc.text(line, 20, yPosition);
      yPosition += 6;
    });

    yPosition += 15;

    // Continue with facility description and other sections...

    // 8. ENERGY CONSERVATION OPPORTUNITIES (ECOs) (Following exact format structure)
    doc.setFontSize(16);
    doc.text("ENERGY CONSERVATION OPPORTUNITIES (ECOs)", 20, yPosition);
    yPosition += 15;

    // Listing of Potential ECOs (as specified in format)
    doc.setFontSize(12);
    doc.text("Listing of Potential ECOs", 20, yPosition);
    yPosition += 10;

    // ECO summary table - reuse the same data structure but with different column structure
    const detailedEcoTableData = auditData.ecos.map((eco) => [
      eco.id,
      eco.description.substring(0, 40) +
        (eco.description.length > 40 ? "..." : ""),
      `₱${eco.annual_cost_savings_php.toLocaleString()}`,
      eco.simple_payback_years.toFixed(1),
      eco.priority.toUpperCase(),
    ]);

    doc.autoTable({
      startY: yPosition,
      head: [
        [
          "ECO ID",
          "Description",
          "Annual Savings",
          "Payback (yrs)",
          "Priority",
        ],
      ],
      body: detailedEcoTableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;

    // Cost and Saving Analysis (as specified in format)
    doc.setFontSize(12);
    doc.text("Cost and Saving Analysis", 20, yPosition);
    yPosition += 15;

    auditData.ecos.forEach((eco) => {
      checkPageBreak(60);

      doc.setFontSize(11);
      doc.text(`${eco.id}: ${eco.description}`, 20, yPosition);
      yPosition += 8;

      const costAnalysis = [
        `Annual Energy Savings: ${eco.annual_energy_savings_kwh.toLocaleString()} kWh`,
        `Annual Cost Savings: ₱${eco.annual_cost_savings_php.toLocaleString()}`,
        `Implementation Cost: ₱${eco.implementation_cost_php.toLocaleString()}`,
        `Simple Payback Period: ${eco.simple_payback_years.toFixed(1)} years`,
      ];

      costAnalysis.forEach((detail) => {
        checkPageBreak();
        doc.text(detail, 25, yPosition);
        yPosition += 6;
      });

      yPosition += 8;
    });

    checkPageBreak(30);

    // Economic Evaluation (as specified in format)
    doc.setFontSize(12);
    doc.text("Economic Evaluation", 20, yPosition);
    yPosition += 10;

    // Use pre-calculated values and calculate totalCost locally to avoid conflicts
    const totalCost = totalImplementationCost; // Use the same calculation
    const overallPayback = totalCost / totalSavings;

    doc.setFontSize(11);
    const economicSummary = [
      `Total Annual Cost Savings: ₱${totalSavings.toLocaleString()}`,
      `Total Implementation Cost: ₱${totalCost.toLocaleString()}`,
      `Overall Simple Payback: ${overallPayback.toFixed(1)} years`,
      `Percentage of Current Energy Cost: ${((totalSavings / auditData.baseline_cost) * 100).toFixed(1)}%`,
    ];

    economicSummary.forEach((line) => {
      checkPageBreak();
      doc.text(line, 20, yPosition);
      yPosition += 6;
    });

    addNewPage();

    // 9. ACTION PLAN (Following exact format structure)
    doc.setFontSize(16);
    doc.text("ACTION PLAN", 20, yPosition);
    yPosition += 15;

    // Recommended ECOs and an Implementation Schedule (as specified in format)
    doc.setFontSize(12);
    doc.text("Recommended ECOs and an Implementation Schedule", 20, yPosition);
    yPosition += 10;

    // Implementation schedule table
    const scheduleData = auditData.ecos.map((eco) => [
      eco.id,
      eco.description.substring(0, 30) + "...",
      eco.priority.toUpperCase(),
      `${eco.estimated_implementation_months} months`,
      `₱${eco.implementation_cost_php.toLocaleString()}`,
    ]);

    doc.autoTable({
      startY: yPosition,
      head: [["ECO ID", "Description", "Priority", "Duration", "Cost"]],
      body: scheduleData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(11);
    const implementationNotes = [
      "Implementation should proceed based on priority level and available resources.",
      "High priority measures should be implemented first due to shorter payback periods.",
      "Medium and low priority measures can be implemented as budget allows.",
      "Regular monitoring should be established to track energy savings.",
    ];

    implementationNotes.forEach((line) => {
      checkPageBreak();
      doc.text(line, 20, yPosition);
      yPosition += 6;
    });

    addNewPage();

    // 10. CONCLUSION (Following exact format structure)
    doc.setFontSize(16);
    doc.text("CONCLUSION", 20, yPosition);
    yPosition += 15;

    // Additional comments not otherwise covered (as specified in format)
    doc.setFontSize(11);
    // Use the pre-calculated values instead of redeclaring
    const conclusionText = [
      `The energy audit of ${auditData.building.building_name} has identified significant`,
      `opportunities for energy and cost savings through ${auditData.ecos.length} Energy Conservation`,
      `Opportunities with total potential annual savings of ₱${totalSavings.toLocaleString()}.`,
      "",
      `Current annual energy consumption: ${auditData.baseline_consumption.toLocaleString()} kWh`,
      `Current annual energy cost: ₱${auditData.baseline_cost.toLocaleString()}`,
      `Potential annual savings: ₱${totalSavings.toLocaleString()}`,
      `Total implementation cost: ₱${totalImplementationCost.toLocaleString()}`,
      `Average payback period: ${averagePayback.toFixed(1)} years`,
      "",
      "Implementation of these measures will result in reduced energy costs,",
      "improved equipment reliability, and enhanced operational efficiency.",
      "",
      "Regular monitoring and follow-up audits are recommended to ensure",
      "projected savings are achieved and to identify additional opportunities.",
    ];

    conclusionText.forEach((line) => {
      checkPageBreak();
      doc.text(line, 20, yPosition);
      yPosition += 6;
    });

    // Add footer to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Energy Audit Report - ${auditData.building.building_name}`,
        20,
        pageHeight - 10
      );
      doc.text(
        `Page ${i} of ${totalPages}`,
        doc.internal.pageSize.width - 40,
        pageHeight - 10
      );
    }

    // Save the PDF
    const pdfOutput = doc.output("arraybuffer");
    fs.writeFileSync(filePath, Buffer.from(pdfOutput));

    logger.info(
      `Energy audit PDF with title page generated following exact 1-to-1 format: ${filePath}`
    );
  }

  public async generateComplianceReport(
    params: ReportParams
  ): Promise<IReport> {
    try {
      const reportId = await this.createReportRecord(
        ReportType.COMPLIANCE,
        params
      );

      // Get compliance data
      const complianceData = await database.query(
        `SELECT 
          cc.*,
          a.title as audit_title,
          b.name as building_name
        FROM compliance_checks cc
        LEFT JOIN audits a ON cc.audit_id = a.id
        LEFT JOIN buildings b ON a.building_id = b.id
        WHERE cc.audit_id = ?
        ORDER BY cc.standard_type, cc.section_code`,
        [params.auditId]
      );

      // Generate Excel file for compliance report
      const fileName = `compliance-report-${reportId}-${Date.now()}.xlsx`;
      const filePath = path.join(this.reportsDir, fileName);

      await this.generateComplianceExcel(complianceData, filePath, params);

      // Update report record
      await this.updateReportRecord(reportId, {
        file_path: filePath,
        file_name: fileName,
        file_size: fs.statSync(filePath).size,
        status: ReportStatus.COMPLETED,
        data: {
          audit_id: params.auditId,
          compliance_checks_count: complianceData.length,
        },
      });

      return await this.getReportById(reportId);
    } catch (error) {
      logger.error("Error generating compliance report:", error);
      throw error;
    }
  }

  // Keep existing helper methods for basic reports
  private async generateEnergyPDF(
    energyData: any[],
    filePath: string,
    params: ReportParams
  ): Promise<void> {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("Energy Consumption Report", 20, 20);

    doc.setFontSize(12);
    doc.text(`Report Title: ${params.title}`, 20, 35);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45);
    doc.text(`Total Records: ${energyData.length}`, 20, 55);

    // Add energy data table
    let yPosition = 70;
    doc.setFontSize(10);
    energyData.slice(0, 20).forEach((row) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.text(new Date(row.recorded_at).toLocaleDateString(), 20, yPosition);
      doc.text(row.consumption_kwh?.toString() || "N/A", 60, yPosition);
      doc.text(row.demand_kw?.toString() || "N/A", 100, yPosition);
      doc.text(row.cost_php?.toString() || "N/A", 140, yPosition);

      yPosition += 8;
    });

    const pdfOutput = doc.output("arraybuffer");
    fs.writeFileSync(filePath, Buffer.from(pdfOutput));
  }

  private async generatePowerQualityPDF(
    pqData: any[],
    filePath: string,
    params: ReportParams
  ): Promise<void> {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("Power Quality Report", 20, 20);

    doc.setFontSize(12);
    doc.text(`Report Title: ${params.title}`, 20, 35);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45);
    doc.text(`Total Records: ${pqData.length}`, 20, 55);

    // Add power quality data table
    let yPosition = 70;
    doc.setFontSize(10);
    pqData.slice(0, 20).forEach((row) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.text(new Date(row.recorded_at).toLocaleDateString(), 20, yPosition);
      doc.text(row.voltage?.toString() || "N/A", 60, yPosition);
      doc.text(row.current?.toString() || "N/A", 100, yPosition);
      doc.text(row.frequency?.toString() || "N/A", 140, yPosition);
      doc.text(row.power_factor?.toString() || "N/A", 180, yPosition);

      yPosition += 8;
    });

    const pdfOutput = doc.output("arraybuffer");
    fs.writeFileSync(filePath, Buffer.from(pdfOutput));
  }

  private async generateComplianceExcel(
    complianceData: any[],
    filePath: string,
    params: ReportParams
  ): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(complianceData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Compliance Report");

    // Write file
    XLSX.writeFile(workbook, filePath);
  }

  private async createReportRecord(
    reportType: ReportType,
    params: ReportParams
  ): Promise<number> {
    const result = await database.query(
      `INSERT INTO reports 
       (title, report_type, building_id, audit_id, generated_by, parameters, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.title,
        reportType,
        params.buildingId || null,
        params.auditId || null,
        params.generatedBy,
        JSON.stringify(params),
        ReportStatus.GENERATING,
      ]
    );

    return (result as any).insertId;
  }

  private async updateReportRecord(
    reportId: number,
    updateData: any
  ): Promise<void> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    Object.entries(updateData).forEach(([key, value]) => {
      updateFields.push(`${key} = ?`);
      updateValues.push(value);
    });

    updateValues.push(reportId);

    await database.query(
      `UPDATE reports SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );
  }

  private async getReportById(reportId: number): Promise<IReport> {
    const report = await database.queryOne<IReport>(
      "SELECT * FROM reports WHERE id = ?",
      [reportId]
    );

    if (!report) {
      throw new Error("Report not found");
    }

    return report;
  }
}

export default new ReportService();
