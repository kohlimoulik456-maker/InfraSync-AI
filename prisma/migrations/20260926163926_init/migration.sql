-- CreateTable
CREATE TABLE "project" (
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "fundTransaction" (
    "transactionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "manager" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundTransaction_pkey" PRIMARY KEY ("transactionId")
);

-- CreateTable
CREATE TABLE "scheduleActivity" (
    "activityId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
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
    "normalizedSearchText" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "scheduleActivity_pkey" PRIMARY KEY ("activityId")
);

-- CreateTable
CREATE TABLE "activityActual" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "updateId" TEXT,
    "actualStart" TIMESTAMP(3),
    "actualFinish" TIMESTAMP(3),
    "actualDuration" INTEGER,
    "progressValue" DOUBLE PRECISION,
    "progressUnit" TEXT,
    "delayDays" INTEGER,
    "delayReason" TEXT,
    "crewSize" INTEGER,
    "supervisorObservation" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activityActual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisorUpdate" (
    "updateId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activityId" TEXT,
    "supervisorId" TEXT NOT NULL,
    "updateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT NOT NULL DEFAULT 'TEXT',
    "discipline" TEXT,
    "areaUnit" TEXT,
    "activityDescription" TEXT NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "actualFinishDate" TIMESTAMP(3),
    "progressValue" DOUBLE PRECISION,
    "progressUnit" TEXT,
    "delayReason" TEXT,
    "remarks" TEXT,
    "rawInput" TEXT,
    "rawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervisorUpdate_pkey" PRIMARY KEY ("updateId")
);

-- CreateTable
CREATE TABLE "aiActivityMatch" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "activityId" TEXT,
    "projectId" TEXT,
    "overallConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "semanticSimilarity" DOUBLE PRECISION,
    "scheduleConsistency" DOUBLE PRECISION,
    "contextMatch" DOUBLE PRECISION,
    "ruleValidation" DOUBLE PRECISION,
    "decision" TEXT NOT NULL,
    "matchStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aiActivityMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessonLearned" (
    "lessonId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activityId" TEXT,
    "discipline" TEXT,
    "area" TEXT,
    "contractor" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "delayReason" TEXT,
    "actualDuration" INTEGER,
    "crewSize" INTEGER,
    "observation" TEXT,
    "lesson" TEXT,
    "recommendation" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lessonLearned_pkey" PRIMARY KEY ("lessonId")
);

-- CreateIndex
CREATE INDEX "fundTransaction_projectId_transactionDate_idx" ON "fundTransaction"("projectId", "transactionDate");

-- AddForeignKey
ALTER TABLE "fundTransaction" ADD CONSTRAINT "fundTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduleActivity" ADD CONSTRAINT "scheduleActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activityActual" ADD CONSTRAINT "activityActual_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "scheduleActivity"("activityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activityActual" ADD CONSTRAINT "activityActual_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "supervisorUpdate"("updateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisorUpdate" ADD CONSTRAINT "supervisorUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisorUpdate" ADD CONSTRAINT "supervisorUpdate_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "scheduleActivity"("activityId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aiActivityMatch" ADD CONSTRAINT "aiActivityMatch_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "supervisorUpdate"("updateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aiActivityMatch" ADD CONSTRAINT "aiActivityMatch_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "scheduleActivity"("activityId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessonLearned" ADD CONSTRAINT "lessonLearned_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessonLearned" ADD CONSTRAINT "lessonLearned_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "scheduleActivity"("activityId") ON DELETE SET NULL ON UPDATE CASCADE;
