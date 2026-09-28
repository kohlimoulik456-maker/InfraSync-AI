ALTER TABLE "wbsNode" ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "wbsNode_scheduleVersionId_code_key"
ON "wbsNode"("scheduleVersionId", "code");
