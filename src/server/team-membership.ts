import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import {
  CURRENT_SUPERVISOR_SEASON_STATUSES,
  CURRENT_SUPERVISOR_TEAM_STATUSES,
} from '@/server/team-supervisor-assignment'

type DbClient = Prisma.TransactionClient | typeof prisma

const conflictTeamSelect = {
  id: true,
  name: true,
  displayId: true,
  seasonId: true,
} satisfies Prisma.TeamSelect

export type TeamMembershipConflict = Prisma.TeamMemberGetPayload<{
  include: {
    team: {
      select: typeof conflictTeamSelect
    }
  }
}>

export function getSeasonScopedMembershipFilter(args: {
  seasonId?: string | null
  excludeTeamId?: string
  excludeTeamStatuses?: Array<'REJECTED' | 'ARCHIVED'>
}): Prisma.TeamMemberWhereInput {
  return {
    ...(args.excludeTeamId ? { teamId: { not: args.excludeTeamId } } : {}),
    ...(args.seasonId || args.excludeTeamStatuses?.length
      ? { team: {
          ...(args.seasonId ? { seasonId: args.seasonId } : {}),
          ...(args.excludeTeamStatuses?.length ? { status: { notIn: args.excludeTeamStatuses } } : {}),
        } }
      : {}),
  }
}

export function getSeasonScopedTeamMemberWhere(args: {
  userId: string
  seasonId?: string | null
  isSubmitter?: boolean
  excludeTeamId?: string
}): Prisma.TeamMemberWhereInput {
  return {
    userId: args.userId,
    ...(typeof args.isSubmitter === 'boolean' ? { isSubmitter: args.isSubmitter } : {}),
    ...getSeasonScopedMembershipFilter({
      seasonId: args.seasonId,
      excludeTeamId: args.excludeTeamId,
    }),
  }
}

export async function findSeasonMembershipConflict(args: {
  userId: string
  seasonId?: string | null
  excludeTeamId?: string
  db?: DbClient
}): Promise<TeamMembershipConflict | null> {
  const db = args.db ?? prisma

  return db.teamMember.findFirst({
    where: getSeasonScopedTeamMemberWhere({
      userId: args.userId,
      seasonId: args.seasonId,
      excludeTeamId: args.excludeTeamId,
    }),
    include: {
      team: {
        select: conflictTeamSelect,
      },
    },
  })
}

export function getSeasonScopedSupervisorTeamWhere(args: {
  supervisorId?: string
  seasonId?: string | null
  excludeTeamId?: string
}): Prisma.TeamWhereInput {
  return {
    ...(args.supervisorId ? { supervisorId: args.supervisorId } : {}),
    ...(args.seasonId !== undefined ? { seasonId: args.seasonId } : {}),
    ...(args.excludeTeamId ? { id: { not: args.excludeTeamId } } : {}),
    status: { in: [...CURRENT_SUPERVISOR_TEAM_STATUSES] },
    OR: [
      { seasonId: null },
      { season: { status: { in: [...CURRENT_SUPERVISOR_SEASON_STATUSES] } } },
    ],
  }
}

export async function countSupervisorTeamsInSeason(args: {
  supervisorId: string
  seasonId?: string | null
  excludeTeamId?: string
  db?: DbClient
}) {
  const db = args.db ?? prisma

  return db.team.count({
    where: getSeasonScopedSupervisorTeamWhere({
      supervisorId: args.supervisorId,
      seasonId: args.seasonId,
      excludeTeamId: args.excludeTeamId,
    }),
  })
}

export async function getSupervisorTeamCountsForSeason(args: {
  supervisorIds: string[]
  seasonId?: string | null
  db?: DbClient
  excludeStatuses?: Array<'REJECTED' | 'ARCHIVED'>
}) {
  const db = args.db ?? prisma
  const supervisorIds = Array.from(new Set(args.supervisorIds.filter(Boolean)))

  if (supervisorIds.length === 0) {
    return new Map<string, number>()
  }

  const counts = await db.team.groupBy({
    by: ['supervisorId'],
    where: {
      supervisorId: { in: supervisorIds },
      ...(args.seasonId !== undefined ? { seasonId: args.seasonId } : {}),
      status: {
        in: [...CURRENT_SUPERVISOR_TEAM_STATUSES],
        ...(args.excludeStatuses?.length ? { notIn: args.excludeStatuses } : {}),
      },
      OR: [
        { seasonId: null },
        { season: { status: { in: [...CURRENT_SUPERVISOR_SEASON_STATUSES] } } },
      ],
    },
    _count: { _all: true },
  })

  return new Map(
    counts
      .filter((entry) => entry.supervisorId)
      .map((entry) => [entry.supervisorId as string, entry._count._all])
  )
}
