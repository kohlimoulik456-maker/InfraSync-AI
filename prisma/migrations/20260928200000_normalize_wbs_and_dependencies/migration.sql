CREATE TYPE "DependencyType" AS ENUM ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH');

CREATE TABLE "wbsNode" (
    "wbsNodeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scheduleVersionId" TEXT NOT NULL,
    "parentId" TEXT,
    "nodeKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "wbsNode_pkey" PRIMARY KEY ("wbsNodeId")
);

ALTER TABLE "scheduleActivity" ADD COLUMN "wbsNodeId" TEXT;
ALTER TABLE "scheduleVersionActivity" ADD COLUMN "wbsNodeId" TEXT;

CREATE TABLE "scheduleDependency" (
    "dependencyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "predecessorActivityId" TEXT NOT NULL,
    "successorActivityId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "scheduleDependency_pkey" PRIMARY KEY ("dependencyId")
);

CREATE TABLE "scheduleVersionDependency" (
    "scheduleVersionDependencyId" TEXT NOT NULL,
    "scheduleVersionId" TEXT NOT NULL,
    "predecessorActivityId" TEXT NOT NULL,
    "successorActivityId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "scheduleVersionDependency_pkey" PRIMARY KEY ("scheduleVersionDependencyId")
);

CREATE UNIQUE INDEX "wbsNode_scheduleVersionId_nodeKey_key" ON "wbsNode"("scheduleVersionId", "nodeKey");
CREATE INDEX "wbsNode_scheduleVersionId_parentId_sortOrder_idx" ON "wbsNode"("scheduleVersionId", "parentId", "sortOrder");
CREATE INDEX "wbsNode_projectId_idx" ON "wbsNode"("projectId");
CREATE INDEX "scheduleActivity_wbsNodeId_idx" ON "scheduleActivity"("wbsNodeId");
CREATE UNIQUE INDEX "scheduleDependency_projectId_predecessorActivityId_successo_key" ON "scheduleDependency"("projectId", "predecessorActivityId", "successorActivityId", "dependencyType");
CREATE INDEX "scheduleDependency_projectId_predecessorActivityId_idx" ON "scheduleDependency"("projectId", "predecessorActivityId");
CREATE INDEX "scheduleDependency_projectId_successorActivityId_idx" ON "scheduleDependency"("projectId", "successorActivityId");
CREATE UNIQUE INDEX "scheduleVersionDependency_scheduleVersionId_predecessorActi_key" ON "scheduleVersionDependency"("scheduleVersionId", "predecessorActivityId", "successorActivityId", "dependencyType");
CREATE INDEX "scheduleVersionDependency_scheduleVersionId_predecessorActivityId_idx" ON "scheduleVersionDependency"("scheduleVersionId", "predecessorActivityId");
CREATE INDEX "scheduleVersionDependency_scheduleVersionId_successorActivityId_idx" ON "scheduleVersionDependency"("scheduleVersionId", "successorActivityId");

ALTER TABLE "wbsNode" ADD CONSTRAINT "wbsNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wbsNode" ADD CONSTRAINT "wbsNode_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "scheduleVersion"("scheduleVersionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wbsNode" ADD CONSTRAINT "wbsNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "wbsNode"("wbsNodeId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scheduleActivity" ADD CONSTRAINT "scheduleActivity_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "wbsNode"("wbsNodeId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scheduleVersionActivity" ADD CONSTRAINT "scheduleVersionActivity_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "wbsNode"("wbsNodeId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scheduleDependency" ADD CONSTRAINT "scheduleDependency_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduleVersionDependency" ADD CONSTRAINT "scheduleVersionDependency_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "scheduleVersion"("scheduleVersionId") ON DELETE CASCADE ON UPDATE CASCADE;

WITH expanded AS (
    SELECT a."scheduleVersionId", a."activityId", levels.level, NULLIF(BTRIM(levels.name), '') AS name
    FROM "scheduleVersionActivity" a
    CROSS JOIN LATERAL (VALUES (1, a."wbsL1"), (2, a."wbsL2"), (3, a."wbsL3"), (4, a."wbsL4"), (5, a."wbsL5"), (6, a."wbsL6")) AS levels(level, name)
), valid AS (
    SELECT * FROM expanded WHERE name IS NOT NULL
), paths AS (
    SELECT child."scheduleVersionId", child."activityId", child.level, child.name,
        (SELECT jsonb_agg(parent.name ORDER BY parent.level)::text FROM valid parent WHERE parent."scheduleVersionId" = child."scheduleVersionId" AND parent."activityId" = child."activityId" AND parent.level <= child.level) AS node_key,
        (SELECT jsonb_agg(parent.name ORDER BY parent.level)::text FROM valid parent WHERE parent."scheduleVersionId" = child."scheduleVersionId" AND parent."activityId" = child."activityId" AND parent.level < child.level) AS parent_key
    FROM valid child
)
INSERT INTO "wbsNode" ("wbsNodeId", "projectId", "scheduleVersionId", "nodeKey", "name", "level")
SELECT gen_random_uuid()::text, version."projectId", paths."scheduleVersionId", paths.node_key, paths.name, paths.level
FROM (SELECT DISTINCT "scheduleVersionId", node_key, name, level FROM paths) paths
JOIN "scheduleVersion" version ON version."scheduleVersionId" = paths."scheduleVersionId";

WITH expanded AS (
    SELECT a."scheduleVersionId", a."activityId", levels.level, NULLIF(BTRIM(levels.name), '') AS name
    FROM "scheduleVersionActivity" a
    CROSS JOIN LATERAL (VALUES (1, a."wbsL1"), (2, a."wbsL2"), (3, a."wbsL3"), (4, a."wbsL4"), (5, a."wbsL5"), (6, a."wbsL6")) AS levels(level, name)
), valid AS (SELECT * FROM expanded WHERE name IS NOT NULL), paths AS (
    SELECT child."scheduleVersionId", child."activityId", child.level,
        (SELECT jsonb_agg(parent.name ORDER BY parent.level)::text FROM valid parent WHERE parent."scheduleVersionId" = child."scheduleVersionId" AND parent."activityId" = child."activityId" AND parent.level <= child.level) AS node_key,
        (SELECT jsonb_agg(parent.name ORDER BY parent.level)::text FROM valid parent WHERE parent."scheduleVersionId" = child."scheduleVersionId" AND parent."activityId" = child."activityId" AND parent.level < child.level) AS parent_key
    FROM valid child
)
UPDATE "wbsNode" child SET "parentId" = parent."wbsNodeId"
FROM paths
JOIN "wbsNode" parent ON parent."scheduleVersionId" = paths."scheduleVersionId" AND parent."nodeKey" = paths.parent_key
WHERE paths.level > 1 AND child."scheduleVersionId" = paths."scheduleVersionId" AND child."nodeKey" = paths.node_key;

WITH expanded AS (
    SELECT a."scheduleVersionId", a."activityId", levels.level, NULLIF(BTRIM(levels.name), '') AS name
    FROM "scheduleVersionActivity" a
    CROSS JOIN LATERAL (VALUES (1, a."wbsL1"), (2, a."wbsL2"), (3, a."wbsL3"), (4, a."wbsL4"), (5, a."wbsL5"), (6, a."wbsL6")) AS levels(level, name)
), deepest AS (
    SELECT DISTINCT ON ("scheduleVersionId", "activityId") "scheduleVersionId", "activityId",
        (SELECT jsonb_agg(parent.name ORDER BY parent.level)::text FROM expanded parent WHERE parent."scheduleVersionId" = child."scheduleVersionId" AND parent."activityId" = child."activityId" AND parent.level <= child.level AND parent.name IS NOT NULL) AS node_key
    FROM expanded child WHERE child.name IS NOT NULL ORDER BY "scheduleVersionId", "activityId", level DESC
)
UPDATE "scheduleVersionActivity" activity SET "wbsNodeId" = node."wbsNodeId"
FROM deepest JOIN "wbsNode" node ON node."scheduleVersionId" = deepest."scheduleVersionId" AND node."nodeKey" = deepest.node_key
WHERE activity."scheduleVersionId" = deepest."scheduleVersionId" AND activity."activityId" = deepest."activityId";

UPDATE "scheduleActivity" activity SET "wbsNodeId" = snapshot."wbsNodeId"
FROM "scheduleVersion" version
JOIN "scheduleVersionActivity" snapshot ON snapshot."scheduleVersionId" = version."scheduleVersionId"
WHERE version."projectId" = activity."projectId" AND version."status" = 'CURRENT' AND snapshot."activityId" = activity."activityId";

INSERT INTO "scheduleVersionDependency" ("scheduleVersionDependencyId", "scheduleVersionId", "predecessorActivityId", "successorActivityId", "dependencyType", "lagDays")
SELECT gen_random_uuid()::text, activity."scheduleVersionId", activity."predecessorId", activity."activityId", 'FINISH_TO_START', 0
FROM "scheduleVersionActivity" activity
WHERE activity."predecessorId" IS NOT NULL AND activity."predecessorId" <> activity."activityId";

INSERT INTO "scheduleDependency" ("dependencyId", "projectId", "predecessorActivityId", "successorActivityId", "dependencyType", "lagDays")
SELECT gen_random_uuid()::text, version."projectId", dependency."predecessorActivityId", dependency."successorActivityId", dependency."dependencyType", dependency."lagDays"
FROM "scheduleVersion" version
JOIN "scheduleVersionDependency" dependency ON dependency."scheduleVersionId" = version."scheduleVersionId"
JOIN "scheduleActivity" predecessor ON predecessor."projectId" = version."projectId" AND predecessor."activityId" = dependency."predecessorActivityId" AND predecessor."isCurrentSchedule" = true
JOIN "scheduleActivity" successor ON successor."projectId" = version."projectId" AND successor."activityId" = dependency."successorActivityId" AND successor."isCurrentSchedule" = true
WHERE version."status" = 'CURRENT';
