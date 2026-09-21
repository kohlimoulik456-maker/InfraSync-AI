import { prisma } from "../prisma";
import { LlmExtraction, WorkStatus } from "../types";

function workStatusToActivityStatus(status: WorkStatus | null): "IN_PROGRESS" | "COMPLETED" | "DELAYED" | null {
  if (status === "STARTED" || status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "DELAYED") return "DELAYED";
  return null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Applies a verified update to activity_actuals + schedule_activities.
 * Only called for AUTO_ACCEPT / ACCEPT_MONITOR decisions, or on manager
 * approval/override. verifiedBy distinguishes AI_AUTO_ACCEPT from a
 * named Program Manager reviewer.
 */
export async function applyVerifiedActual(params: {
  activityId: string;
  updateId: string;
  extraction: LlmExtraction | null;
  fallback: {
    actualStartDate: Date | null;
    actualFinishDate: Date | null;
    progressValue: number | null;
    progressUnit: string | null;
    delayReason: string | null;
    remarks: string | null;
  };
  verifiedBy: string;
}) {
  const activity = await prisma.scheduleActivity.findUniqueOrThrow({
    where: { activityId: params.activityId }
  });

  const actualStart = params.extraction?.actual_start.value
    ? new Date(params.extraction.actual_start.value)
    : params.fallback.actualStartDate;
  const actualFinish = params.extraction?.actual_finish.value
    ? new Date(params.extraction.actual_finish.value)
    : params.fallback.actualFinishDate;
  const progressValue = params.extraction?.progress_value.value ?? params.fallback.progressValue;
  const progressUnit = params.extraction?.progress_unit.value ?? params.fallback.progressUnit;
  const delayReason = params.extraction?.delay_reason.value ?? params.fallback.delayReason;
  const crewSize = params.extraction?.crew_size.value ?? null;
  const remarks = params.extraction?.remarks.value ?? params.fallback.remarks;

  const actualDuration =
    actualStart && actualFinish ? daysBetween(actualFinish, actualStart) : null;
  const delayDays =
    actualFinish && activity.plannedFinish
      ? Math.max(0, daysBetween(actualFinish, activity.plannedFinish))
      : null;

  const actual = await prisma.activityActual.create({
    data: {
      activityId: params.activityId,
      updateId: params.updateId,
      actualStart: actualStart ?? undefined,
      actualFinish: actualFinish ?? undefined,
      actualDuration: actualDuration ?? undefined,
      progressValue: progressValue ?? undefined,
      progressUnit: progressUnit ?? undefined,
      delayDays: delayDays ?? undefined,
      delayReason: delayReason ?? undefined,
      crewSize: crewSize ?? undefined,
      supervisorObservation: remarks ?? undefined,
      verifiedBy: params.verifiedBy
    }
  });

  const mappedStatus = workStatusToActivityStatus(
    (params.extraction?.work_status.value as WorkStatus | undefined) ?? null
  );

  if (mappedStatus) {
    await prisma.scheduleActivity.update({
      where: { activityId: params.activityId },
      data: {
        activityStatus: mappedStatus,
        ...(actualStart ? {} : {})
      }
    });
  }

  // Draft a lesson learned when there is a delay reason or the actual
  // duration exceeds the planned duration. Manager must approve before use.
  const plannedDuration = activity.plannedDuration;
  const shouldDraftLesson =
    !!delayReason || (actualDuration != null && plannedDuration != null && actualDuration > plannedDuration);

  if (shouldDraftLesson) {
    await prisma.lessonLearned.create({
      data: {
        projectId: activity.projectId,
        activityId: activity.activityId,
          title: activity.activityName,
        discipline: activity.discipline,
        area: activity.area,
        contractor: activity.contractor,
        observation: remarks ?? undefined,
        delayReason: delayReason ?? undefined,
        actualDuration: actualDuration ?? undefined,
        crewSize: crewSize ?? undefined,
        lesson: null,
        recommendation: null,
        approved: false
      }
    });
  }

  return actual;
}
