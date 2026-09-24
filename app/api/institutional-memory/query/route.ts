import { NextRequest, NextResponse } from "next/server";
import { queryInstitutionalMemory } from "@/lib/services/institutionalMemoryService";
import { isDemoMode } from "@/lib/gemini/geminiService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, projectId, discipline, area, contractor } = body;
    if (!question) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }
    const result = await queryInstitutionalMemory(question, { projectId, discipline, area, contractor });
    return NextResponse.json({ demoMode: isDemoMode(), ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to query institutional memory." }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
