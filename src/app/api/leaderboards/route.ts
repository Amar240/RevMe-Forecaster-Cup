import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { logger } from '@/server/logger'
import { getSession } from '@/server/auth'
import { jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { getSeasonScopedTeamMemberWhere } from '@/server/team-membership'
import { competitionRanks } from '@/lib/learning-analytics'

export const dynamic = 'force-dynamic'

function isEligibleLeaderboardTeam(
  team: { status: string; universityId: string },
  universityIdParam: string | null
) {
  return (
    (team.status === 'ACTIVE' || team.status === 'APPROVED') &&
    (!universityIdParam || team.universityId === universityIdParam)
  )
}

function buildPublishedMetricEntries(
  aggregates: {
    teamId: string
    team: {
      name: string
      displayId: string
      status: string
      universityId: string
      university: { name: string }
    }
  }[],
  roundAggregates: {
    teamId: string
    roundId: string | null
    mape: number
    nErrors: number
  }[],
  visibleRoundIds: Set<string>,
  universityIdParam: string | null
) {
  const publishedStats = new Map<string, { weightedMapeSum: number; nErrors: number }>()

  roundAggregates.forEach((aggregate) => {
    if (!aggregate.roundId || !visibleRoundIds.has(aggregate.roundId)) {
      return
    }

    const existing = publishedStats.get(aggregate.teamId) || { weightedMapeSum: 0, nErrors: 0 }
    existing.weightedMapeSum += aggregate.mape * aggregate.nErrors
    existing.nErrors += aggregate.nErrors
    publishedStats.set(aggregate.teamId, existing)
  })

  return aggregates
    .filter((aggregate) => isEligibleLeaderboardTeam(aggregate.team, universityIdParam))
    .map((aggregate) => {
      const stats = publishedStats.get(aggregate.teamId)
      if (!stats || stats.nErrors === 0) {
        return null
      }

      return {
        teamId: aggregate.teamId,
        team: aggregate.team,
        mape: stats.weightedMapeSum / stats.nErrors,
        nErrors: stats.nErrors,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => {
      if (a.mape !== b.mape) return a.mape - b.mape
      if (a.nErrors !== b.nErrors) return b.nErrors - a.nErrors
      return a.team.name.localeCompare(b.team.name)
    })
}

function buildPublishedCombinedEntries(
  roundAggregates: {
    teamId: string
    roundId: string | null
    metric: 'OCCUPANCY' | 'ADR'
    mape: number
    nErrors: number
    team: {
      name: string
      displayId: string
      status: string
      universityId: string
      university: { name: string }
    }
  }[],
  visibleRoundIds: Set<string>,
  universityIdParam: string | null
) {
  const teamScores = new Map<
    string,
    {
      team: (typeof roundAggregates)[number]['team']
      occupancyWeightedMapeSum: number
      occupancyErrors: number
      adrWeightedMapeSum: number
      adrErrors: number
    }
  >()

  roundAggregates.forEach((aggregate) => {
    if (!aggregate.roundId || !visibleRoundIds.has(aggregate.roundId)) {
      return
    }

    const existing = teamScores.get(aggregate.teamId) || {
      team: aggregate.team,
      occupancyWeightedMapeSum: 0,
      occupancyErrors: 0,
      adrWeightedMapeSum: 0,
      adrErrors: 0,
    }

    if (aggregate.metric === 'OCCUPANCY') {
      existing.occupancyWeightedMapeSum += aggregate.mape * aggregate.nErrors
      existing.occupancyErrors += aggregate.nErrors
    } else {
      existing.adrWeightedMapeSum += aggregate.mape * aggregate.nErrors
      existing.adrErrors += aggregate.nErrors
    }

    teamScores.set(aggregate.teamId, existing)
  })

  return Array.from(teamScores.entries())
    .filter(([_, data]) => isEligibleLeaderboardTeam(data.team, universityIdParam))
    .filter(([_, data]) => data.occupancyErrors > 0 && data.adrErrors > 0)
    .map(([teamId, data]) => {
      const occupancyMape = data.occupancyWeightedMapeSum / data.occupancyErrors
      const adrMape = data.adrWeightedMapeSum / data.adrErrors
      return {
        teamId,
        team: data.team,
        mape: (occupancyMape + adrMape) / 2,
        occupancyMape,
        adrMape,
        nErrors: data.occupancyErrors + data.adrErrors,
      }
    })
    .sort((a, b) => {
      if (a.mape !== b.mape) return a.mape - b.mape
      if (a.occupancyMape !== b.occupancyMape) return a.occupancyMape - b.occupancyMape
      if (a.adrMape !== b.adrMape) return a.adrMape - b.adrMape
      if (a.nErrors !== b.nErrors) return b.nErrors - a.nErrors
      return a.team.name.localeCompare(b.team.name)
    })
}


export async function GET(request: NextRequest) {
  try {
    const user = await getSession()

    const { searchParams } = new URL(request.url)
    const metricParam = searchParams.get('metric') || 'OCCUPANCY'
    const roundIdParam = searchParams.get('roundId')
    const universityIdParam = searchParams.get('universityId')

    const isCombined = metricParam === 'COMBINED'
    const metric = metricParam === 'ADR' ? 'ADR' : 'OCCUPANCY'

    const operationalSeason = await getCurrentOperationalSeason({
      select: { id: true, name: true },
    })

    if (!operationalSeason) {
      return NextResponse.json({ leaderboard: [], seasonName: '', rounds: [], myTeamId: null, myPosition: null, metric: metricParam, expectedErrors: 0, nextUnpublishedRound: null })
    }

    const nextUnpublishedRound = await prisma.round.findFirst({ where: { seasonId: operationalSeason.id, leaderboardVisible: false }, orderBy: { number: 'asc' }, select: { id: true, number: true, status: true, closesAt: true } })

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUB_ADMIN'
    const isSupervisor = user?.role === 'SUPERVISOR'
    const isStudent = user?.role === 'STUDENT'
    const canSeeAllDetails = isAdmin || isSupervisor

    // Non-admin users only see rounds where leaderboard has been published
    const rounds = await prisma.round.findMany({
      where: {
        seasonId: operationalSeason.id,
        ...(isAdmin ? {} : { leaderboardVisible: true }),
      },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, isFinal: true, status: true, leaderboardVisible: true },
    })
    const visibleRoundIds = rounds.map((round) => round.id)
    const visibleRoundIdSet = new Set(visibleRoundIds)

    let leaderboard: {
      rank: number
      teamId: string
      teamName: string
      teamDisplayId: string
      university: string
      universityId: string
      mape: number | null
      nErrors: number | null
      roundScores: Record<string, number>
      cumulativeScores: Record<string, number>
      occupancyMape?: number | null
      adrMape?: number | null
    }[] = []

    let myTeamId = null
    if (user) {
      const teamMember = await prisma.teamMember.findFirst({
        where: getSeasonScopedTeamMemberWhere({
          userId: user.id,
          seasonId: operationalSeason.id,
        }),
      })
      myTeamId = teamMember?.teamId || null
    }

    if (roundIdParam && !isAdmin && !visibleRoundIdSet.has(roundIdParam)) {
      return NextResponse.json({
        leaderboard: [],
        seasonName: operationalSeason.name,
        myTeamId,
        metric,
        expectedErrors: 0,
        myPosition: null,
        rounds: rounds.map((r) => ({ id: r.id, number: r.number, isFinal: r.isFinal, status: r.status })),
      })
    }

    if (isCombined) {
      const allAggregates = await prisma.scoreAggregate.findMany({
        where: {
          seasonId: operationalSeason.id,
          scopeType: 'SEASON',
        },
        include: {
          team: {
            include: { university: true },
          },
        },
      })

      const teamScores = new Map<string, {
        team: typeof allAggregates[0]['team']
        occupancyMAPE: number | null
        adrMAPE: number | null
        totalNErrors: number
      }>()

      allAggregates.forEach((agg) => {
        const existing = teamScores.get(agg.teamId) || {
          team: agg.team,
          occupancyMAPE: null,
          adrMAPE: null,
          totalNErrors: 0,
        }
        if (agg.metric === 'OCCUPANCY') {
          existing.occupancyMAPE = agg.mape
          existing.totalNErrors += agg.nErrors
        } else if (agg.metric === 'ADR') {
          existing.adrMAPE = agg.mape
          existing.totalNErrors += agg.nErrors
        }
        teamScores.set(agg.teamId, existing)
      })

      const combinedEntries = Array.from(teamScores.entries())
        .filter(([_, data]) => data.team.status === 'ACTIVE' || data.team.status === 'APPROVED')
        .filter(([_, data]) => !universityIdParam || data.team.universityId === universityIdParam)
        .filter(([_, data]) => data.occupancyMAPE !== null && data.adrMAPE !== null)
        .map(([teamId, data]) => {
          const finalScore = (data.occupancyMAPE! + data.adrMAPE!) / 2
          return {
            teamId,
            team: data.team,
            mape: finalScore,
            occupancyMape: data.occupancyMAPE!,
            adrMape: data.adrMAPE!,
            nErrors: data.totalNErrors,
          }
        })
        .sort((a, b) => {
          if (a.mape !== b.mape) return a.mape - b.mape
          if (a.occupancyMape !== b.occupancyMape) return a.occupancyMape - b.occupancyMape
          if (a.adrMape !== b.adrMape) return a.adrMape - b.adrMape
          if (a.nErrors !== b.nErrors) return b.nErrors - a.nErrors
          return a.team.name.localeCompare(b.team.name)
        })

      if (isStudent && visibleRoundIds.length > 0) {
        const visibleRoundAggregates = await prisma.scoreAggregate.findMany({
          where: {
            seasonId: operationalSeason.id,
            scopeType: 'ROUND',
            roundId: { in: visibleRoundIds },
          },
          include: {
            team: {
              include: { university: true },
            },
          },
        })

        const publishedCombinedEntries = buildPublishedCombinedEntries(
          visibleRoundAggregates,
          visibleRoundIdSet,
          universityIdParam
        )

        leaderboard = publishedCombinedEntries.map((entry, index) => ({
          rank: index + 1,
          teamId: entry.teamId,
          teamName: entry.team.name,
          teamDisplayId: entry.team.displayId,
          university: entry.team.university.name,
          universityId: entry.team.universityId,
          mape: entry.mape,
          occupancyMape: entry.occupancyMape,
          adrMape: entry.adrMape,
          nErrors: entry.nErrors,
          roundScores: {},
          cumulativeScores: {},
        }))
      } else {
        leaderboard = combinedEntries.map((entry, index) => ({
          rank: index + 1,
          teamId: entry.teamId,
          teamName: entry.team.name,
          teamDisplayId: entry.team.displayId,
          university: entry.team.university.name,
          universityId: entry.team.universityId,
          mape: canSeeAllDetails ? entry.mape : null,
          occupancyMape: canSeeAllDetails ? entry.occupancyMape : null,
          adrMape: canSeeAllDetails ? entry.adrMape : null,
          nErrors: canSeeAllDetails ? entry.nErrors : null,
          roundScores: {},
          cumulativeScores: {},
        }))
      }
    } else {
      const aggregates = await prisma.scoreAggregate.findMany({
        where: {
          seasonId: operationalSeason.id,
          metric,
          scopeType: roundIdParam ? 'ROUND' : 'SEASON',
          ...(roundIdParam ? { roundId: roundIdParam } : {}),
        },
        include: {
          team: {
            include: { university: true },
          },
        },
        orderBy: { mape: 'asc' },
      })

      const roundAggregates = await prisma.scoreAggregate.findMany({
        where: {
          seasonId: operationalSeason.id,
          metric,
          scopeType: 'ROUND',
        },
        select: {
          teamId: true,
          roundId: true,
          mape: true,
          nErrors: true,
        },
      })

      const roundScoresByTeam: Record<string, Record<string, number>> = {}
      roundAggregates.forEach((agg) => {
        if (!roundScoresByTeam[agg.teamId]) {
          roundScoresByTeam[agg.teamId] = {}
        }
        if (agg.roundId) {
          roundScoresByTeam[agg.teamId][agg.roundId] = agg.mape
        }
      })

      const cumulativeScoresByTeam: Record<string, Record<string, number>> = {}
      Object.keys(roundScoresByTeam).forEach((teamId) => {
        cumulativeScoresByTeam[teamId] = {}
        let totalMAPE = 0
        let count = 0

        rounds.forEach((round) => {
          const roundMAPE = roundScoresByTeam[teamId]?.[round.id]
          if (roundMAPE !== undefined) {
            totalMAPE += roundMAPE
            count += 1
            cumulativeScoresByTeam[teamId][round.id] = totalMAPE / count
          }
        })
      })

      const filteredAggregates = aggregates
        .filter((a) => a.team.status === 'ACTIVE' || a.team.status === 'APPROVED')
        .filter((a) => !universityIdParam || a.team.universityId === universityIdParam)
        .sort((a, b) => {
          if (a.mape !== b.mape) return a.mape - b.mape
          if (a.nErrors !== b.nErrors) return b.nErrors - a.nErrors
          return a.team.name.localeCompare(b.team.name)
        })

      if (isStudent && visibleRoundIds.length > 0) {
        const publishedEntries = roundIdParam
          ? filteredAggregates.map((aggregate) => ({
              teamId: aggregate.teamId,
              team: aggregate.team,
              mape: aggregate.mape,
              nErrors: aggregate.nErrors,
            }))
          : buildPublishedMetricEntries(aggregates, roundAggregates, visibleRoundIdSet, universityIdParam)

        leaderboard = publishedEntries.map((entry, index) => ({
          rank: index + 1,
          teamId: entry.teamId,
          teamName: entry.team.name,
          teamDisplayId: entry.team.displayId,
          university: entry.team.university.name,
          universityId: entry.team.universityId,
          mape: entry.mape,
          nErrors: entry.nErrors,
          roundScores: roundScoresByTeam[entry.teamId] || {},
          cumulativeScores: cumulativeScoresByTeam[entry.teamId] || {},
        }))
      } else {
        leaderboard = filteredAggregates.map((a, index) => ({
          rank: index + 1,
          teamId: a.teamId,
          teamName: a.team.name,
          teamDisplayId: a.team.displayId,
          university: a.team.university.name,
          universityId: a.team.universityId,
          mape: canSeeAllDetails ? a.mape : null,
          nErrors: canSeeAllDetails ? a.nErrors : null,
          roundScores: canSeeAllDetails ? roundScoresByTeam[a.teamId] || {} : {},
          cumulativeScores: canSeeAllDetails ? cumulativeScoresByTeam[a.teamId] || {} : {},
        }))
      }
    }

    const expectedErrors = roundIdParam
      ? await getExpectedRoundErrors(roundIdParam)
      : 78

    // Entries arrive already sorted ascending by real MAPE. Collapse ties (competition ranking)
    // only when the score is visible; when MAPE is masked to null (non-admin viewers), every
    // `null === null` comparison would match the first row and make every rank #1 — fall back to
    // the sorted position instead.
    leaderboard = leaderboard.map((entry, index, entries) => ({
      ...entry,
      rank: entry.mape === null
        ? index + 1
        : entries.findIndex((candidate) => candidate.mape === entry.mape) + 1,
    }))
    const myEntry = leaderboard.find((entry) => entry.teamId === myTeamId)
    let myPosition: { rank: number; percentile: number; gapToNext: number | null; rankMovement: number | null } | null = null
    if (myEntry && myEntry.mape !== null) {
      const above = [...leaderboard].reverse().find((entry) => entry.rank < myEntry.rank && entry.mape !== null)
      const progressionRoundIds = rounds.map((round) => round.id).filter((id) => myEntry.cumulativeScores[id] !== undefined)
      let rankMovement: number | null = null
      if (progressionRoundIds.length >= 2) {
        const previousRoundId = progressionRoundIds.at(-2)!
        const previous = competitionRanks(leaderboard.filter((entry) => entry.cumulativeScores[previousRoundId] !== undefined).map((entry) => ({ teamId: entry.teamId, score: entryScore(entry, previousRoundId) })))
        const previousRank = previous.find((entry) => entry.teamId === myTeamId)?.rank
        if (previousRank) rankMovement = previousRank - myEntry.rank
      }
      myPosition = {
        rank: myEntry.rank,
        percentile: leaderboard.length <= 1 ? 100 : Math.round((leaderboard.filter((entry) => (entry.mape ?? Infinity) > myEntry.mape!).length / (leaderboard.length - 1)) * 100),
        gapToNext: above?.mape == null ? null : myEntry.mape - above.mape,
        rankMovement,
      }
    }

    return NextResponse.json({
      leaderboard,
      seasonName: operationalSeason.name,
      myTeamId,
      metric,
      expectedErrors,
      rounds: rounds.map((r) => ({ id: r.id, number: r.number, isFinal: r.isFinal, status: r.status })),
      myPosition,
      nextUnpublishedRound,
    })
  } catch (error) {
    logger.error('Get leaderboard error:', error)
    return jsonError(error, 'Failed to get leaderboard')
  }
}

function entryScore(entry: { cumulativeScores: Record<string, number> }, roundId: string) {
  return entry.cumulativeScores[roundId] ?? Number.POSITIVE_INFINITY
}

async function getExpectedRoundErrors(roundId: string): Promise<number> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      season: {
        include: {
          markets: { where: { isActive: true } },
        },
      },
    },
  })

  if (!round) return 0

  const marketCount = round.season.markets.length
  const weekOffsets = round.isFinal ? 1 : 2
  return marketCount * 2 * weekOffsets
}
