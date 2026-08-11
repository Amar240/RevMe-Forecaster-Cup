-- CreateEnum
CREATE TYPE "RoundAutomationMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "RoundTransitionTrigger" AS ENUM ('SCHEDULED', 'ADMIN', 'MODE_CHANGE', 'RECOVERY');

-- CreateEnum
CREATE TYPE "RoundTransitionOutcome" AS ENUM ('APPLIED', 'NO_CHANGE', 'SKIPPED', 'FAILED');

-- Existing seasons keep their current manual operating behavior. New seasons
-- default to AUTOMATIC once the scheduling infrastructure is configured.
ALTER TABLE "Season"
  ADD COLUMN "roundAutomationMode" "RoundAutomationMode" NOT NULL DEFAULT 'AUTOMATIC',
  ADD COLUMN "roundAutomationGeneration" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "roundAutomationLastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "roundAutomationScheduleError" TEXT;

UPDATE "Season" SET "roundAutomationMode" = 'MANUAL';

-- Repair any legacy duplicate OPEN state before adding the database guard.
WITH ranked_open_rounds AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "seasonId"
    ORDER BY "opensAt" DESC, "number" DESC
  ) AS row_number
  FROM "Round"
  WHERE "status" = 'OPEN'
)
UPDATE "Round" AS round
SET "status" = CASE
  WHEN round."closesAt" < CURRENT_TIMESTAMP THEN 'CLOSED'::"RoundStatus"
  ELSE 'UPCOMING'::"RoundStatus"
END
FROM ranked_open_rounds AS ranked
WHERE round."id" = ranked."id" AND ranked.row_number > 1;

CREATE UNIQUE INDEX "Round_one_open_per_season"
  ON "Round" ("seasonId")
  WHERE "status" = 'OPEN';

-- CreateTable
CREATE TABLE "RoundTransitionRun" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "trigger" "RoundTransitionTrigger" NOT NULL,
  "outcome" "RoundTransitionOutcome" NOT NULL,
  "generation" INTEGER NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT,
  "openedRoundId" TEXT,
  "closedRoundIds" JSONB,
  "details" JSONB,
  "errorMessage" TEXT,
  CONSTRAINT "RoundTransitionRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoundTransitionRun_idempotencyKey_key"
  ON "RoundTransitionRun"("idempotencyKey");
CREATE INDEX "RoundTransitionRun_seasonId_processedAt_idx"
  ON "RoundTransitionRun"("seasonId", "processedAt");
CREATE INDEX "RoundTransitionRun_outcome_processedAt_idx"
  ON "RoundTransitionRun"("outcome", "processedAt");

ALTER TABLE "RoundTransitionRun"
  ADD CONSTRAINT "RoundTransitionRun_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
