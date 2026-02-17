import { prisma } from '@/server/db'
import { canPerformAdminAction } from '@/server/permissions'
import { ApiError } from '@/server/http'
import type { User } from '@prisma/client'
import type { CreateSeasonInput } from '@/features/season/schema'

const TOTAL_ROUNDS = 7
const DAYS_PER_ROUND = 7

export async function getSeasonOverview(user: User | null) {
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
    throw new ApiError('Forbidden', 403, 'FORBIDDEN')
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

  return { season, completedSeasons }
}

export async function createSeason(user: User | null, data: CreateSeasonInput) {
  const canCreate = await canPerformAdminAction(user, 'season:write')
  if (!canCreate) {
    throw new ApiError('Forbidden', 403, 'FORBIDDEN')
  }

  const [startYear, startMonth, startDay] = data.startDate.split('-').map(Number)
  const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0)

  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + (TOTAL_ROUNDS * DAYS_PER_ROUND) - 1)
  endDate.setHours(23, 59, 59, 999)

  if (endDate <= startDate) {
    throw new ApiError('End date must be after start date', 400, 'INVALID_INPUT')
  }

  let nashville = await prisma.market.findUnique({ where: { name: 'Nashville CBD' } })
  let dubai = await prisma.market.findUnique({ where: { name: 'Dubai' } })
  let hamburg = await prisma.market.findUnique({ where: { name: 'Hamburg' } })

  if (!nashville) {
    nashville = await prisma.market.create({ data: { name: 'Nashville CBD' } })
  }
  if (!dubai) {
    dubai = await prisma.market.create({ data: { name: 'Dubai' } })
  }
  if (!hamburg) {
    hamburg = await prisma.market.create({ data: { name: 'Hamburg' } })
  }

  const season = await prisma.season.create({
    data: {
      name: data.name,
      startDate,
      endDate,
      status: 'DRAFT',
      registrationOpen: true,
    },
  })

  await prisma.seasonMarket.createMany({
    data: [
      { seasonId: season.id, marketId: nashville.id, isActive: true },
      { seasonId: season.id, marketId: dubai.id, isActive: true },
      { seasonId: season.id, marketId: hamburg.id, isActive: true },
    ],
  })

  for (let i = 1; i <= TOTAL_ROUNDS; i++) {
    const roundStartDay = new Date(startDate)
    roundStartDay.setDate(startDate.getDate() + (i - 1) * DAYS_PER_ROUND)
    roundStartDay.setHours(0, 0, 0, 0)

    const roundEndDay = new Date(startDate)
    roundEndDay.setDate(startDate.getDate() + i * DAYS_PER_ROUND - 1)
    roundEndDay.setHours(23, 59, 59, 999)

    await prisma.round.create({
      data: {
        seasonId: season.id,
        number: i,
        opensAt: roundStartDay,
        closesAt: roundEndDay,
        isFinal: i === TOTAL_ROUNDS,
      },
    })
  }

  const fullSeason = await prisma.season.findUnique({
    where: { id: season.id },
    include: {
      rounds: { orderBy: { number: 'asc' } },
      markets: { include: { market: true } },
    },
  })

  return fullSeason
}
