import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  // Single query for all projects
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });

  if (projects.length === 0) return NextResponse.json({ projects: [] });

  const projectIds = projects.map((p) => p.projectId);

  // Batch fetch activities and audits in parallel — 2 queries total instead of N*2
  const [activities, auditCounts] = await Promise.all([
    prisma.scheduleActivity.findMany({
      where: { projectId: { in: projectIds } },
      select: { projectId: true, activityStatus: true },
    }),
    prisma.aiActivityMatch.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, decision: "FLAG_FOR_REVIEW" },
      _count: { _all: true },
    }),
  ]);

  // Index for O(1) lookups
  const auditMap = new Map(auditCounts.map((a) => [a.projectId, a._count._all]));

  const activityMap = new Map<string, { total: number; completed: number; inProgress: number; delayed: number }>();
  for (const a of activities) {
    if (!activityMap.has(a.projectId)) {
      activityMap.set(a.projectId, { total: 0, completed: 0, inProgress: 0, delayed: 0 });
    }
    const entry = activityMap.get(a.projectId)!;
    entry.total++;
    if (a.activityStatus === "COMPLETED") entry.completed++;
    else if (a.activityStatus === "IN_PROGRESS") entry.inProgress++;
    else if (a.activityStatus === "DELAYED") entry.delayed++;
  }

  const withStats = projects.map((p) => {
    const stats = activityMap.get(p.projectId) ?? { total: 0, completed: 0, inProgress: 0, delayed: 0 };
    return {
      projectId: p.projectId,
      projectName: p.projectName,
      createdAt: p.createdAt,
      totalActivities: stats.total,
      overallProgressPct: stats.total > 0 ? Math.round((stats.completed / stats.total) * 1000) / 10 : 0,
      completedActivities: stats.completed,
      inProgressActivities: stats.inProgress,
      delayedActivities: stats.delayed,
      pendingAiAuditReviews: auditMap.get(p.projectId) ?? 0,
    };
  });

  return NextResponse.json({ projects: withStats });
}
