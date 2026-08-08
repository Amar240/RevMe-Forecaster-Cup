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
