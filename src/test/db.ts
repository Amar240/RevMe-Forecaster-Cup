import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export async function ensureTestSchema() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImportAssistMode') THEN
        CREATE TYPE "ImportAssistMode" AS ENUM ('DISABLED', 'ON_DEMAND');
      END IF;
    END
    $$;
  `)
  const seasonColumns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Season'
  `
  if (!seasonColumns.some((column) => column.column_name === 'importAssistMode')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Season" ADD COLUMN "importAssistMode" "ImportAssistMode" NOT NULL DEFAULT \'DISABLED\'')
  }

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoundAutomationMode') THEN
        CREATE TYPE "RoundAutomationMode" AS ENUM ('AUTOMATIC', 'MANUAL');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoundTransitionTrigger') THEN
        CREATE TYPE "RoundTransitionTrigger" AS ENUM ('SCHEDULED', 'ADMIN', 'MODE_CHANGE', 'RECOVERY');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoundTransitionOutcome') THEN
        CREATE TYPE "RoundTransitionOutcome" AS ENUM ('APPLIED', 'NO_CHANGE', 'SKIPPED', 'FAILED');
      END IF;
    END
    $$;
  `)
  if (!seasonColumns.some((column) => column.column_name === 'roundAutomationMode')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Season" ADD COLUMN "roundAutomationMode" "RoundAutomationMode" NOT NULL DEFAULT \'AUTOMATIC\'')
  }
  if (!seasonColumns.some((column) => column.column_name === 'roundAutomationGeneration')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Season" ADD COLUMN "roundAutomationGeneration" INTEGER NOT NULL DEFAULT 1')
  }
  if (!seasonColumns.some((column) => column.column_name === 'roundAutomationLastSyncedAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Season" ADD COLUMN "roundAutomationLastSyncedAt" TIMESTAMP(3)')
  }
  if (!seasonColumns.some((column) => column.column_name === 'roundAutomationScheduleError')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Season" ADD COLUMN "roundAutomationScheduleError" TEXT')
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RoundTransitionRun" (
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
      CONSTRAINT "RoundTransitionRun_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "RoundTransitionRun_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "RoundTransitionRun_idempotencyKey_key" ON "RoundTransitionRun"("idempotencyKey")')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RoundTransitionRun_seasonId_processedAt_idx" ON "RoundTransitionRun"("seasonId", "processedAt")')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RoundTransitionRun_outcome_processedAt_idx" ON "RoundTransitionRun"("outcome", "processedAt")')

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoundAutomationOverrideStatus') THEN
        CREATE TYPE "RoundAutomationOverrideStatus" AS ENUM ('ACTIVE', 'RESOLVED');
      END IF;
    END
    $$;
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RoundAutomationOverride" (
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
      CONSTRAINT "RoundAutomationOverride_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "RoundAutomationOverride_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "RoundAutomationOverride_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "RoundAutomationOverride_extendedById_fkey" FOREIGN KEY ("extendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "RoundAutomationOverride_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RoundAutomationOverride_seasonId_status_idx" ON "RoundAutomationOverride"("seasonId", "status")')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RoundAutomationOverride_expectedEndAt_idx" ON "RoundAutomationOverride"("expectedEndAt")')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RoundAutomationOverride_activatedById_idx" ON "RoundAutomationOverride"("activatedById")')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RoundAutomationOverride_resolvedById_idx" ON "RoundAutomationOverride"("resolvedById")')
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "RoundAutomationOverride_one_active_per_season" ON "RoundAutomationOverride"("seasonId") WHERE "status" = \'ACTIVE\'')

  await prisma.$executeRawUnsafe(`
    WITH ranked_open_rounds AS (
      SELECT "id", ROW_NUMBER() OVER (PARTITION BY "seasonId" ORDER BY "opensAt" DESC, "number" DESC) AS row_number
      FROM "Round" WHERE "status" = 'OPEN'
    )
    UPDATE "Round" AS round SET "status" = 'UPCOMING'
    FROM ranked_open_rounds AS ranked
    WHERE round."id" = ranked."id" AND ranked.row_number > 1
  `)
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Round_one_open_per_season" ON "Round"("seasonId") WHERE "status" = \'OPEN\'')

  const columns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'University'
  `

  const hasNormalizedName = columns.some((column) => column.column_name === 'normalizedName')
  if (!hasNormalizedName) {
    await prisma.$executeRawUnsafe('ALTER TABLE "University" ADD COLUMN "normalizedName" TEXT')
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "University_normalizedName_idx" ON "University"("normalizedName")'
    )
  }

  const hasIsListed = columns.some((column) => column.column_name === 'isListed')
  if (!hasIsListed) {
    await prisma.$executeRawUnsafe('ALTER TABLE "University" ADD COLUMN "isListed" BOOLEAN NOT NULL DEFAULT true')
  }

  const userColumns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
  `

  const hasIsActive = userColumns.some((column) => column.column_name === 'isActive')
  if (!hasIsActive) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true')
  }

  const hasEmailVerifiedAt = userColumns.some((column) => column.column_name === 'emailVerifiedAt')
  if (!hasEmailVerifiedAt) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3)')
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailVerificationCode" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "codeHash" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "EmailVerificationCode_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "EmailVerificationCode_userId_idx" ON "EmailVerificationCode"("userId")'
  )
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "EmailVerificationCode_expiresAt_idx" ON "EmailVerificationCode"("expiresAt")'
  )

  const teamColumns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Team'
  `

  const hasExternalTeamId = teamColumns.some((column) => column.column_name === 'externalTeamId')
  if (!hasExternalTeamId) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Team" ADD COLUMN "externalTeamId" TEXT')
  }

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Team_externalTeamId_idx" ON "Team"("externalTeamId")'
  )
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Team_seasonId_externalTeamId_key" ON "Team"("seasonId", "externalTeamId")'
  )

  const teamStatuses = await prisma.$queryRaw<{ enumlabel: string }[]>`
    SELECT enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'TeamStatus'
  `

  const hasArchivedStatus = teamStatuses.some((status) => status.enumlabel === 'ARCHIVED')
  if (!hasArchivedStatus) {
    await prisma.$executeRawUnsafe(`ALTER TYPE "TeamStatus" ADD VALUE 'ARCHIVED'`)
  }

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TeamSupervisorAssignmentSource') THEN
        CREATE TYPE "TeamSupervisorAssignmentSource" AS ENUM ('INITIAL', 'REASSIGNMENT', 'RESTORED', 'LEGACY_BACKFILL');
      END IF;
    END
    $$;
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TeamSupervisorAssignment" (
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
      CONSTRAINT "TeamSupervisorAssignment_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "TeamSupervisorAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "TeamSupervisorAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "TeamSupervisorAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "TeamSupervisorAssignment_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "TeamSupervisorAssignment_teamId_startedAt_idx" ON "TeamSupervisorAssignment"("teamId", "startedAt")')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "TeamSupervisorAssignment_supervisorId_startedAt_idx" ON "TeamSupervisorAssignment"("supervisorId", "startedAt")')
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "TeamSupervisorAssignment_endedAt_idx" ON "TeamSupervisorAssignment"("endedAt")')
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "TeamSupervisorAssignment_one_open_per_team_idx" ON "TeamSupervisorAssignment"("teamId") WHERE "endedAt" IS NULL')

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ArchiveStatus') THEN
        CREATE TYPE "ArchiveStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
      END IF;
    END
    $$;
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SeasonArchive" (
      "id" TEXT NOT NULL,
      "seasonId" TEXT NOT NULL,
      "status" "ArchiveStatus" NOT NULL DEFAULT 'PENDING',
      "version" INTEGER NOT NULL DEFAULT 1,
      "s3Bucket" TEXT,
      "s3Prefix" TEXT,
      "fileManifest" JSONB,
      "totalSizeBytes" INTEGER,
      "errorMessage" TEXT,
      "triggeredById" TEXT NOT NULL,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SeasonArchive_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "SeasonArchive_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "SeasonArchive_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "SeasonArchive_seasonId_version_key" ON "SeasonArchive"("seasonId", "version")'
  )
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "SeasonArchive_seasonId_idx" ON "SeasonArchive"("seasonId")'
  )
}

export async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `

  if (tables.length === 0) return

  const quoted = tables.map((t) => `"${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`)
}
