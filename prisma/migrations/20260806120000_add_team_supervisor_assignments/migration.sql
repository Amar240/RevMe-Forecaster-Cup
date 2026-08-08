-- CreateEnum
CREATE TYPE "TeamSupervisorAssignmentSource" AS ENUM ('INITIAL', 'REASSIGNMENT', 'RESTORED', 'LEGACY_BACKFILL');

-- CreateTable
CREATE TABLE "TeamSupervisorAssignment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "assignedById" TEXT,
    "endedById" TEXT,
    "reason" TEXT,
    "endReason" TEXT,
    "source" "TeamSupervisorAssignmentSource" NOT NULL DEFAULT 'INITIAL',
    "isApproximate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamSupervisorAssignment_pkey" PRIMARY KEY ("id")
);

-- Backfill the best-known assignment periods. Terminal and completed records
-- remain available for history but are not left as current responsibilities.
INSERT INTO "TeamSupervisorAssignment" (
    "id",
    "teamId",
    "supervisorId",
    "startedAt",
    "endedAt",
    "source",
    "isApproximate",
    "createdAt"
)
SELECT
    'legacy_' || md5(random()::text || clock_timestamp()::text || team."id"),
    team."id",
    team."supervisorId",
    team."createdAt",
    CASE
        WHEN season."status" = 'COMPLETED' THEN season."endDate"
        WHEN team."status" = 'DISQUALIFIED' THEN COALESCE(team."disqualifiedAt", team."updatedAt")
        WHEN team."status" IN ('ARCHIVED', 'REJECTED') THEN team."updatedAt"
        ELSE NULL
    END,
    'LEGACY_BACKFILL',
    true,
    CURRENT_TIMESTAMP
FROM "Team" AS team
LEFT JOIN "Season" AS season ON season."id" = team."seasonId"
WHERE team."supervisorId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "TeamSupervisorAssignment_teamId_startedAt_idx" ON "TeamSupervisorAssignment"("teamId", "startedAt");
CREATE INDEX "TeamSupervisorAssignment_supervisorId_startedAt_idx" ON "TeamSupervisorAssignment"("supervisorId", "startedAt");
CREATE INDEX "TeamSupervisorAssignment_endedAt_idx" ON "TeamSupervisorAssignment"("endedAt");
CREATE UNIQUE INDEX "TeamSupervisorAssignment_one_open_per_team_idx" ON "TeamSupervisorAssignment"("teamId") WHERE "endedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "TeamSupervisorAssignment" ADD CONSTRAINT "TeamSupervisorAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamSupervisorAssignment" ADD CONSTRAINT "TeamSupervisorAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamSupervisorAssignment" ADD CONSTRAINT "TeamSupervisorAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamSupervisorAssignment" ADD CONSTRAINT "TeamSupervisorAssignment_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
