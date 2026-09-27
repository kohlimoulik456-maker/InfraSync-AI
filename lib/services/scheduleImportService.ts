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

interface PreparedSchedule {
  headerErrors: string[];
  summary: ScheduleImportSummary;
  validRows: any[];
}

async function prepareScheduleImport(buffer: Buffer, filename: string, projectId: string): Promise<PreparedSchedule> {
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
      },
      validRows: []
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
    const rowProjectId = raw.Project_ID ? String(raw.Project_ID).trim() : "";
    const activityName = raw.Activity_Name ? String(raw.Activity_Name).trim() : "";
    const discipline = raw.Discipline ? String(raw.Discipline).trim().toUpperCase() : "";

    if (rowProjectId !== projectId) {
      rejections.push({ rowIndex, activityId, reason: `Project_ID "${rowProjectId}" does not match "${projectId}".` });
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
      area: area ?? "",
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

  return {
    headerErrors: [],
    summary: {
      totalRows: rows.length,
      imported: validRows.length,
      rejected: rejections.length,
      duplicateActivityIds: Array.from(duplicates),
      disciplinesDetected: Array.from(disciplines),
      rejections
    },
    validRows
  };
}

function toVersionActivity(row: any, scheduleVersionId: string) {
  const { projectId: importedProjectId, ...activity } = row;
  void importedProjectId;
  return { ...activity, scheduleVersionId };
}

export async function importSchedule(
  buffer: Buffer,
  filename: string,
  formProjectId: string,
  formProjectName: string,
  createdBy?: string
): Promise<{ summary: ScheduleImportSummary; headerErrors: string[]; scheduleVersionId?: string }> {
  const prepared = await prepareScheduleImport(buffer, filename, formProjectId);
  const { summary, headerErrors, validRows } = prepared;
  if (headerErrors.length > 0) {
    return {
      headerErrors,
      summary
    };
  }

  const now = new Date();
  let scheduleVersionId = "";
  // ─── FIXED: batch operations instead of per-row upserts ─────────────────────
  await prisma.$transaction(async (tx) => {
    await tx.project.create({
      data: { projectId: formProjectId, projectName: formProjectName }
    });

    const version = await tx.scheduleVersion.create({
      data: {
        projectId: formProjectId,
        versionNumber: 1,
        status: summary.imported > 0 && summary.rejected === 0 ? "CURRENT" : "DRAFT",
        sourceFileName: filename,
        createdBy,
        approvedBy: summary.imported > 0 && summary.rejected === 0 ? createdBy : null,
        totalRows: summary.totalRows,
        importedRows: summary.imported,
        rejectedRows: summary.rejected,
        validatedAt: summary.imported > 0 && summary.rejected === 0 ? now : null,
        approvedAt: summary.imported > 0 && summary.rejected === 0 ? now : null,
        activatedAt: summary.imported > 0 && summary.rejected === 0 ? now : null
      }
    });
    scheduleVersionId = version.scheduleVersionId;

    if (validRows.length > 0) {
      await tx.scheduleVersionActivity.createMany({
        data: validRows.map((row) => toVersionActivity(row, scheduleVersionId))
      });
    }
    if (validRows.length > 0 && summary.imported > 0 && summary.rejected === 0) {
      await tx.scheduleActivity.createMany({ data: validRows });
    }
  });

  return { headerErrors: [], summary, scheduleVersionId };
}

export async function stageScheduleRevision(
  buffer: Buffer,
  filename: string,
  projectId: string,
  createdBy?: string
): Promise<{ summary: ScheduleImportSummary; headerErrors: string[]; scheduleVersionId: string | null }> {
  const prepared = await prepareScheduleImport(buffer, filename, projectId);
  if (prepared.headerErrors.length > 0) {
    return { ...prepared, scheduleVersionId: null };
  }

  const version = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { projectId }, select: { projectId: true } });
    if (!project) throw new Error(`Project_ID "${projectId}" was not found.`);
    await tx.$queryRaw`SELECT "projectId" FROM "project" WHERE "projectId" = ${projectId} FOR UPDATE`;

    const latest = await tx.scheduleVersion.aggregate({
      where: { projectId },
      _max: { versionNumber: true }
    });
    const scheduleVersion = await tx.scheduleVersion.create({
      data: {
        projectId,
        versionNumber: (latest._max.versionNumber ?? 0) + 1,
        status: prepared.summary.imported > 0 && prepared.summary.rejected === 0 ? "VALIDATED" : "DRAFT",
        sourceFileName: filename,
        createdBy,
        totalRows: prepared.summary.totalRows,
        importedRows: prepared.summary.imported,
        rejectedRows: prepared.summary.rejected,
        validatedAt: prepared.summary.imported > 0 && prepared.summary.rejected === 0 ? new Date() : null
      }
    });

    if (prepared.validRows.length > 0) {
      await tx.scheduleVersionActivity.createMany({
        data: prepared.validRows.map((row) => toVersionActivity(row, scheduleVersion.scheduleVersionId))
      });
    }
    return scheduleVersion;
  });

  return { ...prepared, scheduleVersionId: version.scheduleVersionId };
}

export async function activateScheduleVersion(projectId: string, scheduleVersionId: string, approvedBy: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "projectId" FROM "project" WHERE "projectId" = ${projectId} FOR UPDATE`;

    const version = await tx.scheduleVersion.findFirst({
      where: { projectId, scheduleVersionId },
      include: { activities: true }
    });
    if (!version) throw new Error("Schedule version not found.");
    if (version.status !== "VALIDATED" || version.rejectedRows > 0) {
      throw new Error("Only a fully validated schedule version can be approved.");
    }
    if (version.activities.length === 0) throw new Error("A schedule version must contain at least one activity.");

    const conflictingIds = await tx.scheduleActivity.findMany({
      where: {
        activityId: { in: version.activities.map((activity) => activity.activityId) },
        projectId: { not: projectId }
      },
      select: { activityId: true },
      take: 1
    });
    if (conflictingIds.length > 0) {
      throw new Error(`Activity_ID "${conflictingIds[0].activityId}" is already assigned to another project.`);
    }

    const serializedActivities = JSON.stringify(version.activities.map((activity) => ({
      ...activity,
      plannedStart: activity.plannedStart.toISOString(),
      plannedFinish: activity.plannedFinish.toISOString()
    })));

    await tx.$executeRaw`
      INSERT INTO "scheduleActivity" (
        "activityId", "projectId", "activityName", "discipline", "area", "contractor",
        "wbsL1", "wbsL2", "wbsL3", "wbsL4", "wbsL5", "wbsL6", "plannedStart", "plannedFinish",
        "plannedDuration", "activityStatus", "isCurrentSchedule", "predecessorId", "fieldKeywords", "normalizedSearchText"
      )
      SELECT incoming."activityId", ${projectId}, incoming."activityName", incoming."discipline", incoming."area", incoming."contractor",
        incoming."wbsL1", incoming."wbsL2", incoming."wbsL3", incoming."wbsL4", incoming."wbsL5", incoming."wbsL6",
        incoming."plannedStart", incoming."plannedFinish", incoming."plannedDuration", incoming."activityStatus", true,
        incoming."predecessorId", incoming."fieldKeywords", incoming."normalizedSearchText"
      FROM jsonb_to_recordset(${serializedActivities}::jsonb) AS incoming(
        "activityId" text, "activityName" text, "discipline" text, "area" text, "contractor" text,
        "wbsL1" text, "wbsL2" text, "wbsL3" text, "wbsL4" text, "wbsL5" text, "wbsL6" text,
        "plannedStart" timestamp, "plannedFinish" timestamp, "plannedDuration" integer, "activityStatus" text,
        "predecessorId" text, "fieldKeywords" text, "normalizedSearchText" text
      )
      ON CONFLICT ("activityId") DO UPDATE SET
        "activityName" = EXCLUDED."activityName",
        "discipline" = EXCLUDED."discipline",
        "area" = EXCLUDED."area",
        "contractor" = EXCLUDED."contractor",
        "wbsL1" = EXCLUDED."wbsL1",
        "wbsL2" = EXCLUDED."wbsL2",
        "wbsL3" = EXCLUDED."wbsL3",
        "wbsL4" = EXCLUDED."wbsL4",
        "wbsL5" = EXCLUDED."wbsL5",
        "wbsL6" = EXCLUDED."wbsL6",
        "plannedStart" = EXCLUDED."plannedStart",
        "plannedFinish" = EXCLUDED."plannedFinish",
        "plannedDuration" = EXCLUDED."plannedDuration",
        "predecessorId" = EXCLUDED."predecessorId",
        "fieldKeywords" = EXCLUDED."fieldKeywords",
        "normalizedSearchText" = EXCLUDED."normalizedSearchText",
        "isCurrentSchedule" = true
      WHERE "scheduleActivity"."projectId" = EXCLUDED."projectId"
    `;

    await tx.scheduleActivity.updateMany({
      where: {
        projectId,
        activityId: { notIn: version.activities.map((activity) => activity.activityId) }
      },
      data: { isCurrentSchedule: false }
    });
    await tx.scheduleVersion.updateMany({
      where: { projectId, status: "CURRENT" },
      data: { status: "SUPERSEDED" }
    });
    return tx.scheduleVersion.update({
      where: { scheduleVersionId },
      data: { status: "CURRENT", approvedBy, approvedAt: new Date(), activatedAt: new Date() },
      select: { scheduleVersionId: true, versionNumber: true, status: true }
    });
  });
}
