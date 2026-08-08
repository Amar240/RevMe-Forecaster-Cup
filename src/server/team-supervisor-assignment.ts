import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'

type DbClient = Prisma.TransactionClient | typeof prisma

export const CURRENT_SUPERVISOR_TEAM_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVE',
] as const

export const TERMINAL_SUPERVISOR_TEAM_STATUSES = [
  'ARCHIVED',
  'REJECTED',
  'DISQUALIFIED',
] as const

export const CURRENT_SUPERVISOR_SEASON_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED'] as const

export function getCurrentSupervisorResponsibilityWhere(
  supervisorId?: string
): Prisma.TeamWhereInput {
  return {
    ...(supervisorId ? { supervisorId } : {}),
    status: { in: [...CURRENT_SUPERVISOR_TEAM_STATUSES] },
    OR: [
      { seasonId: null },
      { season: { status: { in: [...CURRENT_SUPERVISOR_SEASON_STATUSES] } } },
    ],
  }
}

export function isCurrentSupervisorResponsibility(team: {
  status: string
  seasonId: string | null
  season?: { status: string } | null
}) {
  if (!CURRENT_SUPERVISOR_TEAM_STATUSES.includes(team.status as (typeof CURRENT_SUPERVISOR_TEAM_STATUSES)[number])) {
    return false
  }

  if (!team.seasonId) return true
  return CURRENT_SUPERVISOR_SEASON_STATUSES.includes(
    team.season?.status as (typeof CURRENT_SUPERVISOR_SEASON_STATUSES)[number]
  )
}

export async function createInitialSupervisorAssignment(args: {
  teamId: string
  supervisorId: string | null | undefined
  assignedById?: string | null
  reason?: string | null
  startedAt?: Date
  source?: 'INITIAL' | 'RESTORED'
  db?: DbClient
}) {
  if (!args.supervisorId) return null
  const db = args.db ?? prisma

  const existing = await db.teamSupervisorAssignment.findFirst({
    where: { teamId: args.teamId, endedAt: null },
    select: { id: true, supervisorId: true },
  })

  if (existing) return existing

  return db.teamSupervisorAssignment.create({
    data: {
      teamId: args.teamId,
      supervisorId: args.supervisorId,
      assignedById: args.assignedById ?? null,
      reason: args.reason ?? null,
      startedAt: args.startedAt ?? new Date(),
      source: args.source ?? 'INITIAL',
    },
    select: { id: true, supervisorId: true },
  })
}

export async function closeOpenSupervisorAssignment(args: {
  teamId: string
  endedById?: string | null
  reason: string
  endedAt?: Date
  db?: DbClient
}) {
  const db = args.db ?? prisma
  return db.teamSupervisorAssignment.updateMany({
    where: { teamId: args.teamId, endedAt: null },
    data: {
      endedAt: args.endedAt ?? new Date(),
      endedById: args.endedById ?? null,
      endReason: args.reason,
    },
  })
}

export async function transitionSupervisorAssignment(args: {
  teamId: string
  previousSupervisorId: string | null
  nextSupervisorId: string | null
  actorId: string
  reason: string
  teamCreatedAt?: Date
  changedAt?: Date
  db?: DbClient
}) {
  const db = args.db ?? prisma
  const changedAt = args.changedAt ?? new Date()
  const openAssignment = await db.teamSupervisorAssignment.findFirst({
    where: { teamId: args.teamId, endedAt: null },
    select: { id: true, supervisorId: true },
  })

  if (openAssignment) {
    await db.teamSupervisorAssignment.update({
      where: { id: openAssignment.id },
      data: {
        endedAt: changedAt,
        endedById: args.actorId,
        endReason: args.reason,
      },
    })
  } else if (args.previousSupervisorId) {
    await db.teamSupervisorAssignment.create({
      data: {
        teamId: args.teamId,
        supervisorId: args.previousSupervisorId,
        startedAt: args.teamCreatedAt ?? changedAt,
        endedAt: changedAt,
        endedById: args.actorId,
        endReason: args.reason,
        source: 'LEGACY_BACKFILL',
        isApproximate: true,
      },
    })
  }

  if (!args.nextSupervisorId) return null

  return db.teamSupervisorAssignment.create({
    data: {
      teamId: args.teamId,
      supervisorId: args.nextSupervisorId,
      startedAt: changedAt,
      assignedById: args.actorId,
      reason: args.reason,
      source: 'REASSIGNMENT',
    },
  })
}

export async function closeSeasonSupervisorAssignments(args: {
  seasonId: string
  actorId: string
  reason: string
  endedAt?: Date
  db?: DbClient
}) {
  const db = args.db ?? prisma
  const teams = await db.team.findMany({
    where: {
      seasonId: args.seasonId,
      supervisorAssignments: { some: { endedAt: null } },
    },
    select: { id: true },
  })

  if (teams.length === 0) return { count: 0 }

  return db.teamSupervisorAssignment.updateMany({
    where: { teamId: { in: teams.map((team) => team.id) }, endedAt: null },
    data: {
      endedAt: args.endedAt ?? new Date(),
      endedById: args.actorId,
      endReason: args.reason,
    },
  })
}
