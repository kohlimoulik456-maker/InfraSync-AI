import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCpm } from "@/lib/services/scheduleCalculationService";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string; versionId: string } }) {
  try {
    const version = await prisma.scheduleVersion.findFirst({
      where: { projectId: params.projectId, scheduleVersionId: params.versionId },
      include: {
        activities: {
          select: {
            activityId: true,
            activityName: true,
            plannedStart: true,
            plannedFinish: true,
            plannedDuration: true,
            activityStatus: true
          }
        },
        dependencies: {
          select: {
            predecessorActivityId: true,
            successorActivityId: true,
            dependencyType: true,
            lagDays: true
          }
        }
      }
    });
    if (!version) return NextResponse.json({ error: "Schedule version not found." }, { status: 404 });
    if (version.status !== "CURRENT" && version.status !== "VALIDATED") {
      return NextResponse.json({ error: "CPM can only be calculated for a validated or current schedule version." }, { status: 400 });
    }
    if (version.rejectedRows > 0 || version.activities.length === 0) {
      return NextResponse.json({ error: "Forecast requires a schedule version with activities and no rejected rows." }, { status: 400 });
    }

    const activityIds = version.activities.map((activity) => activity.activityId);
    const [currentActivities, progressRows, actualStartRows, actualFinishRows] = await Promise.all([
      prisma.scheduleActivity.findMany({
        where: { projectId: params.projectId, activityId: { in: activityIds } },
        select: { activityId: true, activityStatus: true }
      }),
      prisma.activityActual.findMany({
        where: { activityId: { in: activityIds }, progressValue: { not: null } },
        orderBy: [{ activityId: "asc" }, { verifiedAt: "desc" }, { id: "desc" }],
        distinct: ["activityId"],
        select: { activityId: true, progressValue: true }
      }),
      prisma.activityActual.findMany({
        where: { activityId: { in: activityIds }, actualStart: { not: null } },
        orderBy: [{ activityId: "asc" }, { verifiedAt: "desc" }, { id: "desc" }],
        distinct: ["activityId"],
        select: { activityId: true, actualStart: true }
      }),
      prisma.activityActual.findMany({
        where: { activityId: { in: activityIds }, actualFinish: { not: null } },
        orderBy: [{ activityId: "asc" }, { verifiedAt: "desc" }, { id: "desc" }],
        distinct: ["activityId"],
        select: { activityId: true, actualFinish: true }
      })
    ]);
    const statusByActivity = new Map(currentActivities.map((activity) => [activity.activityId, activity.activityStatus]));
    const progressByActivity = new Map(progressRows.map((actual) => [actual.activityId, actual.progressValue]));
    const actualStartByActivity = new Map(actualStartRows.map((actual) => [actual.activityId, actual.actualStart]));
    const actualFinishByActivity = new Map(actualFinishRows.map((actual) => [actual.activityId, actual.actualFinish]));
    const forecast = calculateCpm(version.activities.map((activity) => {
      return {
        ...activity,
        activityStatus: statusByActivity.get(activity.activityId) ?? activity.activityStatus,
        progressValue: progressByActivity.get(activity.activityId) ?? null,
        actualStart: actualStartByActivity.get(activity.activityId) ?? null,
        actualFinish: actualFinishByActivity.get(activity.activityId) ?? null
      };
    }), version.dependencies, { dataDate: new Date() });
    return NextResponse.json({ versionNumber: version.versionNumber, forecast });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not calculate the CPM forecast." }, { status: 400 });
  }
}