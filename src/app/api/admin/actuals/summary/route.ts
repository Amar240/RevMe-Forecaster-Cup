import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { canPerformAdminAction } from '@/server/permissions'
import { logger } from '@/server/logger'
import { getSession } from '@/server/auth'
import { jsonError } from '@/server/http'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    const canUpload = await canPerformAdminAction(user, 'actuals:upload')

    if (!user || !canUpload) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const includeVoided = searchParams.get('includeVoided') === 'true'

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    })

    if (!activeSeason) {
      return NextResponse.json({ actuals: [] })
    }

    interface WhereClause {
      seasonId: string
      isVoided?: boolean
    }

    const where: WhereClause = { seasonId: activeSeason.id }
    if (!includeVoided) where.isVoided = false

    const actuals = await prisma.actual.findMany({
      where,
      include: { market: true, round: true },
      orderBy: [{ roundId: 'asc' }, { marketId: 'asc' }, { metric: 'asc' }, { weekOffset: 'asc' }],
    })

    return NextResponse.json({
      actuals: actuals.map((a) => ({
        id: a.id,
        roundId: a.roundId,
        roundNumber: a.round.number,
        marketId: a.marketId,
        marketName: a.market.name,
        metric: a.metric,
        weekOffset: a.weekOffset,
        value: a.value,
        source: a.source,
        isVoided: a.isVoided,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        createdBy: null,
        updatedBy: null,
      })),
    })
  } catch (error) {
    logger.error('Get actuals summary error:', error)
    return jsonError(error, 'Failed to get actuals summary')
  }
}
