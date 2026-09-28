CREATE UNIQUE INDEX "scheduleActivity_projectId_activityId_key"
ON "scheduleActivity"("projectId", "activityId");

ALTER INDEX "scheduleVersionDependency_scheduleVersionId_predecessorActivity"
RENAME TO "scheduleVersionDependency_scheduleVersionId_predecessorActi_idx";
ALTER INDEX "scheduleVersionDependency_scheduleVersionId_successorActivityId"
RENAME TO "scheduleVersionDependency_scheduleVersionId_successorActivi_idx";

ALTER TABLE "scheduleDependency"
ADD CONSTRAINT "scheduleDependency_projectId_predecessorActivityId_fkey"
FOREIGN KEY ("projectId", "predecessorActivityId")
REFERENCES "scheduleActivity"("projectId", "activityId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduleDependency"
ADD CONSTRAINT "scheduleDependency_projectId_successorActivityId_fkey"
FOREIGN KEY ("projectId", "successorActivityId")
REFERENCES "scheduleActivity"("projectId", "activityId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduleVersionDependency"
ADD CONSTRAINT "scheduleVersionDependency_scheduleVersionId_predecessorAct_fkey"
FOREIGN KEY ("scheduleVersionId", "predecessorActivityId")
REFERENCES "scheduleVersionActivity"("scheduleVersionId", "activityId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduleVersionDependency"
ADD CONSTRAINT "scheduleVersionDependency_scheduleVersionId_successorActiv_fkey"
FOREIGN KEY ("scheduleVersionId", "successorActivityId")
REFERENCES "scheduleVersionActivity"("scheduleVersionId", "activityId")
ON DELETE CASCADE ON UPDATE CASCADE;
