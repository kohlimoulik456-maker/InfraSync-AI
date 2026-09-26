import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyVerifiedActual } from "@/lib/services/activityActualsService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { matchId: string } }) {
  const match = await prisma.aiActivityMatch.findUnique({
    where: { id: params.matchId },
    include: { update: true, activity: true }
  });
  if (!match) return NextResponse.json({ error: "Audit record not found." }, { status: 404 });
  return NextResponse.json({ match });
}

type ManagerAction = "APPROVE" | "SELECT_DIFFERENT" | "MARK_UNMATCHED" | "REJECT_INVALID";

export async function POST(req: NextRequest, { params }: { params: { matchId: string } }) {
  try {
    const body = await req.json();
    const action: ManagerAction = body.action;
    const reviewedBy: string = body.reviewed_by || "Program Manager";
    const selectedActivityId: string | undefined = body.selected_activity_id;

    const match = await prisma.aiActivityMatch.findUnique({
      where: { id: params.matchId },
      include: { update: true }
    });
    if (!match) return NextResponse.json({ error: "Audit record not found." }, { status: 404 });

    // Build fallback from the real supervisorUpdate fields (they exist in schema)
    const fallback = {
      actualStartDate: match.update.actualStartDate ?? null,
      actualFinishDate: match.update.actualFinishDate ?? null,
      progressValue: match.update.progressValue ?? null,
      progressUnit: match.update.progressUnit ?? null,
      delayReason: match.update.delayReason ?? null,
      remarks: match.update.remarks ?? match.update.activityDescription ?? null,
    };

    if (action === "APPROVE") {
      if (!match.activityId) {
        return NextResponse.json({ error: "No suggested activity to approve on this record." }, { status: 400 });
      }
      await applyVerifiedActual({
        activityId: match.activityId,
        updateId: match.updateId,
        extraction: null,
        fallback,
        verifiedBy: reviewedBy
      });
      await prisma.aiActivityMatch.update({
        where: { id: params.matchId },
        data: {
          matchStatus: "VALID",
          reviewedBy,
          reviewedAt: new Date()
        }
      });

    } else if (action === "SELECT_DIFFERENT") {
      if (!selectedActivityId) {
        return NextResponse.json({ error: "selected_activity_id is required." }, { status: 400 });
      }
      const activity = await prisma.scheduleActivity.findUnique({ where: { activityId: selectedActivityId } });
      if (!activity || activity.projectId !== match.projectId) {
        return NextResponse.json({ error: "Selected activity does not belong to this project." }, { status: 400 });
      }
      await applyVerifiedActual({
        activityId: selectedActivityId,
        updateId: match.updateId,
        extraction: null,
        fallback,
        verifiedBy: reviewedBy
      });
      await prisma.aiActivityMatch.update({
        where: { id: params.matchId },
        data: {
          activityId: selectedActivityId,
          matchStatus: "VALID",
          reviewedBy,
          reviewedAt: new Date()
        }
      });

    } else if (action === "MARK_UNMATCHED") {
      await prisma.aiActivityMatch.update({
        where: { id: params.matchId },
        data: {
          matchStatus: "INVALID",
          decision: "NO_MATCH",
          reviewedBy,
          reviewedAt: new Date()
        }
      });

    } else if (action === "REJECT_INVALID") {
      await prisma.aiActivityMatch.update({
        where: { id: params.matchId },
        data: {
          matchStatus: "INVALID",
          decision: "REJECTED",
          reviewedBy,
          reviewedAt: new Date()
        }
      });

    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const updated = await prisma.aiActivityMatch.findUnique({ where: { id: params.matchId } });
    return NextResponse.json({ match: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to process manager action." }, { status: 500 });
  }
}
