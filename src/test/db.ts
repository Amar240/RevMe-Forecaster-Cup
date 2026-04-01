import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export async function ensureTestSchema() {
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
}

export async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `

  if (tables.length === 0) return

  const quoted = tables.map((t) => `"${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`)
}
