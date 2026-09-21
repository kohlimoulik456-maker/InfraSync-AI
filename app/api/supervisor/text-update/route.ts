import { NextRequest, NextResponse } from "next/server";
import { processTextUpdate } from "@/lib/inputProcessors/textProcessor";
import { isDemoMode } from "@/lib/gemini/geminiService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, supervisor_id, update_date, discipline, area_unit, activity_update_text, delay_reason, remarks } = body;

    if (!project_id || !supervisor_id || !update_date || !activity_update_text) {
      return NextResponse.json(
        { error: "Project, Supervisor ID, Update Date and the progress update text are required." },
        { status: 400 }
      );
    }

    const { updateId, result } = await processTextUpdate({
      project_id,
      supervisor_id,
      update_date,
      discipline: discipline ?? null,
      area_unit: area_unit ?? null,
      activity_update_text,
      delay_reason: delay_reason ?? null,
      remarks: remarks ?? null
    });

    return NextResponse.json({ updateId, demoMode: isDemoMode(), ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to process text update." }, { status: 500 });
  }
}
