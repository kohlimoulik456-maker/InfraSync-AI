import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stageScheduleRevision } from "@/lib/services/scheduleImportService";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const versions = await prisma.scheduleVersion.findMany({
    where: { projectId: params.projectId },
    orderBy: { versionNumber: "desc" },
    select: {
      scheduleVersionId: true,
      versionNumber: true,
      status: true,
      sourceFileName: true,
      createdBy: true,
      approvedBy: true,
      totalRows: true,
      importedRows: true,
      rejectedRows: true,
      createdAt: true,
      validatedAt: true,
      approvedAt: true,
      activatedAt: true
    }
  });
  return NextResponse.json({ versions });
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A schedule file (.xlsx or .csv) is required." }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".xlsx") && !filename.endsWith(".csv")) {
      return NextResponse.json({ error: "Only .xlsx or .csv schedule files are supported." }, { status: 400 });
    }

    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    const result = await stageScheduleRevision(Buffer.from(await file.arrayBuffer()), file.name, params.projectId, session?.username);
    if (result.headerErrors.length > 0) {
      return NextResponse.json({ error: "Schedule file is missing required headers.", headerErrors: result.headerErrors }, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to stage schedule revision." }, { status: 400 });
  }
}