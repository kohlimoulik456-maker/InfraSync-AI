import { NextResponse } from "next/server";
import { processDiaryScan } from "@/lib/inputProcessors/diaryScanProcessor";

// Intentionally a stub. Never touches the AI pipeline or Gemini.
export async function POST() {
  return NextResponse.json(processDiaryScan());
}
