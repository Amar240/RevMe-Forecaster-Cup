-- CreateEnum
CREATE TYPE "RoundAutomationOverrideStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateTable
CREATE TABLE "RoundAutomationOverride" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "status" "RoundAutomationOverrideStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "expectedEndAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedById" TEXT,
    "extendedAt" TIMESTAMP(3),
    "extendedById" TEXT,
    "extensionReason" TEXT,
    "dueReminderSentAt" TIMESTAMP(3),
    "escalationReminderSentAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundAutomationOverride_pkey" PRIMARY KEY ("id")
);

-- Backfill legacy manual seasons as active emergency overrides. These records
-- intentionally have no expected end because the old model did not capture one.
INSERT INTO "RoundAutomationOverride" (
    "id",
    "seasonId",
    "status",
    "reason",
    "expectedEndAt",
    "activatedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy_' || substring(md5("id"), 1, 18),
    "id",
    'ACTIVE'::"RoundAutomationOverrideStatus",
    'Legacy manual round-control mode created before emergency controls. Admin review required.',
    NULL,
    COALESCE("roundAutomationLastSyncedAt", "createdAt"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Season"
WHERE "roundAutomationMode" = 'MANUAL';

-- CreateIndex
CREATE INDEX "RoundAutomationOverride_seasonId_status_idx" ON "RoundAutomationOverride"("seasonId", "status");

-- CreateIndex
CREATE INDEX "RoundAutomationOverride_expectedEndAt_idx" ON "RoundAutomationOverride"("expectedEndAt");

-- CreateIndex
CREATE INDEX "RoundAutomationOverride_activatedById_idx" ON "RoundAutomationOverride"("activatedById");

-- CreateIndex
CREATE INDEX "RoundAutomationOverride_resolvedById_idx" ON "RoundAutomationOverride"("resolvedById");

-- Enforce one active break-glass period per season.
CREATE UNIQUE INDEX "RoundAutomationOverride_one_active_per_season"
ON "RoundAutomationOverride"("seasonId")
WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "RoundAutomationOverride" ADD CONSTRAINT "RoundAutomationOverride_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundAutomationOverride" ADD CONSTRAINT "RoundAutomationOverride_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundAutomationOverride" ADD CONSTRAINT "RoundAutomationOverride_extendedById_fkey" FOREIGN KEY ("extendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundAutomationOverride" ADD CONSTRAINT "RoundAutomationOverride_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
