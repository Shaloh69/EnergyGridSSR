import { database } from "@/config/database";
import { IReport } from "@/interfaces/IReport";
import { ReportType, ReportStatus } from "@/types/enums";
import { logger } from "@/utils/logger";
import jsPDF from "jspdf";
import * as XLSX from "xlsx"; // Fixed import
import path from "path";
import fs from "fs";

interface ReportParams {
  buildingId?: number;
  auditId?: number;
  startDate?: string;
  endDate?: string;
  title: string;
  generatedBy: number;
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

  public async generateAuditSummaryReport(
    params: ReportParams
  ): Promise<IReport> {
    try {
      const reportId = await this.createReportRecord(
        ReportType.AUDIT_SUMMARY,
        params
      );

      // Get audit data
      const auditData = await database.queryOne(
        `SELECT 
          a.*,
          b.name as building_name,
          b.code as building_code,
          u.first_name as auditor_first_name,
          u.last_name as auditor_last_name
        FROM audits a
        LEFT JOIN buildings b ON a.building_id = b.id
        LEFT JOIN users u ON a.auditor_id = u.id
        WHERE a.id = ?`,
        [params.auditId]
      );

      // Get compliance checks
      const complianceChecks = await database.query(
        "SELECT * FROM compliance_checks WHERE audit_id = ? ORDER BY standard_type, section_code",
        [params.auditId]
      );

      // Generate PDF
      const fileName = `audit-report-${reportId}-${Date.now()}.pdf`;
      const filePath = path.join(this.reportsDir, fileName);

      await this.generateAuditPDF(
        auditData,
        complianceChecks,
        filePath,
        params
      );

      // Update report record
      await this.updateReportRecord(reportId, {
        file_path: filePath,
        file_name: fileName,
        file_size: fs.statSync(filePath).size,
        status: ReportStatus.COMPLETED,
        data: {
          audit_id: params.auditId,
          compliance_checks_count: complianceChecks.length,
        },
      });

      return await this.getReportById(reportId);
    } catch (error) {
      logger.error("Error generating audit summary report:", error);
      throw error;
    }
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

  private async generateComplianceExcel(
    data: any[],
    filePath: string,
    params: ReportParams
  ): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(
      data.map((item) => ({
        "Standard Type": item.standard_type,
        "Section Code": item.section_code,
        Description: item.check_description,
        Status: item.status,
        Severity: item.severity,
        Details: item.details,
        "Corrective Action": item.corrective_action,
        "Due Date": item.due_date,
        Building: item.building_name,
        Audit: item.audit_title,
      }))
    );

    XLSX.utils.book_append_sheet(workbook, worksheet, "Compliance Checks");

    // Write file
    XLSX.writeFile(workbook, filePath);
  }

  private async generateEnergyPDF(
    data: any[],
    filePath: string,
    params: ReportParams
  ): Promise<void> {
    const doc = new jsPDF(); // Fixed instantiation

    // Title
    doc.setFontSize(20);
    doc.text("UCLM Energy Consumption Report", 20, 20);

    // Report details
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 35);
    doc.text(
      `Period: ${params.startDate || "All"} to ${params.endDate || "All"}`,
      20,
      45
    );

    // Data table
    let yPosition = 60;
    doc.setFontSize(10);

    // Headers
    doc.text("Date", 20, yPosition);
    doc.text("Building", 60, yPosition);
    doc.text("Consumption (kWh)", 120, yPosition);
    doc.text("Cost (PHP)", 170, yPosition);

    yPosition += 10;

    // Data rows
    data.forEach((row, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      doc.text(new Date(row.recorded_at).toLocaleDateString(), 20, yPosition);
      doc.text(row.building_name || "N/A", 60, yPosition);
      doc.text(row.consumption_kwh?.toString() || "0", 120, yPosition);
      doc.text(row.cost_php?.toString() || "0", 170, yPosition);

      yPosition += 8;
    });

    // Save to file instead of download
    const pdfOutput = doc.output("arraybuffer");
    fs.writeFileSync(filePath, Buffer.from(pdfOutput));
  }

  private async generatePowerQualityPDF(
    data: any[],
    filePath: string,
    params: ReportParams
  ): Promise<void> {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("UCLM Power Quality Report", 20, 20);

    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 35);
    doc.text(
      `Period: ${params.startDate || "All"} to ${params.endDate || "All"}`,
      20,
      45
    );

    let yPosition = 60;
    doc.setFontSize(10);

    // Headers
    doc.text("Date", 20, yPosition);
    doc.text("Voltage (V)", 60, yPosition);
    doc.text("THD (%)", 100, yPosition);
    doc.text("Frequency (Hz)", 140, yPosition);
    doc.text("Power Factor", 180, yPosition);

    yPosition += 10;

    data.forEach((row) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      doc.text(new Date(row.recorded_at).toLocaleDateString(), 20, yPosition);
      doc.text(row.voltage_l1?.toString() || "N/A", 60, yPosition);
      doc.text(row.thd_voltage?.toString() || "N/A", 100, yPosition);
      doc.text(row.frequency?.toString() || "N/A", 140, yPosition);
      doc.text(row.power_factor?.toString() || "N/A", 180, yPosition);

      yPosition += 8;
    });

    const pdfOutput = doc.output("arraybuffer");
    fs.writeFileSync(filePath, Buffer.from(pdfOutput));
  }

  private async generateAuditPDF(
    auditData: any,
    complianceChecks: any[],
    filePath: string,
    params: ReportParams
  ): Promise<void> {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("UCLM Audit Summary Report", 20, 20);

    doc.setFontSize(14);
    doc.text(`Audit: ${auditData.title}`, 20, 35);
    doc.text(`Building: ${auditData.building_name}`, 20, 45);
    doc.text(
      `Auditor: ${auditData.auditor_first_name} ${auditData.auditor_last_name}`,
      20,
      55
    );
    doc.text(`Status: ${auditData.status}`, 20, 65);
    doc.text(
      `Compliance Score: ${auditData.compliance_score || "N/A"}`,
      20,
      75
    );

    // Compliance checks
    let yPosition = 90;
    doc.setFontSize(16);
    doc.text("Compliance Checks", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(10);
    complianceChecks.forEach((check) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.text(`${check.standard_type} - ${check.section_code}`, 20, yPosition);
      doc.text(`Status: ${check.status}`, 20, yPosition + 8);
      doc.text(`Description: ${check.check_description}`, 20, yPosition + 16);

      yPosition += 30;
    });

    const pdfOutput = doc.output("arraybuffer");
    fs.writeFileSync(filePath, Buffer.from(pdfOutput));
  }
}

export default new ReportService();
