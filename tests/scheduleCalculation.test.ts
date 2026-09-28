import assert from "node:assert/strict";
import test from "node:test";
import { calculateCpm, type CpmActivityInput, type CpmDependencyInput } from "../lib/services/scheduleCalculationService";

function activity(activityId: string, plannedStart: string, plannedFinish: string, plannedDuration: number): CpmActivityInput {
  return { activityId, activityName: activityId, plannedStart, plannedFinish, plannedDuration };
}

function dependency(
  dependencyType: CpmDependencyInput["dependencyType"],
  lagDays = 0
): CpmDependencyInput {
  return { predecessorActivityId: "A", successorActivityId: "B", dependencyType, lagDays };
}

test("finish-to-start schedules after the predecessor and skips Sunday", () => {
  const result = calculateCpm([
    activity("A", "2026-10-03", "2026-10-05", 2),
    activity("B", "2026-10-03", "2026-10-06", 1)
  ], [dependency("FINISH_TO_START")], { dataDate: "2026-09-28" });

  assert.equal(result.activities.find((row) => row.activityId === "A")?.earlyFinish, "2026-10-05");
  assert.equal(result.activities.find((row) => row.activityId === "B")?.earlyStart, "2026-10-06");
  assert.equal(result.calendar, "MON_SAT");
});

test("supports start and finish relationship types with workday lags", () => {
  const activities = [
    activity("A", "2026-09-28", "2026-09-29", 2),
    activity("B", "2026-09-28", "2026-10-02", 1)
  ];
  const earlyStartFor = (link: CpmDependencyInput) => calculateCpm(activities, [link], { dataDate: "2026-09-28" }).activities
    .find((row) => row.activityId === "B")?.earlyStart;

  assert.equal(earlyStartFor(dependency("FINISH_TO_START")), "2026-09-30");
  assert.equal(earlyStartFor(dependency("START_TO_START")), "2026-09-28");
  assert.equal(earlyStartFor(dependency("FINISH_TO_FINISH")), "2026-09-29");
  assert.equal(earlyStartFor(dependency("START_TO_FINISH")), "2026-09-28");
  assert.equal(earlyStartFor(dependency("FINISH_TO_START", 2)), "2026-10-02");
});

test("calculates zero-float critical activities against the baseline finish target", () => {
  const result = calculateCpm([
    activity("A", "2026-09-28", "2026-09-29", 2),
    activity("B", "2026-09-29", "2026-09-30", 1)
  ], [dependency("FINISH_TO_START")], { dataDate: "2026-09-28" });

  assert.equal(result.forecastFinish, "2026-09-30");
  assert.equal(result.targetFinish, "2026-09-30");
  assert.equal(result.finishVarianceWorkdays, 0);
  assert.equal(result.criticalActivityCount, 2);
  assert.ok(result.activities.every((row) => row.totalFloatDays === 0));
});

test("reports negative float when the network misses its baseline finish target", () => {
  const result = calculateCpm([
    activity("A", "2026-09-28", "2026-09-29", 3),
    activity("B", "2026-09-28", "2026-09-30", 1)
  ], [dependency("FINISH_TO_START")], { dataDate: "2026-09-28" });

  assert.equal(result.forecastFinish, "2026-10-01");
  assert.equal(result.targetFinish, "2026-09-30");
  assert.equal(result.finishVarianceWorkdays, 1);
  assert.ok(result.activities.some((row) => row.totalFloatDays < 0));
});

test("rejects cycles and dependencies that refer outside the schedule version", () => {
  const activities = [activity("A", "2026-09-28", "2026-09-28", 1), activity("B", "2026-09-29", "2026-09-29", 1)];
  assert.throws(() => calculateCpm(activities, [
    dependency("FINISH_TO_START"),
    { predecessorActivityId: "B", successorActivityId: "A", dependencyType: "FINISH_TO_START", lagDays: 0 }
  ], { dataDate: "2026-09-28" }), /cycle/);
  assert.throws(() => calculateCpm(activities, [
    { predecessorActivityId: "MISSING", successorActivityId: "B", dependencyType: "FINISH_TO_START", lagDays: 0 }
  ], { dataDate: "2026-09-28" }), /connect two different activities/);
});

test("completed activities remain fixed to verified actual dates", () => {
  const result = calculateCpm([
    {
      ...activity("A", "2026-09-28", "2026-09-29", 2),
      activityStatus: "COMPLETED",
      progressValue: 100,
      actualStart: "2026-09-28",
      actualFinish: "2026-10-02"
    },
    activity("B", "2026-09-28", "2026-10-05", 1)
  ], [dependency("FINISH_TO_START")], { dataDate: "2026-10-05" });

  const completed = result.activities.find((row) => row.activityId === "A");
  const successor = result.activities.find((row) => row.activityId === "B");
  assert.equal(completed?.earlyStart, "2026-09-28");
  assert.equal(completed?.earlyFinish, "2026-10-02");
  assert.equal(completed?.remainingDurationWorkdays, 0);
  assert.equal(completed?.isCritical, false);
  assert.equal(successor?.earlyStart, "2026-10-05");
});

test("in-progress remaining duration uses verified progress and the data date", () => {
  const result = calculateCpm([{
    ...activity("A", "2026-09-28", "2026-10-08", 6),
    activityStatus: "IN_PROGRESS",
    progressValue: 50,
    actualStart: "2026-09-28"
  }], [], { dataDate: "2026-10-01" });
  const forecast = result.activities[0];

  assert.equal(result.dataDate, "2026-10-01");
  assert.equal(forecast.durationWorkdays, 6);
  assert.equal(forecast.remainingDurationWorkdays, 3);
  assert.equal(forecast.earlyStart, "2026-10-01");
  assert.equal(forecast.earlyFinish, "2026-10-03");
});

test("not-started overdue activities are forecast no earlier than the data date", () => {
  const result = calculateCpm([
    activity("A", "2026-09-01", "2026-09-02", 2)
  ], [], { dataDate: "2026-10-01" });

  assert.equal(result.activities[0].earlyStart, "2026-10-01");
  assert.equal(result.activities[0].earlyFinish, "2026-10-02");
});