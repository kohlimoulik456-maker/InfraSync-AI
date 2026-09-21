import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") || undefined;
  const decision = searchParams.get("decision") || undefined;
  const matchStatus = searchParams.get("matchStatus") || undefined;

  const matches = await prisma.aiActivityMatch.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(decision ? { decision: decision as any } : {}),
      ...(matchStatus ? { matchStatus: matchStatus as any } : {})
    },
    include: { update: true, activity: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({ matches });
}
