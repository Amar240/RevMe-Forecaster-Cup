import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSeasonSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  totalRounds: z.number().int().min(1).max(20).default(7),
  daysPerRound: z.number().int().min(1).max(30).optional(),
  marketIds: z.array(z.string()).min(1).max(10).optional(),
})

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const season = await prisma.season.findFirst({
      where: { status: { in: ['DRAFT', 'ACTIVE', 'PAUSED'] } },
      include: {
        rounds: { orderBy: { number: 'asc' } },
        markets: { include: { market: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const completedSeasons = await prisma.season.findMany({
      where: { status: 'COMPLETED' },
      include: {
        rounds: { orderBy: { number: 'asc' } },
        markets: { include: { market: true } },
        _count: { select: { teams: true } },
      },
      orderBy: { endDate: 'desc' },
      take: 10,
    })

    return jsonOk({ season, completedSeasons })
  } catch (error) {
    return jsonError(error, 'Failed to get season')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse('season:write')
    if (response) return response

    const data = await parseJson(request, createSeasonSchema)

    const [startYear, startMonth, startDay] = data.startDate.split('-').map(Number)
    const [endYear, endMonth, endDay] = data.endDate.split('-').map(Number)
    const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0)
    const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59)

    if (endDate <= startDate) {
      return jsonOk({ message: 'End date must be after start date' }, 400)
    }

    let resolvedMarketIds: string[]

    if (data.marketIds && data.marketIds.length > 0) {
      const existing = await prisma.market.findMany({ where: { id: { in: data.marketIds } } })
      if (existing.length !== data.marketIds.length) {
        return jsonOk({ message: 'One or more market IDs are invalid' }, 400)
      }
      resolvedMarketIds = data.marketIds
    } else {
      const defaultNames = ['Nashville CBD', 'Dubai', 'Hamburg']
      const markets = await Promise.all(
        defaultNames.map(async (name) => {
          let market = await prisma.market.findUnique({ where: { name } })
          if (!market) market = await prisma.market.create({ data: { name } })
          return market
        })
      )
      resolvedMarketIds = markets.map((m) => m.id)
    }

    const season = await prisma.season.create({
      data: { name: data.name, startDate, endDate, status: 'DRAFT', registrationOpen: true },
    })

    await prisma.seasonMarket.createMany({
      data: resolvedMarketIds.map((marketId) => ({
        seasonId: season.id,
        marketId,
        isActive: true,
      })),
    })

    const totalRounds = data.totalRounds ?? 7
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const daysPerRound = data.daysPerRound ?? Math.floor(totalDays / totalRounds)

    for (let i = 1; i <= totalRounds; i++) {
      const roundStartDay = new Date(startDate)
      roundStartDay.setDate(startDate.getDate() + (i - 1) * daysPerRound)
      roundStartDay.setHours(0, 0, 0, 0)
      const roundEndDay = new Date(startDate)
      roundEndDay.setDate(startDate.getDate() + i * daysPerRound - 1)
      roundEndDay.setHours(23, 59, 59, 999)

      await prisma.round.create({
        data: { seasonId: season.id, number: i, opensAt: roundStartDay, closesAt: roundEndDay, isFinal: i === totalRounds },
      })
    }

    const fullSeason = await prisma.season.findUnique({
      where: { id: season.id },
      include: { rounds: { orderBy: { number: 'asc' } }, markets: { include: { market: true } } },
    })

    return jsonOk({ season: fullSeason }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to create season')
  }
}
