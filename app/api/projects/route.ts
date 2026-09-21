import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });

  const withStats = await Promise.all(
    projects.map(async (p) => {
      const activities = await prisma.scheduleActivity.findMany({ where: { projectId: p.projectId } });
      const total = activities.length;
      const completed = activities.filter((a) => a.activityStatus === "COMPLETED").length;
      const inProgress = activities.filter((a) => a.activityStatus === "IN_PROGRESS").length;
      const delayed = activities.filter((a) => a.activityStatus === "DELAYED").length;
      const pendingAudits = await prisma.aiActivityMatch.count({
        where:  { projectId: p.projectId , decision: "FLAG_FOR_REVIEW" }
      });
      return {
        projectId: p.projectId,
        projectName: p.projectName,
        createdAt: p.createdAt,
        totalActivities: total,
        overallProgressPct: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
        completedActivities: completed,
        inProgressActivities: inProgress,
        delayedActivities: delayed,
        pendingAiAuditReviews: pendingAudits
      };
    })
  );

  return NextResponse.json({ projects: withStats });
}
