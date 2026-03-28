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
}

export async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `

  if (tables.length === 0) return

  const quoted = tables.map((t) => `"${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`)
}
