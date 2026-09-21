import { NextRequest, NextResponse } from "next/server";
import { listDraftLessons, approveLessonLearned } from "@/lib/services/institutionalMemoryService";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") || undefined;
  const lessons = await listDraftLessons(projectId);
  return NextResponse.json({ lessons });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lessonId, lesson, recommendation } = body;
    if (!lessonId) return NextResponse.json({ error: "lessonId is required." }, { status: 400 });
    const updated = await approveLessonLearned(lessonId, lesson || "", recommendation || "");
    return NextResponse.json({ lesson: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to approve lesson." }, { status: 500 });
  }
}
