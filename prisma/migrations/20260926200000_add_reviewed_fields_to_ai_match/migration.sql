-- Add audit trail fields to aiActivityMatch
-- Records who reviewed each AI match and when

ALTER TABLE "aiActivityMatch"
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
