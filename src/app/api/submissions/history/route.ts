import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { logger } from '@/server/logger'
import { requireUserOrResponse, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'

export const dynamic = 'force-dynamic'


export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const authUser = user!

    const operationalSeason = await getCurrentOperationalSeason()
    if (!operationalSeason) {
      return NextResponse.json({ submissions: [] })
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: { userId: authUser.id, team: { seasonId: operationalSeason.id } },
    })

    if (!teamMember) {
      return NextResponse.json({ submissions: [] })
    }

    const submissions = await prisma.submission.findMany({
      where: {
        teamId: teamMember.teamId,
        round: { seasonId: operationalSeason.id },
      },
      include: {
        round: true,
        values: {
          include: { market: true },
        },
      },
      orderBy: { round: { number: 'desc' } },
    })

    const errors = await prisma.predictionError.findMany({
      where: { teamId: teamMember.teamId, seasonId: operationalSeason.id },
    })

    const errorMap = new Map<string, { absError: number; apeError: number | null }>()
    errors.forEach((e) => {
      const key = `${e.roundId}-${e.marketId}-${e.metric}-${e.weekOffset}`
      errorMap.set(key, { absError: e.absError, apeError: e.apeError })
    })

    const flatSubmissions = submissions.flatMap((sub) => {
      const valuesByKey = new Map<string, { occupancy?: number; adr?: number; marketId: string; marketName: string; weekOffset: number }>()

      sub.values.forEach((v) => {
        const key = `${v.marketId}-${v.weekOffset}`
        const existing = valuesByKey.get(key) || { marketId: v.marketId, marketName: v.market.name, weekOffset: v.weekOffset }
        if (v.metric === 'OCCUPANCY') {
          existing.occupancy = v.value
        } else {
          existing.adr = v.value
        }
        valuesByKey.set(key, existing)
      })

      return Array.from(valuesByKey.values()).map((v) => {
        const occErrorKey = `${sub.roundId}-${v.marketId}-OCCUPANCY-${v.weekOffset}`
        const adrErrorKey = `${sub.roundId}-${v.marketId}-ADR-${v.weekOffset}`
        const occError = errorMap.get(occErrorKey)
        const adrError = errorMap.get(adrErrorKey)

        return {
          id: `${sub.id}-${v.marketId}-${v.weekOffset}`,
          occupancy: v.occupancy || 0,
          adr: v.adr || 0,
          weekOffset: v.weekOffset,
          submittedAt: sub.submittedAt.toISOString(),
          round: { number: sub.round.number },
          market: { name: v.marketName },
          score: occError || adrError ? {
            occupancyAE: occError?.absError || 0,
            adrAE: adrError?.absError || 0,
            occupancyAPE: occError?.apeError ?? null,
            adrAPE: adrError?.apeError ?? null,
          } : null,
        }
      })
    })

    flatSubmissions.sort((a, b) => {
      if (b.round.number !== a.round.number) return b.round.number - a.round.number
      if (a.market.name !== b.market.name) return a.market.name.localeCompare(b.market.name)
      return a.weekOffset - b.weekOffset
    })

    return NextResponse.json({ submissions: flatSubmissions })
  } catch (error) {
    logger.error('Get submission history error:', error)
    return jsonError(error, 'Failed to get submissions')
  }
}
