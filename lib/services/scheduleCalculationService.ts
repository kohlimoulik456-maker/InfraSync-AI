import { hasDependencyCycle, type ScheduleDependencyType } from "./scheduleLogic";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CpmActivityInput {
  activityId: string;
  activityName: string;
  plannedStart: Date | string;
  plannedFinish: Date | string;
  plannedDuration: number | null;
  activityStatus?: string;
  progressValue?: number | null;
  actualStart?: Date | string | null;
  actualFinish?: Date | string | null;
}

export interface CpmCalculationOptions {
  dataDate?: Date | string;
}

export interface CpmDependencyInput {
  predecessorActivityId: string;
  successorActivityId: string;
  dependencyType: ScheduleDependencyType;
  lagDays: number;
}

export interface CpmActivityResult {
  activityId: string;
  activityName: string;
  baselineStart: string;
  baselineFinish: string;
  durationWorkdays: number;
  remainingDurationWorkdays: number;
  progressValue: number | null;
  activityStatus: string;
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  totalFloatDays: number;
  isCritical: boolean;
}

export interface CpmResult {
  calendar: "MON_SAT";
  dataDate: string;
  targetFinish: string;
  forecastFinish: string;
  finishVarianceWorkdays: number;
  criticalActivityCount: number;
  activities: CpmActivityResult[];
}

function toDay(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Schedule contains an invalid date.");
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS);
}

function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function weekday(day: number): number {
  return ((day + 4) % 7 + 7) % 7;
}

function isWorkingDay(day: number): boolean {
  return weekday(day) !== 0;
}

function nextWorkingDay(day: number): number {
  while (!isWorkingDay(day)) day++;
  return day;
}

function previousWorkingDay(day: number): number {
  while (!isWorkingDay(day)) day--;
  return day;
}

function addWorkingDays(day: number, amount: number): number {
  let result = amount < 0 ? previousWorkingDay(day) : nextWorkingDay(day);
  let remaining = Math.abs(amount);
  const direction = amount < 0 ? -1 : 1;
  while (remaining > 0) {
    result += direction;
    if (isWorkingDay(result)) remaining--;
  }
  return result;
}

function durationFor(activity: CpmActivityInput, start: number, finish: number): number {
  if (activity.plannedDuration !== null) {
    if (!Number.isInteger(activity.plannedDuration) || activity.plannedDuration < 0) {
      throw new Error(`Activity "${activity.activityId}" has an invalid duration.`);
    }
    return activity.plannedDuration;
  }

  if (finish < start) throw new Error(`Activity "${activity.activityId}" finishes before it starts.`);
  let duration = 0;
  for (let day = start; day <= finish; day++) if (isWorkingDay(day)) duration++;
  return duration;
}

function finishFromStart(start: number, duration: number): number {
  return duration === 0 ? start : addWorkingDays(start, duration - 1);
}

function startFromFinish(finish: number, duration: number): number {
  return duration === 0 ? finish : addWorkingDays(finish, -(duration - 1));
}

function workingDayDistance(start: number, finish: number): number {
  if (start === finish) return 0;
  const direction = finish > start ? 1 : -1;
  let cursor = start;
  let count = 0;
  while (cursor !== finish) {
    cursor += direction;
    if (isWorkingDay(cursor)) count += direction;
  }
  return count;
}

export function calculateCpm(
  activities: CpmActivityInput[],
  dependencies: CpmDependencyInput[],
  options: CpmCalculationOptions = {}
): CpmResult {
  if (activities.length === 0) throw new Error("A schedule version must contain activities.");

  const byId = new Map(activities.map((activity) => [activity.activityId, activity]));
  if (byId.size !== activities.length) throw new Error("Schedule contains duplicate activity IDs.");

  for (const dependency of dependencies) {
    if (
      dependency.predecessorActivityId === dependency.successorActivityId ||
      !byId.has(dependency.predecessorActivityId) ||
      !byId.has(dependency.successorActivityId)
    ) {
      throw new Error("Every dependency must connect two different activities in this schedule version.");
    }
  }
  if (hasDependencyCycle([...byId.keys()], dependencies)) {
    throw new Error("The schedule dependency graph contains a cycle.");
  }

  const incoming = new Map(activities.map((activity) => [activity.activityId, [] as CpmDependencyInput[]]));
  const outgoing = new Map(activities.map((activity) => [activity.activityId, [] as CpmDependencyInput[]]));
  const indegree = new Map(activities.map((activity) => [activity.activityId, 0]));
  for (const dependency of dependencies) {
    incoming.get(dependency.successorActivityId)!.push(dependency);
    outgoing.get(dependency.predecessorActivityId)!.push(dependency);
    indegree.set(dependency.successorActivityId, indegree.get(dependency.successorActivityId)! + 1);
  }

  const ready = activities.map((activity) => activity.activityId).filter((activityId) => indegree.get(activityId) === 0);
  const topologicalOrder: string[] = [];
  for (let index = 0; index < ready.length; index++) {
    const activityId = ready[index];
    topologicalOrder.push(activityId);
    for (const dependency of outgoing.get(activityId)!) {
      const next = dependency.successorActivityId;
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) ready.push(next);
    }
  }

  const duration = new Map<string, number>();
  const baselineDuration = new Map<string, number>();
  const baselineStart = new Map<string, number>();
  const baselineFinish = new Map<string, number>();
  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();
  const completedDates = new Map<string, { start: number; finish: number }>();
  const targetFinish = Math.max(...activities.map((activity) => toDay(activity.plannedFinish)));
  const dataDate = toDay(options.dataDate ?? new Date());

  for (const activityId of topologicalOrder) {
    const activity = byId.get(activityId)!;
    const start = toDay(activity.plannedStart);
    const finish = toDay(activity.plannedFinish);
    const plannedDuration = durationFor(activity, start, finish);
    baselineDuration.set(activityId, plannedDuration);
    baselineStart.set(activityId, start);
    baselineFinish.set(activityId, finish);

    const progress = activity.progressValue == null || !Number.isFinite(activity.progressValue)
      ? null
      : Math.min(100, Math.max(0, activity.progressValue));
    const actualStart = activity.actualStart == null ? undefined : toDay(activity.actualStart);
    const actualFinish = activity.actualFinish == null ? undefined : toDay(activity.actualFinish);
    const isComplete = activity.activityStatus === "COMPLETED" || actualFinish !== undefined || progress === 100;

    if (isComplete) {
      // A missing actual finish means only "done by now", so pin to the data
      // date; the planned finish may still be in the future and would inflate
      // forecastFinish, which takes the max over every early finish.
      const fixedFinish = actualFinish ?? dataDate;
      const fixedStart = actualStart ?? Math.min(start, fixedFinish);
      if (fixedFinish < fixedStart) throw new Error(`Activity "${activityId}" finishes before it starts.`);
      duration.set(activityId, 0);
      completedDates.set(activityId, { start: fixedStart, finish: fixedFinish });
      earlyStart.set(activityId, fixedStart);
      earlyFinish.set(activityId, fixedFinish);
      continue;
    }

    const hasStarted = activity.activityStatus === "IN_PROGRESS" || actualStart !== undefined || (progress ?? 0) > 0;
    const remainingDuration = hasStarted && progress !== null
      ? Math.ceil(plannedDuration * (1 - progress / 100))
      : plannedDuration;
    duration.set(activityId, remainingDuration);

    let earliest = nextWorkingDay(Math.max(start, dataDate, actualStart ?? start));
    for (const dependency of incoming.get(activityId)!) {
      const predecessorStart = earlyStart.get(dependency.predecessorActivityId)!;
      const predecessorFinish = earlyFinish.get(dependency.predecessorActivityId)!;
      let requiredStart: number;
      switch (dependency.dependencyType) {
        case "FINISH_TO_START":
          requiredStart = addWorkingDays(nextWorkingDay(predecessorFinish + 1), dependency.lagDays);
          break;
        case "START_TO_START":
          requiredStart = addWorkingDays(nextWorkingDay(predecessorStart), dependency.lagDays);
          break;
        case "FINISH_TO_FINISH":
          requiredStart = startFromFinish(addWorkingDays(nextWorkingDay(predecessorFinish), dependency.lagDays), remainingDuration);
          break;
        case "START_TO_FINISH":
          requiredStart = startFromFinish(addWorkingDays(nextWorkingDay(predecessorStart), dependency.lagDays), remainingDuration);
          break;
      }
      earliest = Math.max(earliest, requiredStart);
    }
    earlyStart.set(activityId, earliest);
    earlyFinish.set(activityId, finishFromStart(earliest, remainingDuration));
  }

  const lateStart = new Map<string, number>();
  const lateFinish = new Map<string, number>();
  const workingTarget = previousWorkingDay(targetFinish);
  for (const activityId of [...topologicalOrder].reverse()) {
    const activityDuration = duration.get(activityId)!;
    const fixed = completedDates.get(activityId);
    const finish = fixed?.finish ?? lateFinish.get(activityId) ?? workingTarget;
    const start = fixed?.start ?? startFromFinish(finish, activityDuration);
    lateFinish.set(activityId, finish);
    lateStart.set(activityId, start);

    for (const dependency of incoming.get(activityId)!) {
      const predecessorId = dependency.predecessorActivityId;
      if (completedDates.has(predecessorId)) continue;
      const predecessorDuration = duration.get(predecessorId)!;
      let predecessorFinishBound: number;
      switch (dependency.dependencyType) {
        case "FINISH_TO_START":
          predecessorFinishBound = addWorkingDays(start, -(dependency.lagDays + 1));
          break;
        case "START_TO_START": {
          const predecessorStartBound = addWorkingDays(start, -dependency.lagDays);
          predecessorFinishBound = finishFromStart(predecessorStartBound, predecessorDuration);
          break;
        }
        case "FINISH_TO_FINISH":
          predecessorFinishBound = addWorkingDays(finish, -dependency.lagDays);
          break;
        case "START_TO_FINISH": {
          const predecessorStartBound = addWorkingDays(finish, -dependency.lagDays);
          predecessorFinishBound = finishFromStart(predecessorStartBound, predecessorDuration);
          break;
        }
      }
      const currentBound = lateFinish.get(predecessorId);
      lateFinish.set(predecessorId, currentBound === undefined ? predecessorFinishBound : Math.min(currentBound, predecessorFinishBound));
    }
  }

  const resultActivities = activities.map((activity) => {
    const activityId = activity.activityId;
    const early = earlyStart.get(activityId)!;
    const late = lateStart.get(activityId)!;
    const totalFloatDays = workingDayDistance(early, late);
    return {
      activityId,
      activityName: activity.activityName,
      baselineStart: fromDay(baselineStart.get(activityId)!),
      baselineFinish: fromDay(baselineFinish.get(activityId)!),
      durationWorkdays: baselineDuration.get(activityId)!,
      remainingDurationWorkdays: duration.get(activityId)!,
      progressValue: activity.progressValue == null ? null : Math.min(100, Math.max(0, activity.progressValue)),
      activityStatus: activity.activityStatus ?? "NOT_STARTED",
      earlyStart: fromDay(early),
      earlyFinish: fromDay(earlyFinish.get(activityId)!),
      lateStart: fromDay(late),
      lateFinish: fromDay(lateFinish.get(activityId)!),
      totalFloatDays,
      isCritical: !completedDates.has(activityId) && totalFloatDays <= 0
    };
  });
  const forecastFinish = Math.max(...earlyFinish.values());

  return {
    calendar: "MON_SAT",
    dataDate: fromDay(dataDate),
    targetFinish: fromDay(workingTarget),
    forecastFinish: fromDay(forecastFinish),
    finishVarianceWorkdays: workingDayDistance(workingTarget, forecastFinish),
    criticalActivityCount: resultActivities.filter((activity) => activity.isCritical).length,
    activities: resultActivities.sort((left, right) => left.earlyStart.localeCompare(right.earlyStart))
  };
}