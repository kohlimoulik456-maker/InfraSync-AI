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
    .filter((transaction) => transaction.transactionType === "RECEIPT")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const used = transactions
    .filter((transaction) => transaction.transactionType === "EXPENDITURE")
    .reduce((total, transaction) => total + transaction.amount, 0);

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

  const pendingAudits = await prisma.aiActivityMatch.count({
    where: {
      projectId,
      decision: "FLAG_FOR_REVIEW"
    }
  });

  const lastUpdate = await prisma.supervisorUpdate.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });

  const overallProgress = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

  const now = new Date();
  const scheduleVarianceActivities = activities.filter(
    (a) => a.plannedFinish < now && a.activityStatus !== "COMPLETED"
  ).length;

  return {
    overallProgressPct: overallProgress,
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
  const activities = await prisma.scheduleActivity.findMany({ where: { projectId } });
  const now = new Date();
  const total = activities.length || 1;
  const plannedComplete = activities.filter((a) => a.plannedFinish <= now).length;
  const actualComplete = activities.filter((a) => a.activityStatus === "COMPLETED").length;
  return {
    plannedCompletionPct: Math.round((plannedComplete / total) * 1000) / 10,
    actualCompletionPct: Math.round((actualComplete / total) * 1000) / 10
  };
}

export async function getActivityStatusAnalysis(projectId: string, filters: DashboardFilters = {}) {
  const activities = await prisma.scheduleActivity.findMany({ where: activityWhere(projectId, filters) });
  const byStatus = {
    COMPLETED: activities.filter((a) => a.activityStatus === "COMPLETED").length,
    IN_PROGRESS: activities.filter((a) => a.activityStatus === "IN_PROGRESS").length,
    DELAYED: activities.filter((a) => a.activityStatus === "DELAYED").length,
    NOT_STARTED: activities.filter((a) => a.activityStatus === "NOT_STARTED").length
  };

  const rows = await Promise.all(
    activities.map(async (a) => {
      const latestActual = await prisma.activityActual.findFirst({
        where: { activityId: a.activityId },
        orderBy: { verifiedAt: "desc" }
      });
      const latestMatch = await prisma.aiActivityMatch.findFirst({
        where: { activityId: a.activityId },
        orderBy: { createdAt: "desc" }
      });
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
    })
  );

  return { byStatus, rows };
}

const DISCIPLINES = ["CIVIL", "PIPING", "ELECTRICAL", "INSTRUMENTATION", "MECHANICAL", "HSE"];

export async function getDisciplinePerformance(projectId: string) {
  return Promise.all(
    DISCIPLINES.map(async (discipline) => {
      const activities = await prisma.scheduleActivity.findMany({ where: { projectId, discipline } });
      const total = activities.length;
      const completed = activities.filter((a) => a.activityStatus === "COMPLETED").length;
      const delayed = activities.filter((a) => a.activityStatus === "DELAYED").length;

      const matches = await prisma.aiActivityMatch.findMany({
        where: { 
          projectId,
          activity: { discipline }
        }
      });
      const pendingAudits = matches.filter((m) => m.decision === "FLAG_FOR_REVIEW").length;
      const avgConfidence =
        matches.length > 0
          ? Math.round((matches.reduce((s, m) => s + m.overallConfidence, 0) / matches.length) * 10) / 10
          : null;

      const updateCount = await prisma.supervisorUpdate.count({ where: { projectId, discipline } });

      return {
        discipline,
        progressPct: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
        delayedActivities: delayed,
        pendingAudits,
        avgConfidence,
        updateCount
      };
    })
  );
}

export async function getAiConfidenceAnalysis(projectId: string) {
  const matches = await prisma.aiActivityMatch.findMany({ where: { projectId } });
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
    where: { activity: { projectId } },
    include: { activity: true }
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

  return {
    delayedActivitiesCount: delayed.length,
    totalDelayDays,
    delayDaysByDiscipline: byDiscipline,
    delayReasonDistribution: reasonCounts
  };
}

export async function getCriticalAtRiskActivities(projectId: string) {
  const activities = await prisma.scheduleActivity.findMany({ where: { projectId } });
  const now = new Date();
  const results = [];

  for (const a of activities) {
    const flags: string[] = [];
    if (a.plannedFinish < now && a.activityStatus !== "COMPLETED") flags.push("Planned finish passed but not complete");

    const latestActual = await prisma.activityActual.findFirst({
      where: { activityId: a.activityId },
      orderBy: { verifiedAt: "desc" }
    });
    if (latestActual?.actualFinish && latestActual.actualFinish > a.plannedFinish) {
      flags.push("Actual finish later than planned");
    }
    if (a.predecessorId) {
      const predecessor = await prisma.scheduleActivity.findUnique({ where: { activityId: a.predecessorId } });
      if (predecessor && predecessor.activityStatus !== "COMPLETED") flags.push("Predecessor incomplete");
    }
    const pendingAudit = await prisma.aiActivityMatch.findFirst({
      where: { activityId: a.activityId, decision: "FLAG_FOR_REVIEW" }
    });
    if (pendingAudit) flags.push("Pending AI audit");
    if (a.activityStatus === "DELAYED") flags.push("Status = DELAYED");

    const updateCount = await prisma.supervisorUpdate.count({
      where: { projectId, discipline: a.discipline }
    });
    if (updateCount === 0) flags.push("Low reporting coverage");

    if (flags.length > 0) {
      results.push({ activityId: a.activityId, activityName: a.activityName, flags });
    }
  }
  return results;
}

export async function getSupervisorReportingAnalysis(projectId: string) {
  const updates = await prisma.supervisorUpdate.findMany({ where: { projectId } });
  const bySupervisor: Record<string, number> = {};
  const byDiscipline: Record<string, number> = {};
  const byArea: Record<string, number> = {};
  for (const u of updates) {
    bySupervisor[u.supervisorId] = (bySupervisor[u.supervisorId] ?? 0) + 1;
    const d = u.discipline ?? "UNSPECIFIED";
    byDiscipline[d] = (byDiscipline[d] ?? 0) + 1;
    const a = u.areaUnit ?? "UNSPECIFIED";
    byArea[a] = (byArea[a] ?? 0) + 1;
  }

  const pending = await prisma.aiActivityMatch.count({
    where: { projectId, decision: "FLAG_FOR_REVIEW" }
  });
  const invalid = await prisma.aiActivityMatch.count({
    where: { projectId, matchStatus: "INVALID" }
  });

  const latestFeed = await prisma.supervisorUpdate.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return {
    totalUpdates: updates.length,
    bySupervisor,
    byDiscipline,
    byArea,
    pendingUpdates: pending,
    invalidUpdates: invalid,
    latestFeed
  };
}

export async function getInstitutionalMemorySnapshot(projectId: string) {
  const verifiedCount = await prisma.activityActual.count({ where: { activity: { projectId } } });
  const lessonCount = await prisma.lessonLearned.count({ where: { projectId, approved: true } });
  const lessons = await prisma.lessonLearned.findMany({ where: { projectId, approved: true } });
  const reasonCounts: Record<string, number> = {};
  for (const l of lessons) {
    if (!l.delayReason) continue;
    reasonCounts[l.delayReason] = (reasonCounts[l.delayReason] ?? 0) + 1;
  }
  return { verifiedRecordCount: verifiedCount, lessonCount, commonDelayReasons: reasonCounts };
}
