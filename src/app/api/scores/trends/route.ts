import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { logger } from '@/server/logger'
import { requireUserOrResponse, jsonError } from '@/server/http'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const authUser = user!

    const teamMember = await prisma.teamMember.findFirst({
      where: { userId: authUser.id },
    })

    if (!teamMember) {
      return NextResponse.json({ trends: [] })
    }

    const aggregates = await prisma.scoreAggregate.findMany({
      where: {
        teamId: teamMember.teamId,
        scopeType: 'ROUND',
      },
      include: { round: true },
      orderBy: { round: { number: 'asc' } },
    })

    const roundData = new Map<number, { occupancy?: number; adr?: number }>()
    aggregates.forEach((agg) => {
      if (!agg.round) return
      const roundNum = agg.round.number
      const existing = roundData.get(roundNum) || {}
      if (agg.metric === 'OCCUPANCY') {
        existing.occupancy = agg.mape * 100
      } else {
        existing.adr = agg.mape * 100
      }
      roundData.set(roundNum, existing)
    })

    const trends = Array.from(roundData.entries())
      .sort(([a], [b]) => a - b)
      .map(([round, data]) => ({
        round: `R${round}`,
        occupancy: data.occupancy ?? 0,
        adr: data.adr ?? 0,
      }))

    return NextResponse.json({ trends })
  } catch (error) {
    logger.error('Get score trends error:', error)
    return jsonError(error, 'Failed to get trends')
  }
}

