import { NextRequest, NextResponse } from "next/server";
import { activateScheduleVersion } from "@/lib/services/scheduleImportService";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export async function POST(_req: NextRequest, { params }: { params: { projectId: string; versionId: string } }) {
  try {
    const session = await verifySession(_req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const version = await activateScheduleVersion(params.projectId, params.versionId, session.username);
    return NextResponse.json({ version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve schedule version.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}