import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyVerifiedActual } from "@/lib/services/activityActualsService";

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
    const overrideReason: string | undefined = body.override_reason;
    const selectedActivityId: string | undefined = body.selected_activity_id;

    const match = await prisma.aiActivityMatch.findUnique({
      where: { id: params.matchId },
      include: { update: true }
    });
    if (!match) return NextResponse.json({ error: "Audit record not found." }, { status: 404 });

    if (action === "APPROVE") {
      if (!match.activityId) {
        return NextResponse.json({ error: "No suggested activity to approve on this record." }, { status: 400 });
      }
      await applyVerifiedActual({
        activityId: match.activityId,
        updateId: match.updateId,
        extraction: null, // llmExtractionJson doesn't exist in schema
        fallback: {
          actualStartDate: null, // these fields don't exist on supervisorUpdate
          actualFinishDate: null,
          progressValue: null,
          progressUnit: null,
          delayReason: null,
          remarks: match.update.activityDescription
        },
        verifiedBy: reviewedBy
      });
      await prisma.aiActivityMatch.update({
        where: { id: params.matchId },
        data: { matchStatus: "VALID" } // reviewedAt/reviewedBy don't exist
      });
    } else if (action === "SELECT_DIFFERENT") {
      if (!selectedActivityId) {
        return NextResponse.json({ error: "selected_activity_id is required." }, { status: 400 });
      }
      // Only allow selecting activities from the same Project_ID.
      const activity = await prisma.scheduleActivity.findUnique({ where: { activityId: selectedActivityId } });
      if (!activity || activity.projectId !== match.projectId) {
        return NextResponse.json({ error: "Selected activity does not belong to this project." }, { status: 400 });
      }
      await applyVerifiedActual({
        activityId: selectedActivityId,
        updateId: match.updateId,
        extraction: null,
        fallback: {
          actualStartDate: null,
          actualFinishDate: null,
          progressValue: null,
          progressUnit: null,
          delayReason: null,
          remarks: match.update.activityDescription
        },
        verifiedBy: reviewedBy
      });
      await prisma.aiActivityMatch.update({
        where: { id: params.matchId },
        data: {
          activityId: selectedActivityId,
          matchStatus: "VALID"
        }
      });
    } else if (action === "MARK_UNMATCHED") {
      await prisma.aiActivityMatch.update({
        where: { id: params.matchId },
        data: { matchStatus: "INVALID", decision: "NO_MATCH" }
      });
    } else if (action === "REJECT_INVALID") {
      await prisma.aiActivityMatch.update({
        where: { id: params.matchId },
        data: {
          matchStatus: "INVALID",
          decision: "REJECTED"
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
