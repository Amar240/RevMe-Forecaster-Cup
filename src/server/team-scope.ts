import type { Prisma, SeasonStatus } from '@prisma/client'
import { prisma } from '@/server/db'
import { getCurrentOperationalSeason } from '@/server/season'

export const TEAM_PENDING_STATUSES = ['DRAFT', 'APPROVED', 'PENDING_APPROVAL'] as const
export const TEAM_DISQUALIFIED_STATUSES = ['DISQUALIFIED', 'REJECTED'] as const

export interface TeamScopeSeason {
  id: string
  name: string
  status: SeasonStatus
}

export interface TeamScopeSummary {
  activeTeams: number
  pendingTeams: number
  disqualifiedTeams: number
}

export interface AdminTeamScopeResult {
  season: TeamScopeSeason | null
  totalTeams: number
  summary: TeamScopeSummary
}

export const EMPTY_TEAM_SCOPE_SUMMARY: TeamScopeSummary = {
  activeTeams: 0,
  pendingTeams: 0,
  disqualifiedTeams: 0,
}

export function getSeasonTeamWhere(seasonId: string): Prisma.TeamWhereInput {
  return { seasonId }
}

export function getActiveTeamWhere(seasonId: string): Prisma.TeamWhereInput {
  return {
    seasonId,
    status: 'ACTIVE',
  }
}

export function getPendingTeamWhere(seasonId: string): Prisma.TeamWhereInput {
  return {
    seasonId,
    status: { in: [...TEAM_PENDING_STATUSES] },
  }
}

export function getDisqualifiedTeamWhere(seasonId: string): Prisma.TeamWhereInput {
  return {
    seasonId,
    status: { in: [...TEAM_DISQUALIFIED_STATUSES] },
  }
}

export async function resolveAdminTeamSeason(seasonId?: string | null): Promise<TeamScopeSeason | null> {
  if (seasonId) {
    return prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, name: true, status: true },
    })
  }

  return getCurrentOperationalSeason({
    select: { id: true, name: true, status: true },
  })
}

export async function getSeasonTeamSummary(seasonId: string): Promise<Pick<AdminTeamScopeResult, 'totalTeams' | 'summary'>> {
  const [totalTeams, activeTeams, pendingTeams, disqualifiedTeams] = await Promise.all([
    prisma.team.count({ where: getSeasonTeamWhere(seasonId) }),
    prisma.team.count({ where: getActiveTeamWhere(seasonId) }),
    prisma.team.count({ where: getPendingTeamWhere(seasonId) }),
    prisma.team.count({ where: getDisqualifiedTeamWhere(seasonId) }),
  ])

  return {
    totalTeams,
    summary: {
      activeTeams,
      pendingTeams,
      disqualifiedTeams,
    },
  }
}

export async function getAdminTeamScope(args?: { seasonId?: string | null }): Promise<AdminTeamScopeResult> {
  const season = await resolveAdminTeamSeason(args?.seasonId)
  if (!season) {
    return {
      season: null,
      totalTeams: 0,
      summary: EMPTY_TEAM_SCOPE_SUMMARY,
    }
  }

  const scopedCounts = await getSeasonTeamSummary(season.id)

  return {
    season,
    totalTeams: scopedCounts.totalTeams,
    summary: scopedCounts.summary,
  }
}
