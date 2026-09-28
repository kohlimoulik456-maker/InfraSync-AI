import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { buildWbsTree, hasDependencyCycle, parsePredecessors, type ScheduleDependencyType } from "./scheduleLogic";

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
  "Field_Keywords",
  "Predecessors",
  "WBS_Code_L1",
  "WBS_Code_L2",
  "WBS_Code_L3",
  "WBS_Code_L4",
  "WBS_Code_L5",
  "WBS_Code_L6"
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
  dependencies: {
    predecessorActivityId: string;
    successorActivityId: string;
    dependencyType: ScheduleDependencyType;
    lagDays: number;
  }[];
}

type ScheduleDependency = PreparedSchedule["dependencies"][number];

async function createWbsNodes(
  tx: Prisma.TransactionClient,
  projectId: string,
  scheduleVersionId: string,
  rows: any[]
): Promise<Map<string, string>> {
  const tree = buildWbsTree(rows.map((row) => ({
    activityId: row.activityId,
    path: [1, 2, 3, 4, 5, 6].map((level) => ({
      name: row[`wbsL${level}`],
      code: row[`wbsCodeL${level}`]
    }))
  })));

  const nodeIds = new Map<string, string>();
  const nodesByLevel = new Map<number, typeof tree.nodes>();
  for (const node of tree.nodes) {
    if (!nodesByLevel.has(node.level)) nodesByLevel.set(node.level, []);
    nodesByLevel.get(node.level)!.push(node);
  }
  for (const [level, nodes] of [...nodesByLevel.entries()].sort(([left], [right]) => left - right)) {
    const created = await tx.wbsNode.createManyAndReturn({
      data: nodes.map((node) => ({
        projectId,
        scheduleVersionId,
        parentId: node.parentKey ? nodeIds.get(node.parentKey) : null,
        nodeKey: node.nodeKey,
        code: node.code,
        name: node.name,
        level,
        sortOrder: node.sortOrder
      })),
      select: { nodeKey: true, wbsNodeId: true }
    });
    for (const node of created) nodeIds.set(node.nodeKey, node.wbsNodeId);
  }

  return new Map([...tree.activityNodeKeys.entries()].flatMap(([activityId, nodeKey]) => {
    const nodeId = nodeIds.get(nodeKey);
    return nodeId ? [[activityId, nodeId] as const] : [];
  }));
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
      validRows: [],
      dependencies: []
    };
  }

  const rejections: RowRejection[] = [];
  const seenActivityIds = new Set<string>();
  const duplicates = new Set<string>();
  const disciplines = new Set<string>();
  const validRows: any[] = [];
  const dependencies: ScheduleDependency[] = [];
  const rowByActivityId = new Map<string, number>();

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

    const parsedDependencies = parsePredecessors(raw.Predecessors, raw.Predecessor_ID);
    if (parsedDependencies.error) {
      rejections.push({ rowIndex, activityId, reason: parsedDependencies.error });
      return;
    }
    if (parsedDependencies.dependencies.some((dependency) => dependency.predecessorActivityId === activityId)) {
      rejections.push({ rowIndex, activityId, reason: "An activity cannot depend on itself." });
      return;
    }

    seenActivityIds.add(activityId);
    rowByActivityId.set(activityId, rowIndex);
    disciplines.add(discipline);

    const area = raw.Area_Unit ? String(raw.Area_Unit).trim() : null;
    const fieldKeywords = raw.Field_Keywords ? String(raw.Field_Keywords).trim() : null;
    const wbs = [raw.WBS_L1, raw.WBS_L2, raw.WBS_L3, raw.WBS_L4, raw.WBS_L5, raw.WBS_L6,
      raw.WBS_Code_L1, raw.WBS_Code_L2, raw.WBS_Code_L3, raw.WBS_Code_L4, raw.WBS_Code_L5, raw.WBS_Code_L6]
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
      wbsCodeL1: raw.WBS_Code_L1 ? String(raw.WBS_Code_L1).trim() : null,
      wbsCodeL2: raw.WBS_Code_L2 ? String(raw.WBS_Code_L2).trim() : null,
      wbsCodeL3: raw.WBS_Code_L3 ? String(raw.WBS_Code_L3).trim() : null,
      wbsCodeL4: raw.WBS_Code_L4 ? String(raw.WBS_Code_L4).trim() : null,
      wbsCodeL5: raw.WBS_Code_L5 ? String(raw.WBS_Code_L5).trim() : null,
      wbsCodeL6: raw.WBS_Code_L6 ? String(raw.WBS_Code_L6).trim() : null,
      discipline,
      area: area ?? "",
      plannedStart,
      plannedFinish,
      plannedDuration,
      predecessorId: parsedDependencies.dependencies[0]?.predecessorActivityId ?? null,
      contractor: raw.Contractor ? String(raw.Contractor).trim() : null,
      fieldKeywords,
      normalizedSearchText,
      activityStatus: "NOT_STARTED" as const
    });
    for (const dependency of parsedDependencies.dependencies) {
      dependencies.push({ ...dependency, successorActivityId: activityId });
    }
  });

  const invalidActivityIds = new Set<string>();
  const activityIds = new Set(validRows.map((row) => row.activityId));
  for (const dependency of dependencies) {
    if (!activityIds.has(dependency.predecessorActivityId)) {
      invalidActivityIds.add(dependency.successorActivityId);
      rejections.push({
        rowIndex: rowByActivityId.get(dependency.successorActivityId) ?? 0,
        activityId: dependency.successorActivityId,
        reason: `Predecessor "${dependency.predecessorActivityId}" is not present in this schedule version.`
      });
    }
  }

  const graphActivityIds = [...activityIds].filter((activityId) => !invalidActivityIds.has(activityId));
  const indegree = new Map(graphActivityIds.map((activityId) => [activityId, 0]));
  const successors = new Map(graphActivityIds.map((activityId) => [activityId, [] as string[]]));
  for (const dependency of dependencies) {
    if (invalidActivityIds.has(dependency.successorActivityId) || invalidActivityIds.has(dependency.predecessorActivityId)) continue;
    successors.get(dependency.predecessorActivityId)?.push(dependency.successorActivityId);
    indegree.set(dependency.successorActivityId, (indegree.get(dependency.successorActivityId) ?? 0) + 1);
  }
  const ready = graphActivityIds.filter((activityId) => indegree.get(activityId) === 0);
  for (let index = 0; index < ready.length; index++) {
    const activityId = ready[index];
    for (const successorId of successors.get(activityId) ?? []) {
      const remaining = (indegree.get(successorId) ?? 0) - 1;
      indegree.set(successorId, remaining);
      if (remaining === 0) ready.push(successorId);
    }
  }
  for (const [activityId, remaining] of indegree) {
    if (remaining > 0) {
      invalidActivityIds.add(activityId);
      rejections.push({ rowIndex: rowByActivityId.get(activityId) ?? 0, activityId, reason: "Dependency graph contains a cycle." });
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const dependency of dependencies) {
      if (invalidActivityIds.has(dependency.predecessorActivityId) && !invalidActivityIds.has(dependency.successorActivityId)) {
        invalidActivityIds.add(dependency.successorActivityId);
        rejections.push({ rowIndex: rowByActivityId.get(dependency.successorActivityId) ?? 0, activityId: dependency.successorActivityId, reason: "A predecessor activity was rejected." });
        changed = true;
      }
    }
  }

  const acceptedRows = validRows.filter((row) => !invalidActivityIds.has(row.activityId));
  const acceptedActivityIds = new Set(acceptedRows.map((row) => row.activityId));
  const acceptedDependencies = dependencies.filter((dependency) =>
    acceptedActivityIds.has(dependency.predecessorActivityId) && acceptedActivityIds.has(dependency.successorActivityId)
  );

  return {
    headerErrors: [],
    summary: {
      totalRows: rows.length,
      imported: acceptedRows.length,
      rejected: rows.length - acceptedRows.length,
      duplicateActivityIds: Array.from(duplicates),
      disciplinesDetected: Array.from(disciplines),
      rejections
    },
    validRows: acceptedRows,
    dependencies: acceptedDependencies
  };
}

function toVersionActivity(row: any, scheduleVersionId: string, wbsNodeId?: string) {
  const {
    projectId: importedProjectId,
    wbsCodeL1: _wbsCodeL1,
    wbsCodeL2: _wbsCodeL2,
    wbsCodeL3: _wbsCodeL3,
    wbsCodeL4: _wbsCodeL4,
    wbsCodeL5: _wbsCodeL5,
    wbsCodeL6: _wbsCodeL6,
    ...activity
  } = row;
  void importedProjectId;
  return { ...activity, scheduleVersionId, wbsNodeId: wbsNodeId ?? null };
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
    const wbsNodeIds = await createWbsNodes(tx, formProjectId, scheduleVersionId, validRows);

    if (validRows.length > 0) {
      await tx.scheduleVersionActivity.createMany({
        data: validRows.map((row) => toVersionActivity(row, scheduleVersionId, wbsNodeIds.get(row.activityId)))
      });
    }
    if (prepared.dependencies.length > 0) {
      await tx.scheduleVersionDependency.createMany({
        data: prepared.dependencies.map((dependency) => ({ ...dependency, scheduleVersionId }))
      });
    }
    if (validRows.length > 0 && summary.imported > 0 && summary.rejected === 0) {
      await tx.scheduleActivity.createMany({
        data: validRows.map((row) => {
          const {
            wbsCodeL1: _wbsCodeL1,
            wbsCodeL2: _wbsCodeL2,
            wbsCodeL3: _wbsCodeL3,
            wbsCodeL4: _wbsCodeL4,
            wbsCodeL5: _wbsCodeL5,
            wbsCodeL6: _wbsCodeL6,
            ...activity
          } = row;
          return { ...activity, wbsNodeId: wbsNodeIds.get(row.activityId) ?? null };
        })
      });
      if (prepared.dependencies.length > 0) {
        await tx.scheduleDependency.createMany({
          data: prepared.dependencies.map((dependency) => ({ ...dependency, projectId: formProjectId }))
        });
      }
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
    const wbsNodeIds = await createWbsNodes(tx, projectId, scheduleVersion.scheduleVersionId, prepared.validRows);

    if (prepared.validRows.length > 0) {
      await tx.scheduleVersionActivity.createMany({
        data: prepared.validRows.map((row) => toVersionActivity(row, scheduleVersion.scheduleVersionId, wbsNodeIds.get(row.activityId)))
      });
    }
    if (prepared.dependencies.length > 0) {
      await tx.scheduleVersionDependency.createMany({
        data: prepared.dependencies.map((dependency) => ({ ...dependency, scheduleVersionId: scheduleVersion.scheduleVersionId }))
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
      include: { activities: true, dependencies: true }
    });
    if (!version) throw new Error("Schedule version not found.");
    if (version.status !== "VALIDATED" || version.rejectedRows > 0) {
      throw new Error("Only a fully validated schedule version can be approved.");
    }
    if (version.activities.length === 0) throw new Error("A schedule version must contain at least one activity.");

    const versionActivityIds = new Set(version.activities.map((activity) => activity.activityId));
    const invalidDependency = version.dependencies.find((dependency) =>
      dependency.predecessorActivityId === dependency.successorActivityId ||
      !versionActivityIds.has(dependency.predecessorActivityId) ||
      !versionActivityIds.has(dependency.successorActivityId)
    );
    if (invalidDependency) throw new Error("Every schedule dependency must connect two different activities in the version.");
    if (hasDependencyCycle([...versionActivityIds], version.dependencies)) {
      throw new Error("The schedule dependency graph contains a cycle and cannot be activated.");
    }

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
        "plannedDuration", "activityStatus", "isCurrentSchedule", "wbsNodeId", "predecessorId", "fieldKeywords", "normalizedSearchText"
      )
      SELECT incoming."activityId", ${projectId}, incoming."activityName", incoming."discipline", incoming."area", incoming."contractor",
        incoming."wbsL1", incoming."wbsL2", incoming."wbsL3", incoming."wbsL4", incoming."wbsL5", incoming."wbsL6",
        incoming."plannedStart", incoming."plannedFinish", incoming."plannedDuration", incoming."activityStatus", true, incoming."wbsNodeId",
        incoming."predecessorId", incoming."fieldKeywords", incoming."normalizedSearchText"
      FROM jsonb_to_recordset(${serializedActivities}::jsonb) AS incoming(
        "activityId" text, "activityName" text, "discipline" text, "area" text, "contractor" text,
        "wbsL1" text, "wbsL2" text, "wbsL3" text, "wbsL4" text, "wbsL5" text, "wbsL6" text,
        "plannedStart" timestamp, "plannedFinish" timestamp, "plannedDuration" integer, "activityStatus" text,
        "wbsNodeId" text, "predecessorId" text, "fieldKeywords" text, "normalizedSearchText" text
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
        "wbsNodeId" = EXCLUDED."wbsNodeId",
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
    await tx.scheduleDependency.deleteMany({ where: { projectId } });
    if (version.dependencies.length > 0) {
      await tx.scheduleDependency.createMany({
        data: version.dependencies.map((dependency) => ({
          projectId,
          predecessorActivityId: dependency.predecessorActivityId,
          successorActivityId: dependency.successorActivityId,
          dependencyType: dependency.dependencyType,
          lagDays: dependency.lagDays
        }))
      });
    }
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
