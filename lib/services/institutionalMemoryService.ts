import { prisma } from "../prisma";
import { generateInstitutionalMemorySummary } from "../gemini/geminiService";

export interface InstitutionalMemoryFilters {
  projectId?: string;
  discipline?: string;
  area?: string;
  contractor?: string;
}

/**
 * Institutional memory is built ONLY from verified activity_actuals and
 * manager-approved lessons_learned. It never touches unapproved data and
 * is never used to auto-modify a newly uploaded schedule.
 */
export async function queryInstitutionalMemory(question: string, filters: InstitutionalMemoryFilters) {
  const lessonWhere = {
    approved: true,
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.discipline ? { discipline: filters.discipline } : {}),
    ...(filters.area ? { area: filters.area } : {}),
    ...(filters.contractor ? { contractor: filters.contractor } : {})
  };

  const lessons = await prisma.lessonLearned.findMany({
    where: lessonWhere,
    include: { activity: true },
    take: 200
  });

  const sampleSize = lessons.length;
  const durations = lessons.map((l) => l.actualDuration).filter((d): d is number => d != null);
  const plannedDurations = lessons
    .map((l) => l.activity?.plannedDuration)
    .filter((d): d is number => d != null);
  const crewSizes = lessons.map((l) => l.crewSize).filter((c): c is number => c != null);

  const delayDaysList = lessons
    .map((l) => {
      if (l.actualDuration != null && l.activity?.plannedDuration != null) {
        return Math.max(0, l.actualDuration - l.activity.plannedDuration);
      }
      return null;
    })
    .filter((d): d is number => d != null);

  const reasonCounts: Record<string, number> = {};
  for (const l of lessons) {
    if (!l.delayReason) continue;
    reasonCounts[l.delayReason] = (reasonCounts[l.delayReason] ?? 0) + 1;
  }
  const commonDelayReasons = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const avg = (arr: number[]) => (arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null);

  const metrics = {
    sampleSize,
    avgPlannedDuration: avg(plannedDurations),
    avgActualDuration: avg(durations),
    avgDelayDays: avg(delayDaysList),
    commonDelayReasons,
    avgCrewSize: avg(crewSizes)
  };

  const evidenceRecords = lessons.slice(0, 20).map((l) => ({
    project_id: l.projectId,
    activity_id: l.activityId,
    discipline: l.discipline,
    area: l.area,
    contractor: l.contractor,
    delay_reason: l.delayReason,
    actual_duration: l.actualDuration,
    crew_size: l.crewSize,
    observation: l.observation
  }));

  const summary = await generateInstitutionalMemorySummary(question, metrics, evidenceRecords);

  return { sampleSize, metrics, evidenceRecords, summary };
}

export async function listDraftLessons(projectId?: string) {
  return prisma.lessonLearned.findMany({
    where: { approved: false, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: "desc" }
  });
}

export async function approveLessonLearned(lessonId: string, lesson: string, recommendation: string) {
  return prisma.lessonLearned.update({
    where: { lessonId },
    data: { approved: true, lesson, recommendation }
  });
}
