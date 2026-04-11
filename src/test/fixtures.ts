import { prisma } from './db'
import bcrypt from 'bcryptjs'
import { addDays, subHours } from 'date-fns'
import type { Role, TeamStatus } from '@prisma/client'
import { formatUniversityDisplayName, normalizeUniversityName } from '@/server/universities'

let teamDisplayIdCounter = 0

export async function createUniversity(name = 'Test University') {
  const displayName = formatUniversityDisplayName(name)
  return prisma.university.create({
    data: {
      name: displayName,
      normalizedName: normalizeUniversityName(displayName),
    },
  })
}

export async function createUser(params: {
  email: string
  role: Role
  firstName?: string
  lastName?: string
  universityId?: string | null
  password?: string
  hasFullAccess?: boolean
  isActive?: boolean
}) {
  const passwordHash = await bcrypt.hash(params.password || 'Password123!', 10)
  return prisma.user.create({
    data: {
      email: params.email,
      firstName: params.firstName || 'Test',
      lastName: params.lastName || 'User',
      role: params.role,
      passwordHash,
      universityId: params.universityId || null,
      hasFullAccess: params.hasFullAccess || false,
      emailVerified: true,
      isActive: params.isActive ?? true,
    },
  })
}

export async function createPermission(name: string) {
  return prisma.permission.upsert({
    where: { name },
    update: {},
    create: { name },
  })
}

export async function grantPermission(userId: string, name: string, grantedById?: string) {
  const perm = await createPermission(name)
  return prisma.userPermission.create({
    data: {
      userId,
      permissionId: perm.id,
      grantedById: grantedById || null,
    },
  })
}

export async function createSeasonWithRounds(params?: {
  status?: 'ACTIVE' | 'DRAFT' | 'PAUSED'
  name?: string
  startDate?: Date
}) {
  // Keep the first round safely open by default so request-level tests do not
  // race a near-now close time during execution.
  const startDate = params?.startDate || subHours(new Date(), 12)
  const endDate = addDays(startDate, 49)
  const season = await prisma.season.create({
    data: {
      name: params?.name || 'Test Season',
      status: params?.status || 'ACTIVE',
      startDate,
      endDate,
      registrationOpen: true,
    },
  })

  const rounds = []
  for (let i = 1; i <= 7; i++) {
    const opensAt = addDays(startDate, i - 1)
    const closesAt = addDays(startDate, i)
    rounds.push(
      await prisma.round.create({
        data: {
          seasonId: season.id,
          number: i,
          opensAt,
          closesAt,
          isFinal: i === 7,
          status: 'OPEN',
        },
      })
    )
  }

  return { season, rounds }
}

export async function createMarkets(seasonId: string) {
  const nashville = await prisma.market.upsert({
    where: { name: 'Nashville CBD' },
    update: {},
    create: { name: 'Nashville CBD' },
  })
  const dubai = await prisma.market.upsert({
    where: { name: 'Dubai' },
    update: {},
    create: { name: 'Dubai' },
  })
  const hamburg = await prisma.market.upsert({
    where: { name: 'Hamburg' },
    update: {},
    create: { name: 'Hamburg' },
  })

  await prisma.seasonMarket.createMany({
    data: [
      { seasonId, marketId: nashville.id, isActive: true },
      { seasonId, marketId: dubai.id, isActive: true },
      { seasonId, marketId: hamburg.id, isActive: true },
    ],
  })

  return [nashville, dubai, hamburg]
}

export async function createTeam(params: {
  name?: string
  displayId?: string
  externalTeamId?: string | null
  supervisorId: string
  universityId: string
  seasonId?: string | null
  status?: TeamStatus
}) {
  return prisma.team.create({
    data: {
      name: params.name || 'Test Team',
      displayId: params.displayId || `T-FIXTURE-${process.pid}-${++teamDisplayIdCounter}`,
      externalTeamId: params.externalTeamId || null,
      supervisorId: params.supervisorId,
      universityId: params.universityId,
      seasonId: params.seasonId || null,
      status: params.status || 'ACTIVE',
    },
  })
}

export async function addTeamMember(teamId: string, userId: string, isSubmitter = false) {
  return prisma.teamMember.create({
    data: {
      teamId,
      userId,
      isSubmitter,
    },
  })
}

export async function createSubmission(params: {
  teamId: string
  roundId: string
  submittedById: string
  values: { marketId: string; metric: 'OCCUPANCY' | 'ADR'; weekOffset: number; value: number }[]
}) {
  const submission = await prisma.submission.create({
    data: {
      teamId: params.teamId,
      roundId: params.roundId,
      submittedById: params.submittedById,
      locked: true,
    },
  })

  await prisma.submissionValue.createMany({
    data: params.values.map((v) => ({
      submissionId: submission.id,
      marketId: v.marketId,
      metric: v.metric,
      weekOffset: v.weekOffset,
      value: v.value,
    })),
  })

  return submission
}

export async function createActual(params: {
  seasonId: string
  roundId: string
  marketId: string
  metric: 'OCCUPANCY' | 'ADR'
  weekOffset: number
  value: number
  createdById: string
}) {
  return prisma.actual.create({
    data: {
      seasonId: params.seasonId,
      roundId: params.roundId,
      marketId: params.marketId,
      metric: params.metric,
      weekOffset: params.weekOffset,
      value: params.value,
      source: 'MANUAL',
      createdById: params.createdById,
      updatedById: params.createdById,
    },
  })
}
