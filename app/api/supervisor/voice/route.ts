import { NextRequest, NextResponse } from "next/server";
import { processVoiceUpdate } from "@/lib/inputProcessors/voiceProcessor";
import { isDemoMode, transcribeAudio } from "@/lib/gemini/geminiService";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: any;
    let transcript: string | null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audio = formData.get("audio");
      body = Object.fromEntries(formData.entries());

      if (!(audio instanceof File) || audio.size === 0) {
        return NextResponse.json({ error: "A voice recording is required." }, { status: 400 });
      }

      transcript = await transcribeAudio(Buffer.from(await audio.arrayBuffer()), audio.type || "audio/webm");

      if (formData.get("transcribe_only") === "true") {
        return NextResponse.json({ transcript });
      }
    } else {
      body = await req.json();
      transcript = body.activity_update_text ?? body.transcript ?? body.voice_text ?? null;
    }

    const { project_id, supervisor_id, update_date, discipline, area_unit, delay_reason, remarks } = body;

    if (!project_id || !supervisor_id || !update_date || !transcript) {
      return NextResponse.json(
        { error: "Project, Supervisor ID, Update Date and the recorded voice transcript are required." },
        { status: 400 }
      );
    }

    const { updateId, result } = await processVoiceUpdate({
      project_id,
      supervisor_id,
      update_date,
      discipline: discipline ?? null,
      area_unit: area_unit ?? null,
      activity_update_text: transcript,
      delay_reason: delay_reason ?? null,
      remarks: remarks ?? null
    });

    return NextResponse.json({ updateId, transcript, demoMode: isDemoMode(), ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to process voice update." }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
