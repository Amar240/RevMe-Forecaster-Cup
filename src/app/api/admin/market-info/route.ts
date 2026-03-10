import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { searchParams } = new URL(request.url)
    const seasonId = searchParams.get('seasonId')
    const marketId = searchParams.get('marketId')

    if (!seasonId) {
      const activeSeason = await prisma.season.findFirst({
        where: { status: { in: ['ACTIVE', 'PAUSED'] } }, orderBy: { createdAt: 'desc' },
      })
      if (!activeSeason) throw new ApiError('No active season', 404, 'NOT_FOUND')

      const markets = await prisma.seasonMarket.findMany({
        where: { seasonId: activeSeason.id, isActive: true }, include: { market: true },
      })
      const marketInfos = await prisma.marketInfo.findMany({
        where: { seasonId: activeSeason.id },
        include: { resourceLinks: { orderBy: { order: 'asc' } }, updatedBy: { select: { firstName: true, lastName: true } } },
      })
      const roundUpdates = await prisma.marketRoundUpdate.findMany({
        where: { seasonId: activeSeason.id },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: { roundNumber: 'desc' },
      })

      return jsonOk({ season: activeSeason, markets: markets.map((m) => m.market), marketInfos, roundUpdates })
    }

    if (marketId) {
      const marketInfo = await prisma.marketInfo.findUnique({
        where: { seasonId_marketId: { seasonId, marketId } },
        include: { resourceLinks: { orderBy: { order: 'asc' } }, updatedBy: { select: { firstName: true, lastName: true } } },
      })
      const roundUpdates = await prisma.marketRoundUpdate.findMany({
        where: { seasonId, marketId },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: { roundNumber: 'desc' },
      })
      return jsonOk({ marketInfo, roundUpdates })
    }

    throw new ApiError('marketId is required', 400, 'INVALID_INPUT')
  } catch (error) {
    return jsonError(error, 'Failed to get market info')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const body = await request.json()
    const { seasonId, marketId, title, summary, description, demandDrivers, supplyNotes, risks, strategyHints } = body

    if (!seasonId || !marketId) throw new ApiError('seasonId and marketId are required', 400, 'INVALID_INPUT')

    const marketInfo = await prisma.marketInfo.upsert({
      where: { seasonId_marketId: { seasonId, marketId } },
      create: { seasonId, marketId, title, summary, description, demandDrivers: demandDrivers || [], supplyNotes: supplyNotes || [], risks: risks || [], strategyHints: strategyHints || [], createdById: user!.id, updatedById: user!.id },
      update: { title, summary, description, demandDrivers: demandDrivers || [], supplyNotes: supplyNotes || [], risks: risks || [], strategyHints: strategyHints || [], updatedById: user!.id },
      include: { resourceLinks: true },
    })

    await prisma.auditLog.create({
      data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'UPDATE_MARKET_INFO', entityType: 'MarketInfo', entityId: marketInfo.id, details: { marketId, seasonId, title } },
    })

    return jsonOk({ marketInfo })
  } catch (error) {
    return jsonError(error, 'Failed to save market info')
  }
}
