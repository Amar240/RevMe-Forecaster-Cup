import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type DbClient = Prisma.TransactionClient | typeof prisma

type UniversityRecord = {
  id?: string | null
  name?: string | null
  normalizedName?: string | null
  isListed?: boolean | null
}

const universitySelect = {
  id: true,
  name: true,
  normalizedName: true,
  isListed: true,
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

export function getUniversityDeleteEligibility(args: {
  userCount: number
  teamCount: number
}) {
  const { userCount, teamCount } = args

  if (userCount === 0 && teamCount === 0) {
    return {
      canDelete: true,
      deleteBlockedReason: null,
    }
  }

  if (userCount > 0 && teamCount > 0) {
    return {
      canDelete: false,
      deleteBlockedReason:
        'Universities with linked users or teams cannot be deleted. Move or remove those records first.',
    }
  }

  if (userCount > 0) {
    return {
      canDelete: false,
      deleteBlockedReason: 'Universities with linked users cannot be deleted. Move or remove those users first.',
    }
  }

  return {
    canDelete: false,
    deleteBlockedReason: 'Universities with linked teams cannot be deleted. Keep the university for history or move those teams first.',
  }
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

async function findUniversityByNormalizedNameInternal(
  name: string,
  db: DbClient,
  isListed?: boolean
) {
  const normalizedName = normalizeUniversityName(name)
  const where: Prisma.UniversityWhereInput = isListed === undefined
    ? { normalizedName }
    : { normalizedName, isListed }

  const exactMatch = await db.university.findFirst({
    where,
    select: universitySelect,
    orderBy: { createdAt: 'asc' },
  })

  if (exactMatch) {
    return exactMatch
  }

  const universities = await listUniversities(db)
  return (
    universities.find(
      (university) =>
        (isListed === undefined || university.isListed === isListed) &&
        getUniversityKey(university) === normalizedName
    ) ?? null
  )
}

export async function findUniversityByNormalizedName(name: string, db: DbClient = prisma) {
  return findUniversityByNormalizedNameInternal(name, db)
}

export async function resolveOrCreateUniversity(
  args: {
    name: string
    country?: string | null
    isListed?: boolean
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
      isListed: args.isListed ?? true,
      country,
    },
  })
}

export async function resolveOrReusePendingUniversity(
  args: {
    name: string
    country?: string | null
  },
  db: DbClient = prisma
): Promise<{ id: string }> {
  const name = formatUniversityDisplayName(args.name)
  const normalizedName = normalizeUniversityName(name)
  const country = args.country?.trim() || null

  const listed = await findUniversityByNormalizedNameInternal(name, db, true)
  if (listed) {
    if (!listed.normalizedName || (!listed.country && country)) {
      return db.university.update({
        where: { id: listed.id },
        data: {
          normalizedName: listed.normalizedName ?? normalizedName,
          country: listed.country ?? country,
        },
        select: { id: true },
      })
    }

    return { id: listed.id }
  }

  const pending = await findUniversityByNormalizedNameInternal(name, db, false)
  if (pending) {
    if (!pending.normalizedName || (!pending.country && country)) {
      return db.university.update({
        where: { id: pending.id },
        data: {
          normalizedName: pending.normalizedName ?? normalizedName,
          country: pending.country ?? country,
        },
        select: { id: true },
      })
    }

    return { id: pending.id }
  }

  return db.university.create({
    data: {
      name,
      normalizedName,
      isListed: false,
      country,
    },
    select: { id: true },
  })
}
