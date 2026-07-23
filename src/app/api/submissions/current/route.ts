import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { logger } from '@/server/logger'
import { requireUserOrResponse, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { getSeasonScopedTeamMemberWhere } from '@/server/team-membership'

export const dynamic = 'force-dynamic'


export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const authUser = user!

    const activeSeason = await getCurrentOperationalSeason({
      include: {
        rounds: { orderBy: { number: 'asc' } },
        markets: {
          where: { isActive: true },
          include: { market: true },
        },
      },
    })

    if (!activeSeason) {
      return NextResponse.json({
        currentRound: null,
        markets: [],
        existingSubmissions: [],
        canSubmit: false,
        seasonStatus: null,
        lockReason: null,
      })
    }

    const activeMarkets = activeSeason.markets.map((sm) => sm.market)
    if (activeMarkets.length !== 3) {
      return NextResponse.json({
        currentRound: null,
        markets: activeMarkets,
        existingSubmissions: [],
        canSubmit: false,
        seasonStatus: activeSeason.status,
        lockReason: 'INVALID_MARKETS',
      })
    }

    const now = new Date()

    let currentRound = activeSeason.rounds.find((r) => r.status === 'OPEN')

    if (!currentRound) {
      currentRound = activeSeason.rounds.find((r) => r.status === 'PAUSED')
    }

    if (!currentRound) {
      currentRound = activeSeason.rounds.find((r) => r.status === 'UPCOMING')
    }

    let lockReason: string | null = null
    let canSubmitStatus = true

    if (activeSeason.status !== 'ACTIVE') {
      lockReason = 'SEASON_NOT_ACTIVE'
      canSubmitStatus = false
    } else if (currentRound) {
      if (currentRound.status === 'UPCOMING') {
        lockReason = 'ROUND_NOT_OPEN'
        canSubmitStatus = false
      } else if (currentRound.status === 'PAUSED') {
        lockReason = 'ROUND_PAUSED'
        canSubmitStatus = false
      } else if (currentRound.status === 'CLOSED') {
        lockReason = 'ROUND_CLOSED'
        canSubmitStatus = false
      } else if (new Date(currentRound.closesAt) < now) {
        lockReason = 'DEADLINE_PASSED'
        canSubmitStatus = false
      }
    }

    if (!currentRound) {
      return NextResponse.json({
        currentRound: null,
        markets: activeSeason.markets.map((sm) => sm.market),
        existingSubmissions: [],
        canSubmit: false,
        seasonStatus: activeSeason.status,
        lockReason: 'NO_ACTIVE_ROUND',
      })
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: getSeasonScopedTeamMemberWhere({
        userId: authUser.id,
        seasonId: activeSeason.id,
        isSubmitter: true,
      }),
      include: { team: true },
    })

    const canSubmit =
      !!teamMember &&
      teamMember.team.status === 'ACTIVE' &&
      teamMember.isSubmitter

    let existingSubmissions: { marketId: string; weekOffset: number; occupancy: number; adr: number }[] = []
    const evidenceByMarket: Record<string, unknown> = {}
    if (teamMember) {
      const submission = await prisma.submission.findUnique({
        where: {
          teamId_roundId: {
            teamId: teamMember.teamId,
            roundId: currentRound.id,
          },
        },
        include: { values: true },
      })

      if (submission) {
        const valuesByKey = new Map<string, { occupancy?: number; adr?: number }>()

        submission.values.forEach((v) => {
          const key = `${v.marketId}-${v.weekOffset}`
          const existing = valuesByKey.get(key) || {}
          if (v.metric === 'OCCUPANCY') {
            existing.occupancy = v.value
          } else {
            existing.adr = v.value
          }
          valuesByKey.set(key, existing)
        })

        existingSubmissions = Array.from(valuesByKey.entries()).map(([key, values]) => {
          const lastDash = key.lastIndexOf('-')
          const marketId = key.slice(0, lastDash)
          const weekOffset = key.slice(lastDash + 1)
          return {
            marketId,
            weekOffset: parseInt(weekOffset),
            occupancy: values.occupancy || 0,
            adr: values.adr || 0,
          }
        })
      }

      const publishedRoundIds = activeSeason.rounds.filter((round) => round.leaderboardVisible && round.number < currentRound!.number).map((round) => round.id)
      const [actuals, latestErrors, marketInfos, roundUpdates] = await Promise.all([
        prisma.actual.findMany({ where: { seasonId: activeSeason.id, roundId: { in: publishedRoundIds }, isVoided: false }, include: { round: { select: { number: true } } }, orderBy: [{ round: { number: 'desc' } }], take: 72 }),
        prisma.predictionError.findMany({ where: { seasonId: activeSeason.id, teamId: teamMember.teamId, roundId: { in: publishedRoundIds } }, include: { round: { select: { number: true } } }, orderBy: { round: { number: 'desc' } } }),
        prisma.marketInfo.findMany({ where: { seasonId: activeSeason.id }, select: { marketId: true, summary: true, quickInsights: true, resourceLinks: { select: { id: true, label: true, url: true, type: true, note: true }, orderBy: { order: 'asc' }, take: 5 } } }),
        prisma.marketRoundUpdate.findMany({ where: { seasonId: activeSeason.id, roundNumber: currentRound.number }, select: { marketId: true, headline: true, whatChanged: true } }),
      ])
      for (const market of activeMarkets) {
        const marketActuals = actuals.filter((actual) => actual.marketId === market.id).slice(0, 12).map((actual) => ({ metric: actual.metric, weekOffset: actual.weekOffset, value: actual.value, roundNumber: actual.round.number }))
        const average = (metric: 'OCCUPANCY' | 'ADR') => { const values = marketActuals.filter((item) => item.metric === metric).slice(0, 6).map((item) => item.value); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null }
        const latest = latestErrors.find((error) => error.marketId === market.id)
        evidenceByMarket[market.id] = {
          actuals: marketActuals,
          lastActual: {
            occupancy: marketActuals.find((item) => item.metric === 'OCCUPANCY')?.value ?? null,
            adr: marketActuals.find((item) => item.metric === 'ADR')?.value ?? null,
          },
          trailingAverage: { occupancy: average('OCCUPANCY'), adr: average('ADR') },
          latestError: latest ? { metric: latest.metric, direction: latest.predictedValue > latest.actualValue ? 'OVER' : latest.predictedValue < latest.actualValue ? 'UNDER' : 'EXACT', apeError: latest.apeError, roundNumber: latest.round.number } : null,
          marketInfo: marketInfos.find((item) => item.marketId === market.id) || null,
          roundUpdate: roundUpdates.find((item) => item.marketId === market.id) || null,
        }
      }
    }

    return NextResponse.json({
      currentRound,
      markets: activeSeason.markets.map((sm) => sm.market),
      existingSubmissions,
      canSubmit: canSubmit && canSubmitStatus,
      seasonStatus: activeSeason.status,
      lockReason,
      context: teamMember ? { userId: authUser.id, teamId: teamMember.teamId, seasonId: activeSeason.id } : undefined,
      evidenceByMarket,
    })
  } catch (error) {
    logger.error('Get current submissions error:', error)
    return jsonError(error, 'Failed to get current round')
  }
}
