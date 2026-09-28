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
            plannedDuration: true
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

    const forecast = calculateCpm(version.activities, version.dependencies);
    return NextResponse.json({ versionNumber: version.versionNumber, forecast });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not calculate the CPM forecast." }, { status: 400 });
  }
}