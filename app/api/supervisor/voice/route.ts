import { NextResponse } from "next/server";
import { processVoiceUpdate } from "@/lib/inputProcessors/voiceProcessor";

// Intentionally a stub. Never touches the AI pipeline or Gemini.
export async function POST() {
  return NextResponse.json(processVoiceUpdate());
}
