import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUnique({ where: { projectId: params.projectId } });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const activities = await prisma.scheduleActivity.findMany({
    where: { projectId: params.projectId },
    select: {
      activityId: true,
      activityName: true,
      discipline: true,
      area: true,
      activityStatus: true,
      plannedStart: true,
      plannedFinish: true,
    },
    orderBy: [{ discipline: "asc" }, { activityName: "asc" }],
  });

  return NextResponse.json({ activities });
}
