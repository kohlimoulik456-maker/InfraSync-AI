import * as XLSX from "xlsx";
import Papa from "papaparse";
import { NormalizedSupervisorInput, PipelineResult } from "../types";
import { runPipelineForInput } from "../services/pipelineService";

export const SUPERVISOR_TEMPLATE_HEADERS = [
  "Update_ID",
  "Project_ID",
  "Supervisor_ID",
  "Update_Date",
  "Area_Unit",
  "Discipline",
  "Activity_Description",
  "Actual_Start_Date",
  "Actual_Finish_Date",
  "Progress_Value",
  "Progress_Unit",
  "Delay_Reason",
  "Remarks"
] as const;

interface RawRow {
  [key: string]: any;
}

export interface RowValidationResult {
  rowIndex: number;
  valid: boolean;
  errors: string[];
  raw: RawRow;
}

function parseSheet(buffer: Buffer, filename: string): RawRow[] {
  if (filename.toLowerCase().endsWith(".csv")) {
    const text = buffer.toString("utf-8");
    const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
    return parsed.data;
  }
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null });
}

function isValidDate(value: any): boolean {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  return !isNaN(d.getTime());
}

function toIsoDate(value: any): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function validateSupervisorRows(
  rows: RawRow[],
  selectedProjectId: string,
  formSupervisorId: string
): RowValidationResult[] {
  return rows.map((raw, idx) => {
    const errors: string[] = [];
    const projectId = String(raw.Project_ID ?? "").trim();
    const supervisorId = String(raw.Supervisor_ID ?? formSupervisorId ?? "").trim();
    const activityDescription = String(raw.Activity_Description ?? "").trim();

    if (!projectId) errors.push("Project_ID is missing.");
    else if (projectId !== selectedProjectId) errors.push("Project_ID does not match the selected project.");

    if (!supervisorId) errors.push("Supervisor_ID is required (row or form-level).");
    if (!isValidDate(raw.Update_Date)) errors.push("Update_Date is missing or invalid.");
    if (!activityDescription) errors.push("Activity_Description is required.");

    if (raw.Actual_Start_Date && !isValidDate(raw.Actual_Start_Date)) {
      errors.push("Actual_Start_Date is invalid.");
    }
    if (raw.Actual_Finish_Date && !isValidDate(raw.Actual_Finish_Date)) {
      errors.push("Actual_Finish_Date is invalid.");
    }
    if (
      raw.Actual_Start_Date &&
      raw.Actual_Finish_Date &&
      isValidDate(raw.Actual_Start_Date) &&
      isValidDate(raw.Actual_Finish_Date) &&
      new Date(raw.Actual_Finish_Date) < new Date(raw.Actual_Start_Date)
    ) {
      errors.push("Actual_Finish_Date cannot be earlier than Actual_Start_Date.");
    }
    if (raw.Progress_Value !== null && raw.Progress_Value !== undefined && raw.Progress_Value !== "") {
      if (isNaN(Number(raw.Progress_Value))) errors.push("Progress_Value must be numeric.");
    }

    return { rowIndex: idx + 1, valid: errors.length === 0, errors, raw };
  });
}

export function buildNormalizedRawInput(raw: RawRow): string {
  return [
    raw.Activity_Description,
    raw.Remarks,
    raw.Discipline,
    raw.Area_Unit,
    raw.Delay_Reason,
    raw.Actual_Start_Date,
    raw.Actual_Finish_Date,
    raw.Progress_Value,
    raw.Progress_Unit
  ]
    .filter((v) => v !== null && v !== undefined && v !== "")
    .join(" | ");
}

export function normalizeExcelRow(
  raw: RawRow,
  selectedProjectId: string,
  formSupervisorId: string
): NormalizedSupervisorInput {
  return {
    project_id: selectedProjectId,
    supervisor_id: String(raw.Supervisor_ID ?? formSupervisorId).trim(),
    source_type: "EXCEL",
    update_date: toIsoDate(raw.Update_Date) ?? new Date().toISOString(),
    discipline: raw.Discipline ? String(raw.Discipline).toUpperCase().trim() : null,
    area_unit: raw.Area_Unit ? String(raw.Area_Unit).trim() : null,
    activity_description: String(raw.Activity_Description ?? "").trim(),
    actual_start_date: toIsoDate(raw.Actual_Start_Date),
    actual_finish_date: toIsoDate(raw.Actual_Finish_Date),
    progress_value: raw.Progress_Value !== null && raw.Progress_Value !== undefined && raw.Progress_Value !== "" ? Number(raw.Progress_Value) : null,
    progress_unit: raw.Progress_Unit ? String(raw.Progress_Unit).trim() : null,
    delay_reason: raw.Delay_Reason ? String(raw.Delay_Reason).trim() : null,
    remarks: raw.Remarks ? String(raw.Remarks).trim() : null,
    raw_input: buildNormalizedRawInput(raw),
    metadata: { source_row: raw }
  };
}

export interface ExcelBatchRowResult {
  rowIndex: number;
  valid: boolean;
  errors: string[];
  updateId: string | null;
  activityDescription: string;
  result: PipelineResult | null;
}

export interface ExcelBatchSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  autoAccepted: number;
  acceptMonitor: number;
  reviewRequired: number;
  noMatch: number;
  rejected: number;
  rows: ExcelBatchRowResult[];
}

/**
 * Fully functional: parses XLSX/CSV, validates every row, and processes
 * each valid row INDEPENDENTLY through the common AI pipeline. Never
 * combines multiple rows into one LLM request.
 */
export async function processExcelUpload(
  buffer: Buffer,
  filename: string,
  selectedProjectId: string,
  formSupervisorId: string
): Promise<ExcelBatchSummary> {
  const rawRows = parseSheet(buffer, filename);
  const validated = validateSupervisorRows(rawRows, selectedProjectId, formSupervisorId);

  const rows: ExcelBatchRowResult[] = [];
  let autoAccepted = 0;
  let acceptMonitor = 0;
  let reviewRequired = 0;
  let noMatch = 0;
  let rejected = 0;

  for (const v of validated) {
    if (!v.valid) {
      rows.push({
        rowIndex: v.rowIndex,
        valid: false,
        errors: v.errors,
        updateId: null,
        activityDescription: String(v.raw.Activity_Description ?? ""),
        result: null
      });
      continue;
    }

    const normalized = normalizeExcelRow(v.raw, selectedProjectId, formSupervisorId);
    const { updateId, result } = await runPipelineForInput(normalized);

    if (result.decision === "AUTO_ACCEPT") autoAccepted++;
    else if (result.decision === "ACCEPT_MONITOR") acceptMonitor++;
    else if (result.decision === "FLAG_FOR_REVIEW") reviewRequired++;
    else if (result.decision === "NO_MATCH") noMatch++;
    else if (result.decision === "REJECTED") rejected++;

    rows.push({
      rowIndex: v.rowIndex,
      valid: true,
      errors: [],
      updateId,
      activityDescription: normalized.activity_description,
      result
    });
  }

  return {
    totalRows: rawRows.length,
    validRows: validated.filter((v) => v.valid).length,
    invalidRows: validated.filter((v) => !v.valid).length,
    autoAccepted,
    acceptMonitor,
    reviewRequired,
    noMatch,
    rejected,
    rows
  };
}
