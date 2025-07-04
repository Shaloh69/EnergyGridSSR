import { AuditType, AuditStatus, Priority } from "@/types/enums";
import { DatabaseRow } from "@/types/common";

export interface IAudit extends DatabaseRow {
  building_id: number;
  auditor_id: number;
  audit_type: AuditType;
  title: string;
  description?: string;
  status: AuditStatus;
  priority: Priority;
  scheduled_date?: Date;
  started_date?: Date;
  completed_date?: Date;
  findings?: string;
  recommendations?: string;
  compliance_score?: number;
}

export interface IAuditDetailed extends IAudit {
  compliance_checks?: any[];
  compliance_checks_count?: number; // Fixed: Added missing property
  non_compliant_count?: number; // Fixed: Added missing property
  compliant_count?: number; // Fixed: Added missing property
  critical_issues?: number;
  building_name?: string;
  building_code?: string;
  building_area?: number;
  building_type?: string;
  auditor_first_name?: string;
  auditor_last_name?: string;
  auditor_name?: string;
  auditor_email?: string;
  related_equipment?: any[];
  completion_percentage?: number;
  urgency_status?: string;
}

export interface IAuditCreate {
  building_id: number;
  auditor_id: number;
  audit_type: AuditType;
  title: string;
  description?: string;
  priority?: Priority;
  scheduled_date?: Date;
}

export interface IAuditUpdate {
  auditor_id?: number; // Fixed: Added missing property
  audit_type?: AuditType;
  title?: string;
  description?: string;
  status?: AuditStatus;
  priority?: Priority;
  scheduled_date?: Date;
  started_date?: Date;
  completed_date?: Date;
  findings?: string;
  recommendations?: string;
  compliance_score?: number;
}

// Raw database result interface for proper type handling
export interface IAuditRaw
  extends Omit<IAudit, "scheduled_date" | "started_date" | "completed_date"> {
  scheduled_date?: string; // Raw date string from database
  started_date?: string; // Raw date string from database
  completed_date?: string; // Raw date string from database
}

export interface IAuditDetailedRaw
  extends Omit<
    IAuditDetailed,
    "scheduled_date" | "started_date" | "completed_date"
  > {
  scheduled_date?: string; // Raw date string from database
  started_date?: string; // Raw date string from database
  completed_date?: string; // Raw date string from database
}
