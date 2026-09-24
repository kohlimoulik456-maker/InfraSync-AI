import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUnique({ where: { projectId: params.projectId } });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const activities = await prisma.scheduleActivity.findMany({ where: { projectId: params.projectId } });
  const disciplines = Array.from(new Set(activities.map((a) => a.discipline)));
  const areas = Array.from(new Set(activities.map((a) => a.area).filter(Boolean)));
  const contractors = Array.from(new Set(activities.map((a) => a.contractor).filter(Boolean)));

  return NextResponse.json({ project, disciplines, areas, contractors, activityCount: activities.length });
}
export const dynamic = "force-dynamic";
