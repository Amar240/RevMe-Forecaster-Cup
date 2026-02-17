import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const seasonId = searchParams.get('seasonId')
    const marketId = searchParams.get('marketId')

    if (!seasonId) {
      const activeSeason = await prisma.season.findFirst({
        where: { status: { in: ['ACTIVE', 'PAUSED'] } },
        orderBy: { createdAt: 'desc' },
      })
      if (!activeSeason) {
        return NextResponse.json({ message: 'No active season' }, { status: 404 })
      }

      const markets = await prisma.seasonMarket.findMany({
        where: { seasonId: activeSeason.id, isActive: true },
        include: { market: true },
      })

      const marketInfos = await prisma.marketInfo.findMany({
        where: { seasonId: activeSeason.id },
        include: {
          resourceLinks: { orderBy: { order: 'asc' } },
          updatedBy: { select: { firstName: true, lastName: true } },
        },
      })

      const roundUpdates = await prisma.marketRoundUpdate.findMany({
        where: { seasonId: activeSeason.id },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: { roundNumber: 'desc' },
      })

      return NextResponse.json({
        season: activeSeason,
        markets: markets.map((m) => m.market),
        marketInfos,
        roundUpdates,
      })
    }

    if (marketId) {
      const marketInfo = await prisma.marketInfo.findUnique({
        where: { seasonId_marketId: { seasonId, marketId } },
        include: {
          resourceLinks: { orderBy: { order: 'asc' } },
          updatedBy: { select: { firstName: true, lastName: true } },
        },
      })

      const roundUpdates = await prisma.marketRoundUpdate.findMany({
        where: { seasonId, marketId },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: { roundNumber: 'desc' },
      })

      return NextResponse.json({ marketInfo, roundUpdates })
    }

    return NextResponse.json({ message: 'marketId is required' }, { status: 400 })
  } catch (error) {
    console.error('Get market info error:', error)
    return NextResponse.json({ message: 'Failed to get market info' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { seasonId, marketId, title, summary, description, demandDrivers, supplyNotes, risks, strategyHints } = body

    if (!seasonId || !marketId) {
      return NextResponse.json({ message: 'seasonId and marketId are required' }, { status: 400 })
    }

    const marketInfo = await prisma.marketInfo.upsert({
      where: { seasonId_marketId: { seasonId, marketId } },
      create: {
        seasonId,
        marketId,
        title,
        summary,
        description,
        demandDrivers: demandDrivers || [],
        supplyNotes: supplyNotes || [],
        risks: risks || [],
        strategyHints: strategyHints || [],
        createdById: user.id,
        updatedById: user.id,
      },
      update: {
        title,
        summary,
        description,
        demandDrivers: demandDrivers || [],
        supplyNotes: supplyNotes || [],
        risks: risks || [],
        strategyHints: strategyHints || [],
        updatedById: user.id,
      },
      include: { resourceLinks: true },
    })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'UPDATE_MARKET_INFO',
        entityType: 'MarketInfo',
        entityId: marketInfo.id,
        details: { marketId, seasonId, title },
      },
    })

    return NextResponse.json({ marketInfo })
  } catch (error) {
    console.error('Save market info error:', error)
    return NextResponse.json({ message: 'Failed to save market info' }, { status: 500 })
  }
}
