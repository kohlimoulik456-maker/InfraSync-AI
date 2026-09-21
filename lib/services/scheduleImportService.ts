import * as XLSX from "xlsx";
import Papa from "papaparse";
import { prisma } from "../prisma";

export const SCHEDULE_TEMPLATE_HEADERS = [
  "Project_ID",
  "Project_Name",
  "WBS_L1",
  "WBS_L2",
  "WBS_L3",
  "WBS_L4",
  "WBS_L5",
  "WBS_L6",
  "Activity_ID",
  "Activity_Name",
  "Discipline",
  "Area_Unit",
  "Planned_Start",
  "Planned_Finish",
  "Planned_Duration_Days",
  "Predecessor_ID",
  "Contractor",
  "Field_Keywords"
] as const;

const REQUIRED_HEADERS = [
  "Project_ID",
  "Activity_ID",
  "Activity_Name",
  "Discipline",
  "Planned_Start",
  "Planned_Finish"
];

interface RawRow {
  [key: string]: any;
}

function parseSheet(buffer: Buffer, filename: string): RawRow[] {
  if (filename.toLowerCase().endsWith(".csv")) {
    const text = buffer.toString("utf-8");
    return Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true }).data;
  }
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null });
}

function isValidDate(value: any): boolean {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  return !isNaN(d.getTime());
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export interface RowRejection {
  rowIndex: number;
  activityId: string | null;
  reason: string;
}

export interface ScheduleImportSummary {
  totalRows: number;
  imported: number;
  rejected: number;
  duplicateActivityIds: string[];
  disciplinesDetected: string[];
  rejections: RowRejection[];
}

export async function validateHeaders(rows: RawRow[]): Promise<string[]> {
  if (rows.length === 0) return ["The uploaded file has no data rows."];
  const headers = Object.keys(rows[0]);
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  return missing.map((h) => `Missing required column: ${h}`);
}

export async function importSchedule(
  buffer: Buffer,
  filename: string,
  formProjectId: string,
  formProjectName: string
): Promise<{ summary: ScheduleImportSummary; headerErrors: string[] }> {
  const rows = parseSheet(buffer, filename);
  const headerErrors = await validateHeaders(rows);
  if (headerErrors.length > 0) {
    return {
      headerErrors,
      summary: {
        totalRows: rows.length,
        imported: 0,
        rejected: rows.length,
        duplicateActivityIds: [],
        disciplinesDetected: [],
        rejections: []
      }
    };
  }

  const rejections: RowRejection[] = [];
  const seenActivityIds = new Set<string>();
  const duplicates = new Set<string>();
  const disciplines = new Set<string>();
  const validRows: any[] = [];

  rows.forEach((raw, idx) => {
    const rowIndex = idx + 1;
    const activityId = raw.Activity_ID ? String(raw.Activity_ID).trim() : null;
    const projectId = raw.Project_ID ? String(raw.Project_ID).trim() : "";
    const activityName = raw.Activity_Name ? String(raw.Activity_Name).trim() : "";
    const discipline = raw.Discipline ? String(raw.Discipline).trim().toUpperCase() : "";

    if (projectId !== formProjectId) {
      rejections.push({ rowIndex, activityId, reason: `Project_ID "${projectId}" does not match "${formProjectId}".` });
      return;
    }
    if (!activityId) {
      rejections.push({ rowIndex, activityId, reason: "Activity_ID is missing." });
      return;
    }
    if (seenActivityIds.has(activityId)) {
      duplicates.add(activityId);
      rejections.push({ rowIndex, activityId, reason: "Duplicate Activity_ID within this project." });
      return;
    }
    if (!activityName) {
      rejections.push({ rowIndex, activityId, reason: "Activity_Name is empty." });
      return;
    }
    if (!discipline) {
      rejections.push({ rowIndex, activityId, reason: "Discipline is empty." });
      return;
    }
    if (!isValidDate(raw.Planned_Start) || !isValidDate(raw.Planned_Finish)) {
      rejections.push({ rowIndex, activityId, reason: "Planned_Start or Planned_Finish is not a valid date." });
      return;
    }
    const plannedStart = new Date(raw.Planned_Start);
    const plannedFinish = new Date(raw.Planned_Finish);
    if (plannedFinish < plannedStart) {
      rejections.push({ rowIndex, activityId, reason: "Planned_Finish is earlier than Planned_Start." });
      return;
    }

    let plannedDuration = raw.Planned_Duration_Days ? Number(raw.Planned_Duration_Days) : null;
    if (plannedDuration !== null && plannedDuration <= 0) {
      rejections.push({ rowIndex, activityId, reason: "Planned_Duration_Days must be positive." });
      return;
    }
    if (plannedDuration === null || isNaN(plannedDuration)) {
      plannedDuration = daysBetween(plannedFinish, plannedStart);
    }

    seenActivityIds.add(activityId);
    disciplines.add(discipline);

    const area = raw.Area_Unit ? String(raw.Area_Unit).trim() : null;
    const fieldKeywords = raw.Field_Keywords ? String(raw.Field_Keywords).trim() : null;
    const wbs = [raw.WBS_L1, raw.WBS_L2, raw.WBS_L3, raw.WBS_L4, raw.WBS_L5, raw.WBS_L6]
      .filter(Boolean)
      .join(" ");
    const normalizedSearchText = [activityName, discipline, area ?? "", wbs, fieldKeywords ?? ""]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    validRows.push({
      activityId,
      projectId,
      activityName,
      wbsL1: raw.WBS_L1 ? String(raw.WBS_L1) : null,
      wbsL2: raw.WBS_L2 ? String(raw.WBS_L2) : null,
      wbsL3: raw.WBS_L3 ? String(raw.WBS_L3) : null,
      wbsL4: raw.WBS_L4 ? String(raw.WBS_L4) : null,
      wbsL5: raw.WBS_L5 ? String(raw.WBS_L5) : null,
      wbsL6: raw.WBS_L6 ? String(raw.WBS_L6) : null,
      discipline,
      area,
      plannedStart,
      plannedFinish,
      plannedDuration,
      predecessorId: raw.Predecessor_ID ? String(raw.Predecessor_ID).trim() : null,
      contractor: raw.Contractor ? String(raw.Contractor).trim() : null,
      fieldKeywords,
      normalizedSearchText,
      activityStatus: "NOT_STARTED" as const
    });
  });

  await prisma.$transaction(async (tx) => {
    await tx.project.upsert({
      where: { projectId: formProjectId },
      update: { projectName: formProjectName },
      create: { projectId: formProjectId, projectName: formProjectName }
    });

    for (const row of validRows) {
      await tx.scheduleActivity.upsert({
        where: { activityId: row.activityId },
        update: row,
        create: row
      });
    }
  });

  return {
    headerErrors: [],
    summary: {
      totalRows: rows.length,
      imported: validRows.length,
      rejected: rejections.length,
      duplicateActivityIds: Array.from(duplicates),
      disciplinesDetected: Array.from(disciplines),
      rejections
    }
  };
}
