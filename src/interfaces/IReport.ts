import { ReportType, ReportStatus } from "@/types/enums";
import { DatabaseRow } from "@/types/common";

export interface IReport extends DatabaseRow {
  title: string;
  report_type: ReportType;
  building_id?: number;
  audit_id?: number;
  generated_by: number;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  parameters?: Record<string, any>;
  data?: Record<string, any>;
  status: ReportStatus;
}

// Extended interface for reports with computed fields
export interface IReportDetailed extends IReport {
  building_name?: string;
  building_code?: string;
  audit_title?: string;
  audit_status?: string;
  audit_type?: string;
  generated_by_name?: string;
  generated_by_email?: string;
  file_available?: boolean; // Fixed: Added missing property
  file_size_mb?: number;
  age_minutes?: number;
  generation_time?: string;
  status_description?: string;
  download_available?: boolean;
  summary?: any;
}

// Raw database result interface for proper type handling
export interface IReportRaw extends Omit<IReport, "parameters" | "data"> {
  parameters?: string; // Raw JSON string from database
  data?: string; // Raw JSON string from database
}

export interface IReportCreate {
  title: string;
  report_type: ReportType;
  building_id?: number;
  audit_id?: number;
  parameters?: Record<string, any>;
}

export interface ReportParams {
  buildingId?: number;
  auditId?: number;
  startDate?: string;
  endDate?: string;
  title: string;
  generatedBy: number;
  includeComparison?: boolean;
  includeTrends?: boolean;
  includeEvents?: boolean;
  includeCompliance?: boolean;
  includeRecommendations?: boolean;
  includeGapAnalysis?: boolean;
  standards?: string[];
  reportTypes?: string[];
}
