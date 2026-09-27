CREATE INDEX "scheduleActivity_projectId_activityStatus_idx"
  ON "scheduleActivity"("projectId", "activityStatus");

CREATE INDEX "activityActual_activityId_verifiedAt_idx"
  ON "activityActual"("activityId", "verifiedAt");

CREATE INDEX "supervisorUpdate_projectId_createdAt_idx"
  ON "supervisorUpdate"("projectId", "createdAt");
CREATE INDEX "supervisorUpdate_projectId_discipline_idx"
  ON "supervisorUpdate"("projectId", "discipline");

CREATE INDEX "aiActivityMatch_projectId_decision_idx"
  ON "aiActivityMatch"("projectId", "decision");
CREATE INDEX "aiActivityMatch_activityId_decision_idx"
  ON "aiActivityMatch"("activityId", "decision");
CREATE INDEX "aiActivityMatch_activityId_createdAt_idx"
  ON "aiActivityMatch"("activityId", "createdAt");

CREATE INDEX "lessonLearned_projectId_approved_idx"
  ON "lessonLearned"("projectId", "approved");