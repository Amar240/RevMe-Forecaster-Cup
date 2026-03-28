import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type DbClient = Prisma.TransactionClient | typeof prisma

type UniversityRecord = {
  id?: string | null
  name?: string | null
  normalizedName?: string | null
}

const universitySelect = {
  id: true,
  name: true,
  normalizedName: true,
  country: true,
  createdAt: true,
} satisfies Prisma.UniversitySelect

export function formatUniversityDisplayName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function normalizeUniversityName(name: string) {
  return formatUniversityDisplayName(name).toLowerCase()
}

export function sameUniversity(left: UniversityRecord | null | undefined, right: UniversityRecord | null | undefined) {
  if (!left || !right) {
    return false
  }

  if (left.id && right.id && left.id === right.id) {
    return true
  }

  const leftNormalized = getUniversityKey(left)
  const rightNormalized = getUniversityKey(right)

  return Boolean(leftNormalized && rightNormalized && leftNormalized === rightNormalized)
}

function getUniversityKey(record: UniversityRecord) {
  if (record.normalizedName?.trim()) {
    return normalizeUniversityName(record.normalizedName)
  }

  if (record.name?.trim()) {
    return normalizeUniversityName(record.name)
  }

  return null
}

async function listUniversities(db: DbClient) {
  return db.university.findMany({
    select: universitySelect,
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
  })
}

export async function findUniversityByNormalizedName(name: string, db: DbClient = prisma) {
  const normalizedName = normalizeUniversityName(name)

  const exactMatch = await db.university.findFirst({
    where: { normalizedName },
    select: universitySelect,
    orderBy: { createdAt: 'asc' },
  })

  if (exactMatch) {
    return exactMatch
  }

  const universities = await listUniversities(db)
  return universities.find((university) => getUniversityKey(university) === normalizedName) ?? null
}

export async function resolveOrCreateUniversity(
  args: {
    name: string
    country?: string | null
  },
  db: DbClient = prisma
) {
  const name = formatUniversityDisplayName(args.name)
  const normalizedName = normalizeUniversityName(name)
  const country = args.country?.trim() || null

  const existing = await findUniversityByNormalizedName(name, db)

  if (existing) {
    if (!existing.normalizedName || (!existing.country && country)) {
      return db.university.update({
        where: { id: existing.id },
        data: {
          normalizedName: existing.normalizedName ?? normalizedName,
          country: existing.country ?? country,
        },
      })
    }

    return existing
  }

  return db.university.create({
    data: {
      name,
      normalizedName,
      country,
    },
  })
}
