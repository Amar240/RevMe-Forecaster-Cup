import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')

    const activeSeason = await prisma.season.findFirst({
      where: { status: { in: ['ACTIVE', 'PAUSED'] } },
      include: {
        rounds: { orderBy: { number: 'asc' } },
        markets: { where: { isActive: true }, include: { market: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!activeSeason) {
      return jsonOk({ marketInfos: [], season: null, userRole: user!.role, markets: [] })
    }

    const currentRound = activeSeason.rounds.find((r) => r.status === 'OPEN') ||
      activeSeason.rounds.find((r) => r.status === 'PAUSED') ||
      activeSeason.rounds.find((r) => r.status === 'UPCOMING')

    if (marketId) {
      const marketInfo = await prisma.marketInfo.findUnique({
        where: { seasonId_marketId: { seasonId: activeSeason.id, marketId } },
        include: { resourceLinks: { orderBy: { order: 'asc' } }, market: true },
      })

      const roundUpdates = await prisma.marketRoundUpdate.findMany({
        where: { seasonId: activeSeason.id, marketId },
        orderBy: { roundNumber: 'desc' },
      })

      const currentRoundUpdate = currentRound
        ? roundUpdates.find((u) => u.roundNumber === currentRound.number)
        : null

      return jsonOk({
        season: { id: activeSeason.id, name: activeSeason.name },
        currentRound: currentRound ? { number: currentRound.number } : null,
        marketInfo, currentRoundUpdate, roundUpdates, userRole: user!.role,
      })
    }

    const markets = activeSeason.markets.map((m) => m.market)
    const marketInfos = await prisma.marketInfo.findMany({
      where: { seasonId: activeSeason.id },
      include: { resourceLinks: { orderBy: { order: 'asc' }, take: 3 }, market: true },
    })

    const roundUpdates = currentRound
      ? await prisma.marketRoundUpdate.findMany({
          where: { seasonId: activeSeason.id, roundNumber: currentRound.number },
        })
      : []

    return jsonOk({
      season: { id: activeSeason.id, name: activeSeason.name },
      currentRound: currentRound ? { number: currentRound.number } : null,
      markets, marketInfos, currentRoundUpdates: roundUpdates, userRole: user!.role,
    })
  } catch (error) {
    return jsonError(error, 'Failed to get market info')
  }
}
