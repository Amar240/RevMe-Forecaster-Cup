import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { logger } from '@/server/logger'
import { requireUserOrResponse, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'


export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const authUser = user!

    const activeSeason = await prisma.season.findFirst({
      where: { status: { in: ['ACTIVE', 'PAUSED'] } },
      include: {
        rounds: { orderBy: { number: 'asc' } },
        markets: {
          where: { isActive: true },
          include: { market: true },
        },
      },
      orderBy: { createdAt: 'desc' },
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
      where: { userId: authUser.id, isSubmitter: true },
      include: { team: true },
    })

    const canSubmit =
      !!teamMember &&
      teamMember.team.status === 'ACTIVE' &&
      teamMember.isSubmitter

    let existingSubmissions: { marketId: string; weekOffset: number; occupancy: number; adr: number }[] = []
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
          const [marketId, weekOffset] = key.split('-')
          return {
            marketId,
            weekOffset: parseInt(weekOffset),
            occupancy: values.occupancy || 0,
            adr: values.adr || 0,
          }
        })
      }
    }

    return NextResponse.json({
      currentRound,
      markets: activeSeason.markets.map((sm) => sm.market),
      existingSubmissions,
      canSubmit: canSubmit && canSubmitStatus,
      seasonStatus: activeSeason.status,
      lockReason,
    })
  } catch (error) {
    logger.error('Get current submissions error:', error)
    return jsonError(error, 'Failed to get current round')
  }
}

