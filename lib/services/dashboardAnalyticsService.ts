import { prisma } from "../prisma";

export interface DashboardFilters {
  discipline?: string;
  area?: string;
  contractor?: string;
  activityStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  minConfidence?: number;
  maxConfidence?: number;
}

export async function getFundTracing(projectId: string) {
  const transactions = await prisma.fundTransaction.findMany({
    where: { projectId },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }]
  });

  const received = transactions
    .filter((t) => t.transactionType === "RECEIPT")
    .reduce((s, t) => s + t.amount, 0);
  const used = transactions
    .filter((t) => t.transactionType === "EXPENDITURE")
    .reduce((s, t) => s + t.amount, 0);

  return {
    received,
    used,
    remaining: received - used,
    manager: transactions[0]?.manager ?? "Project Manager",
    asOf: transactions[0]?.transactionDate ?? null,
    transactions
  };
}

function activityWhere(projectId: string, f: DashboardFilters) {
  return {
    projectId,
    isCurrentSchedule: true,
    ...(f.discipline ? { discipline: f.discipline } : {}),
    ...(f.area ? { area: f.area } : {}),
    ...(f.contractor ? { contractor: f.contractor } : {}),
    ...(f.activityStatus ? { activityStatus: f.activityStatus as any } : {})
  };
}

export async function getProjectHealthOverview(projectId: string, filters: DashboardFilters = {}) {
  const activities = await prisma.scheduleActivity.findMany({ where: activityWhere(projectId, filters) });
  const total = activities.length;
  const completed = activities.filter((a) => a.activityStatus === "COMPLETED").length;
  const inProgress = activities.filter((a) => a.activityStatus === "IN_PROGRESS").length;
  const delayed = activities.filter((a) => a.activityStatus === "DELAYED").length;
  const notStarted = activities.filter((a) => a.activityStatus === "NOT_STARTED").length;

  const [pendingAudits, lastUpdate] = await Promise.all([
    prisma.aiActivityMatch.count({ where: { projectId, decision: "FLAG_FOR_REVIEW", activity: { isCurrentSchedule: true } } }),
    prisma.supervisorUpdate.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } })
  ]);

  const now = new Date();
  const scheduleVarianceActivities = activities.filter(
    (a) => a.plannedFinish < now && a.activityStatus !== "COMPLETED"
  ).length;

  return {
    overallProgressPct: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
    completedActivities: completed,
    inProgressActivities: inProgress,
    delayedActivities: delayed,
    notStartedActivities: notStarted,
    pendingAiAudits: pendingAudits,
    scheduleVarianceActivities,
    lastSupervisorUpdate: lastUpdate?.createdAt ?? null,
    totalActivities: total
  };
}

export async function getPlannedVsActual(projectId: string) {
  const activities = await prisma.scheduleActivity.findMany({ where: { projectId, isCurrentSchedule: true } });
  const now = new Date();
  const total = activities.length || 1;
  const plannedComplete = activities.filter((a) => a.plannedFinish <= now).length;
  const actualComplete = activities.filter((a) => a.activityStatus === "COMPLETED").length;
  return {
    plannedCompletionPct: Math.round((plannedComplete / total) * 1000) / 10,
    actualCompletionPct: Math.round((actualComplete / total) * 1000) / 10
  };
}

// ─── FIXED: was 1+2N queries, now 3 queries total ────────────────────────────
export async function getActivityStatusAnalysis(projectId: string, filters: DashboardFilters = {}) {
  const activityIds_raw = await prisma.scheduleActivity.findMany({
    where: activityWhere(projectId, filters),
    select: { activityId: true }
  });
  const ids = activityIds_raw.map((a) => a.activityId);

  // Fetch all in parallel — 3 queries total regardless of activity count
  const [activities, allActuals, allMatches] = await Promise.all([
    prisma.scheduleActivity.findMany({ where: activityWhere(projectId, filters) }),
    prisma.activityActual.findMany({
      where: { activityId: { in: ids } },
      orderBy: { verifiedAt: "desc" }
    }),
    prisma.aiActivityMatch.findMany({
      where: { activityId: { in: ids } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  // Build lookup maps for O(1) access
  const latestActualMap = new Map<string, typeof allActuals[0]>();
  for (const actual of allActuals) {
    if (!latestActualMap.has(actual.activityId)) {
      latestActualMap.set(actual.activityId, actual); // already ordered desc
    }
  }
  const latestMatchMap = new Map<string, typeof allMatches[0]>();
  for (const match of allMatches) {
    if (match.activityId && !latestMatchMap.has(match.activityId)) {
      latestMatchMap.set(match.activityId, match);
    }
  }

  const byStatus = {
    COMPLETED: activities.filter((a) => a.activityStatus === "COMPLETED").length,
    IN_PROGRESS: activities.filter((a) => a.activityStatus === "IN_PROGRESS").length,
    DELAYED: activities.filter((a) => a.activityStatus === "DELAYED").length,
    NOT_STARTED: activities.filter((a) => a.activityStatus === "NOT_STARTED").length
  };

  const rows = activities.map((a) => {
    const latestActual = latestActualMap.get(a.activityId);
    const latestMatch = latestMatchMap.get(a.activityId);
    return {
      activityId: a.activityId,
      activityName: a.activityName,
      wbs: [a.wbsL1, a.wbsL2, a.wbsL3, a.wbsL4, a.wbsL5, a.wbsL6].filter(Boolean).join(" / "),
      discipline: a.discipline,
      area: a.area,
      plannedFinish: a.plannedFinish,
      actualFinish: latestActual?.actualFinish ?? null,
      status: a.activityStatus,
      progress: latestActual?.progressValue ?? null,
      delayDays: latestActual?.delayDays ?? null,
      latestConfidence: latestMatch?.overallConfidence ?? null
    };
  });

  return { byStatus, rows };
}

// ─── FIXED: was 18 queries, now 3 queries total ───────────────────────────────
export async function getDisciplinePerformance(projectId: string) {
  // Fetch all data in 3 parallel queries, aggregate in JS
  const [activities, matches, updateCounts] = await Promise.all([
    prisma.scheduleActivity.findMany({
      where: { projectId, isCurrentSchedule: true },
      select: { discipline: true, activityStatus: true }
    }),
    prisma.aiActivityMatch.findMany({
      where: { projectId, activity: { isCurrentSchedule: true } },
      select: { decision: true, overallConfidence: true, activity: { select: { discipline: true } } }
    }),
    prisma.supervisorUpdate.groupBy({
      by: ["discipline"],
      where: { projectId },
      _count: { _all: true }
    })
  ]);

  // Build discipline → update count map
  const updateCountMap = new Map<string, number>();
  for (const row of updateCounts) {
    if (row.discipline) updateCountMap.set(row.discipline, row._count._all);
  }

  // Get unique disciplines from actual data + known defaults
  const DISCIPLINES = ["CIVIL", "PIPING", "ELECTRICAL", "INSTRUMENTATION", "MECHANICAL", "HSE"];
  const allDisciplines = Array.from(new Set([
    ...DISCIPLINES,
    ...activities.map((a) => a.discipline)
  ]));

  return allDisciplines.map((discipline) => {
    const disc_activities = activities.filter((a) => a.discipline === discipline);
    const total = disc_activities.length;
    const completed = disc_activities.filter((a) => a.activityStatus === "COMPLETED").length;
    const delayed = disc_activities.filter((a) => a.activityStatus === "DELAYED").length;

    const disc_matches = matches.filter((m) => m.activity?.discipline === discipline);
    const pendingAudits = disc_matches.filter((m) => m.decision === "FLAG_FOR_REVIEW").length;
    const avgConfidence =
      disc_matches.length > 0
        ? Math.round((disc_matches.reduce((s, m) => s + m.overallConfidence, 0) / disc_matches.length) * 10) / 10
        : null;

    return {
      discipline,
      progressPct: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
      delayedActivities: delayed,
      pendingAudits,
      avgConfidence,
      updateCount: updateCountMap.get(discipline) ?? 0
    };
  }).filter((d) => d.discipline); // remove any empty discipline entries
}

export async function getAiConfidenceAnalysis(projectId: string) {
  const matches = await prisma.aiActivityMatch.findMany({ where: { projectId, activity: { isCurrentSchedule: true } } });
  const byDecision = {
    AUTO_ACCEPT: matches.filter((m) => m.decision === "AUTO_ACCEPT").length,
    ACCEPT_MONITOR: matches.filter((m) => m.decision === "ACCEPT_MONITOR").length,
    FLAG_FOR_REVIEW: matches.filter((m) => m.decision === "FLAG_FOR_REVIEW").length,
    NO_MATCH: matches.filter((m) => m.decision === "NO_MATCH").length,
    REJECTED: matches.filter((m) => m.decision === "REJECTED").length
  };
  const avg = (pick: (m: (typeof matches)[number]) => number | null) => {
    const values = matches.map(pick).filter((v): v is number => v != null);
    if (values.length === 0) return null;
    return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
  };

  const avgConfidence = avg((m) => m.overallConfidence);
  const byCriterion = [
    { key: "semantic", label: "Semantic Similarity", weight: 40, value: avg((m) => m.semanticSimilarity) },
    { key: "schedule", label: "Schedule Consistency", weight: 25, value: avg((m) => m.scheduleConsistency) },
    { key: "context", label: "Context Match", weight: 20, value: avg((m) => m.contextMatch) },
    { key: "rules", label: "Rule Validation", weight: 15, value: avg((m) => m.ruleValidation) }
  ];

  const buckets = [
    { label: "0-59", count: matches.filter((m) => m.overallConfidence < 60).length },
    { label: "60-79", count: matches.filter((m) => m.overallConfidence >= 60 && m.overallConfidence < 80).length },
    { label: "80-89", count: matches.filter((m) => m.overallConfidence >= 80 && m.overallConfidence < 90).length },
    { label: "90-100", count: matches.filter((m) => m.overallConfidence >= 90).length }
  ];

  return { byDecision, avgConfidence, byCriterion, distribution: buckets, table: matches.slice(0, 100) };
}

export async function getDelayVarianceAnalysis(projectId: string) {
  const actuals = await prisma.activityActual.findMany({
    where: { activity: { projectId, isCurrentSchedule: true } },
    include: { activity: { select: { discipline: true } } }
  });
  const delayed = actuals.filter((a) => (a.delayDays ?? 0) > 0);
  const totalDelayDays = delayed.reduce((s, a) => s + (a.delayDays ?? 0), 0);

  const byDiscipline: Record<string, number> = {};
  for (const a of delayed) {
    const d = a.activity.discipline;
    byDiscipline[d] = (byDiscipline[d] ?? 0) + (a.delayDays ?? 0);
  }

  const reasonBuckets = ["Material", "Manpower", "Equipment", "Weather", "Approval", "Design Change", "Other"];
  const reasonCounts: Record<string, number> = Object.fromEntries(reasonBuckets.map((r) => [r, 0]));
  for (const a of delayed) {
    const reason = a.delayReason?.trim();
    const matched = reasonBuckets.find((b) => reason?.toLowerCase().includes(b.toLowerCase()));
    reasonCounts[matched ?? "Other"]++;
  }

  return { delayedActivitiesCount: delayed.length, totalDelayDays, delayDaysByDiscipline: byDiscipline, delayReasonDistribution: reasonCounts };
}

// ─── FIXED: was up to 2001 serial queries, now 5 queries total ───────────────
export async function getCriticalAtRiskActivities(projectId: string) {
  const activities = await prisma.scheduleActivity.findMany({ where: { projectId, isCurrentSchedule: true } });
  if (activities.length === 0) return [];

  const activityIds = activities.map((a) => a.activityId);
  const disciplines = [...new Set(activities.map((a) => a.discipline))];

  // 4 parallel batch queries instead of 4N serial queries
  const [latestActuals, pendingAudits, dependencies, updateCounts] = await Promise.all([
    // Latest actual per activity
    prisma.activityActual.findMany({
      where: { activityId: { in: activityIds } },
      orderBy: { verifiedAt: "desc" },
      distinct: ["activityId"],
      select: { activityId: true, actualFinish: true }
    }),
    // All FLAG_FOR_REVIEW matches for this project
    prisma.aiActivityMatch.findMany({
      where: { activityId: { in: activityIds }, decision: "FLAG_FOR_REVIEW" },
      select: { activityId: true }
    }),
    prisma.scheduleDependency.findMany({
      where: { projectId, successorActivityId: { in: activityIds } },
      select: { predecessorActivityId: true, successorActivityId: true }
    }),
    // Update count per discipline in one groupBy
    prisma.supervisorUpdate.groupBy({
      by: ["discipline"],
      where: { projectId },
      _count: { _all: true }
    })
  ]);

  const predecessorIds = [...new Set(dependencies.map((dependency) => dependency.predecessorActivityId))];
  const predecessors = predecessorIds.length > 0
    ? await prisma.scheduleActivity.findMany({
        where: { projectId, activityId: { in: predecessorIds }, isCurrentSchedule: true },
        select: { activityId: true, activityStatus: true }
      })
    : [];

  // Build O(1) lookup maps
  const actualMap = new Map(latestActuals.map((a) => [a.activityId, a]));
  const pendingAuditSet = new Set(pendingAudits.map((m) => m.activityId));
  const predecessorMap = new Map(predecessors.map((p) => [p.activityId, p.activityStatus]));
  const dependencyMap = new Map<string, string[]>();
  for (const dependency of dependencies) {
    const predecessorsForActivity = dependencyMap.get(dependency.successorActivityId) ?? [];
    predecessorsForActivity.push(dependency.predecessorActivityId);
    dependencyMap.set(dependency.successorActivityId, predecessorsForActivity);
  }
  const updateCountMap = new Map(updateCounts.map((u) => [u.discipline, u._count._all]));

  const now = new Date();
  const results = [];

  for (const a of activities) {
    const flags: string[] = [];

    if (a.plannedFinish < now && a.activityStatus !== "COMPLETED") {
      flags.push("Planned finish passed but not complete");
    }
    const latestActual = actualMap.get(a.activityId);
    if (latestActual?.actualFinish && latestActual.actualFinish > a.plannedFinish) {
      flags.push("Actual finish later than planned");
    }
    if ((dependencyMap.get(a.activityId) ?? []).some((predecessorId) => predecessorMap.get(predecessorId) !== "COMPLETED")) {
      flags.push("Predecessor incomplete");
    }
    if (pendingAuditSet.has(a.activityId)) flags.push("Pending AI audit");
    if (a.activityStatus === "DELAYED") flags.push("Status = DELAYED");
    if ((updateCountMap.get(a.discipline) ?? 0) === 0) flags.push("Low reporting coverage");

    if (flags.length > 0) {
      results.push({ activityId: a.activityId, activityName: a.activityName, flags });
    }
  }

  return results;
}

export async function getSupervisorReportingAnalysis(projectId: string) {
  const [updates, pendingInvalid, latestFeed] = await Promise.all([
    prisma.supervisorUpdate.findMany({ where: { projectId } }),
    // Combined count in one groupBy instead of 2 separate count queries
    prisma.aiActivityMatch.groupBy({
      by: ["decision", "matchStatus"],
      where: { projectId },
      _count: { _all: true }
    }),
    prisma.supervisorUpdate.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 10
    })
  ]);

  const bySupervisor: Record<string, number> = {};
  const byDiscipline: Record<string, number> = {};
  const byArea: Record<string, number> = {};
  for (const u of updates) {
    bySupervisor[u.supervisorId] = (bySupervisor[u.supervisorId] ?? 0) + 1;
    byDiscipline[u.discipline ?? "UNSPECIFIED"] = (byDiscipline[u.discipline ?? "UNSPECIFIED"] ?? 0) + 1;
    byArea[u.areaUnit ?? "UNSPECIFIED"] = (byArea[u.areaUnit ?? "UNSPECIFIED"] ?? 0) + 1;
  }

  const pending = pendingInvalid.find((r) => r.decision === "FLAG_FOR_REVIEW")?._count._all ?? 0;
  const invalid = pendingInvalid.find((r) => r.matchStatus === "INVALID")?._count._all ?? 0;

  return { totalUpdates: updates.length, bySupervisor, byDiscipline, byArea, pendingUpdates: pending, invalidUpdates: invalid, latestFeed };
}

export async function getInstitutionalMemorySnapshot(projectId: string) {
  // Removed redundant count query — use lessons.length instead
  const [verifiedCount, lessons] = await Promise.all([
    prisma.activityActual.count({ where: { activity: { projectId, isCurrentSchedule: true } } }),
    prisma.lessonLearned.findMany({ where: { projectId, approved: true } })
  ]);

  const reasonCounts: Record<string, number> = {};
  for (const l of lessons) {
    if (!l.delayReason) continue;
    reasonCounts[l.delayReason] = (reasonCounts[l.delayReason] ?? 0) + 1;
  }
  return { verifiedRecordCount: verifiedCount, lessonCount: lessons.length, commonDelayReasons: reasonCounts };
}
