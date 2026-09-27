CREATE TYPE "ScheduleVersionStatus" AS ENUM ('DRAFT', 'VALIDATED', 'APPROVED', 'CURRENT', 'SUPERSEDED', 'REJECTED');

ALTER TABLE "scheduleActivity"
ADD COLUMN "isCurrentSchedule" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "scheduleVersion" (
    "scheduleVersionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ScheduleVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceFileName" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    CONSTRAINT "scheduleVersion_pkey" PRIMARY KEY ("scheduleVersionId")
);

CREATE TABLE "scheduleVersionActivity" (
    "scheduleVersionId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityName" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "contractor" TEXT,
    "wbsL1" TEXT,
    "wbsL2" TEXT,
    "wbsL3" TEXT,
    "wbsL4" TEXT,
    "wbsL5" TEXT,
    "wbsL6" TEXT,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedFinish" TIMESTAMP(3) NOT NULL,
    "plannedDuration" INTEGER,
    "activityStatus" TEXT NOT NULL,
    "predecessorId" TEXT,
    "fieldKeywords" TEXT,
    "normalizedSearchText" TEXT NOT NULL,
    CONSTRAINT "scheduleVersionActivity_pkey" PRIMARY KEY ("scheduleVersionId", "activityId")
);

CREATE UNIQUE INDEX "scheduleVersion_projectId_versionNumber_key"
ON "scheduleVersion"("projectId", "versionNumber");
CREATE INDEX "scheduleVersion_projectId_status_idx"
ON "scheduleVersion"("projectId", "status");
CREATE INDEX "scheduleVersionActivity_activityId_idx"
ON "scheduleVersionActivity"("activityId");
CREATE INDEX "scheduleActivity_projectId_isCurrentSchedule_idx"
ON "scheduleActivity"("projectId", "isCurrentSchedule");

ALTER TABLE "scheduleVersion"
ADD CONSTRAINT "scheduleVersion_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduleVersionActivity"
ADD CONSTRAINT "scheduleVersionActivity_scheduleVersionId_fkey"
FOREIGN KEY ("scheduleVersionId") REFERENCES "scheduleVersion"("scheduleVersionId") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "scheduleVersion" (
    "scheduleVersionId", "projectId", "versionNumber", "status", "sourceFileName", "totalRows", "importedRows", "rejectedRows", "validatedAt", "approvedAt", "activatedAt"
)
SELECT gen_random_uuid()::text, p."projectId", 1, 'CURRENT', 'Existing schedule data', COUNT(a."activityId")::INTEGER, COUNT(a."activityId")::INTEGER, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "project" p
LEFT JOIN "scheduleActivity" a ON a."projectId" = p."projectId"
GROUP BY p."projectId";

INSERT INTO "scheduleVersionActivity" (
    "scheduleVersionId", "activityId", "activityName", "discipline", "area", "contractor",
    "wbsL1", "wbsL2", "wbsL3", "wbsL4", "wbsL5", "wbsL6", "plannedStart", "plannedFinish",
    "plannedDuration", "activityStatus", "predecessorId", "fieldKeywords", "normalizedSearchText"
)
SELECT v."scheduleVersionId", a."activityId", a."activityName", a."discipline", a."area", a."contractor",
       a."wbsL1", a."wbsL2", a."wbsL3", a."wbsL4", a."wbsL5", a."wbsL6", a."plannedStart", a."plannedFinish",
       a."plannedDuration", a."activityStatus", a."predecessorId", a."fieldKeywords", a."normalizedSearchText"
FROM "scheduleActivity" a
JOIN "scheduleVersion" v ON v."projectId" = a."projectId" AND v."versionNumber" = 1;