import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdminOrResponse('actuals:upload')
    if (response) return response

    const { searchParams } = new URL(request.url)
    const includeVoided = searchParams.get('includeVoided') === 'true'

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    })

    if (!activeSeason) {
      return jsonOk({ actuals: [] })
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

    return jsonOk({
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
    return jsonError(error, 'Failed to get actuals summary')
  }
}
