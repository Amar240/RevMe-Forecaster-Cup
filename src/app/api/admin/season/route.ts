import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { z, ZodError } from 'zod'
import { processRoundTransitions } from '@/lib/round-scheduler'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const createSeasonSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  totalRounds: z.number().int().min(1).max(20).default(7),
  daysPerRound: z.number().int().min(1).max(30).optional(),
  marketIds: z.array(z.string()).min(1).max(10),
})

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    try {
      await processRoundTransitions({ trigger: 'RECOVERY', dueOnly: true })
    } catch (error) {
      logger.error('Round transition recovery failed while loading season administration', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

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

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      throw new ApiError('Invalid JSON', 400, 'INVALID_JSON')
    }

    const parsed = createSeasonSchema.safeParse(rawBody)
    if (!parsed.success) {
      const missingMarkets = parsed.error.issues.some(
        (issue) => issue.path[0] === 'marketIds' && issue.code === 'too_small'
      )

      if (missingMarkets) {
        return jsonOk({ message: 'Select at least one market for this season' }, 422)
      }

      throw parsed.error
    }

    const data = parsed.data

    const completedSeasons = await prisma.season.findMany({
      where: { status: 'COMPLETED' },
      select: {
        id: true,
        archives: {
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: { status: true },
        },
      },
    })

    const hasCompletedUnarchivedSeason = completedSeasons.some(
      (seasonItem) => seasonItem.archives[0]?.status !== 'COMPLETED'
    )

    if (hasCompletedUnarchivedSeason) {
      return jsonOk(
        { message: 'You must archive all completed seasons before creating a new one.' },
        422
      )
    }

    const [startYear, startMonth, startDay] = data.startDate.split('-').map(Number)
    const [endYear, endMonth, endDay] = data.endDate.split('-').map(Number)
    const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0)
    const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59)

    if (endDate <= startDate) {
      return jsonOk({ message: 'End date must be after start date' }, 400)
    }

    const existing = await prisma.market.findMany({ where: { id: { in: data.marketIds } } })
    if (existing.length !== data.marketIds.length) {
      return jsonOk({ message: 'One or more market IDs are invalid' }, 400)
    }
    const resolvedMarketIds = data.marketIds

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
    if (error instanceof ZodError) {
      return jsonError(error, 'Failed to create season')
    }
    return jsonError(error, 'Failed to create season')
  }
}
