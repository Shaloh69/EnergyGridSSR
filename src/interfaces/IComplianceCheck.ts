import { StandardType, ComplianceStatus } from "@/types/enums";
import { DatabaseRow } from "@/types/common";

export interface IComplianceCheck extends DatabaseRow {
  audit_id: number;
  standard_type: StandardType;
  section_code: string;
  check_description: string;
  status: ComplianceStatus;
  severity: "low" | "medium" | "high" | "critical";
  details?: string;
  corrective_action?: string;
  due_date?: Date;
  responsible_person?: string;
}

export interface IComplianceCheckCreate {
  audit_id: number;
  standard_type: StandardType;
  section_code: string;
  check_description: string;
  status: ComplianceStatus;
  severity: "low" | "medium" | "high" | "critical";
  details?: string;
  corrective_action?: string;
  due_date?: Date;
  responsible_person?: string;
}

export interface IComplianceCheckUpdate {
  standard_type?: StandardType; // Fixed: Added missing property
  section_code?: string; // Fixed: Added missing property
  check_description?: string; // Fixed: Added missing property
  status?: ComplianceStatus;
  severity?: "low" | "medium" | "high" | "critical"; // Fixed: Added missing property
  details?: string;
  corrective_action?: string;
  due_date?: Date;
  responsible_person?: string;
}

export interface IComplianceReport {
  summary: {
    total_checks: number;
    compliant_checks: number;
    non_compliant_checks: number;
    needs_review_checks: number;
    critical_issues: number;
    high_issues: number;
  };
  by_standard: Array<{
    standard_type: StandardType;
    total_checks: number;
    compliant_checks: number;
    compliance_percentage: number;
  }>;
  critical_issues: IComplianceCheck[];
  compliance_score: number;
}

export interface IComplianceTrend {
  date: string;
  avg_compliance_score: number;
  audits_completed: number;
}
