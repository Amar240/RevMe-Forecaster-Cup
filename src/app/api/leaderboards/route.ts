import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { logger } from '@/server/logger'
import { getSession } from '@/server/auth'
import { jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const user = await getSession()

    const { searchParams } = new URL(request.url)
    const metricParam = searchParams.get('metric') || 'OCCUPANCY'
    const roundIdParam = searchParams.get('roundId')
    const universityIdParam = searchParams.get('universityId')

    const isCombined = metricParam === 'COMBINED'
    const metric = metricParam === 'ADR' ? 'ADR' : 'OCCUPANCY'

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    })

    if (!activeSeason) {
      return NextResponse.json({ leaderboard: [], seasonName: '', rounds: [] })
    }

    const rounds = await prisma.round.findMany({
      where: { seasonId: activeSeason.id },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, isFinal: true, status: true },
    })

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUB_ADMIN'
    const isSupervisor = user?.role === 'SUPERVISOR'
    const canSeeAllDetails = isAdmin || isSupervisor

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

    if (isCombined) {
      const allAggregates = await prisma.scoreAggregate.findMany({
        where: {
          seasonId: activeSeason.id,
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
    } else {
      const aggregates = await prisma.scoreAggregate.findMany({
        where: {
          seasonId: activeSeason.id,
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
          seasonId: activeSeason.id,
          metric,
          scopeType: 'ROUND',
        },
        select: {
          teamId: true,
          roundId: true,
          mape: true,
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

    let myTeamId = null
    if (user) {
      const teamMember = await prisma.teamMember.findFirst({
        where: { userId: user.id },
      })
      myTeamId = teamMember?.teamId || null
    }

    const expectedErrors = roundIdParam
      ? await getExpectedRoundErrors(roundIdParam)
      : 78

    return NextResponse.json({
      leaderboard,
      seasonName: activeSeason.name,
      myTeamId,
      metric,
      expectedErrors,
      rounds: rounds.map((r) => ({ id: r.id, number: r.number, isFinal: r.isFinal, status: r.status })),
    })
  } catch (error) {
    logger.error('Get leaderboard error:', error)
    return jsonError(error, 'Failed to get leaderboard')
  }
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
