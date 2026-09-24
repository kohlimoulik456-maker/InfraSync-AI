import { NextRequest, NextResponse } from "next/server";
import { processExcelUpload } from "@/lib/inputProcessors/excelProcessor";
import { isDemoMode } from "@/lib/gemini/geminiService";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const projectId = String(formData.get("project_id") || "").trim();
    const supervisorId = String(formData.get("supervisor_id") || "").trim();
    const file = formData.get("file") as File | null;

    if (!projectId || !supervisorId) {
      return NextResponse.json({ error: "Project and Supervisor ID are required." }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "An update file (.xlsx or .csv) is required." }, { status: 400 });
    }
    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".xlsx") && !filename.endsWith(".csv")) {
      return NextResponse.json({ error: "Only .xlsx and .csv files are supported in the MVP." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const summary = await processExcelUpload(buffer, filename, projectId, supervisorId);

    return NextResponse.json({ demoMode: isDemoMode(), summary });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to process the uploaded file." }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
