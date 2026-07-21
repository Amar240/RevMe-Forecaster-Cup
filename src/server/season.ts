import { prisma } from '@/server/db'
import { canPerformAdminAction } from '@/server/permissions'
import { ApiError } from '@/server/http'
import type { Prisma, User } from '@prisma/client'
import type { CreateSeasonInput } from '@/features/season/schema'
import { deriveHomepageHeroStatusLabel, HOMEPAGE_DEFAULT_HERO_STATUS_LABEL } from '@/lib/homepage-season-status'
import { fromZonedTime } from 'date-fns-tz'

const TOTAL_ROUNDS = 7
const DAYS_PER_ROUND = 7
const COMPETITION_TIME_ZONE = 'America/New_York'

function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

export function getSeasonDateBoundaries(startDateInput: string) {
  const startDate = fromZonedTime(`${startDateInput} 00:00:00.000`, COMPETITION_TIME_ZONE)
  const endDateInput = addCalendarDays(startDateInput, TOTAL_ROUNDS * DAYS_PER_ROUND - 1)
  const endDate = fromZonedTime(`${endDateInput} 23:59:59.999`, COMPETITION_TIME_ZONE)
  const rounds = Array.from({ length: TOTAL_ROUNDS }, (_, index) => {
    const opensOn = addCalendarDays(startDateInput, index * DAYS_PER_ROUND)
    const closesOn = addCalendarDays(startDateInput, (index + 1) * DAYS_PER_ROUND - 1)
    return {
      number: index + 1,
      opensAt: fromZonedTime(`${opensOn} 00:00:00.000`, COMPETITION_TIME_ZONE),
      closesAt: fromZonedTime(`${closesOn} 23:59:59.999`, COMPETITION_TIME_ZONE),
    }
  })
  return { startDate, endDate, rounds }
}

type CurrentOperationalSeasonArgs = Omit<Prisma.SeasonFindFirstArgs, 'where' | 'orderBy'>

export async function getCurrentOperationalSeason<T extends CurrentOperationalSeasonArgs>(
  args?: Prisma.SelectSubset<T, CurrentOperationalSeasonArgs>
): Promise<Prisma.SeasonGetPayload<T> | null> {
  const baseArgs = (args ?? {}) as CurrentOperationalSeasonArgs

  const activeSeason = await prisma.season.findFirst({
    ...baseArgs,
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })

  if (activeSeason) {
    return activeSeason as Prisma.SeasonGetPayload<T>
  }

  const pausedSeason = await prisma.season.findFirst({
    ...baseArgs,
    where: { status: 'PAUSED' },
    orderBy: { createdAt: 'desc' },
  })

  return pausedSeason as Prisma.SeasonGetPayload<T> | null
}

export async function getHomepageHeroStatusLabel() {
  try {
    const operationalSeason = await getCurrentOperationalSeason({
      select: {
        status: true,
        rounds: {
          select: {
            number: true,
            status: true,
            opensAt: true,
            closesAt: true,
          },
          orderBy: { number: 'asc' },
        },
      },
    })

    if (operationalSeason) {
      return deriveHomepageHeroStatusLabel(operationalSeason)
    }

    const upcomingSeason = await prisma.season.findFirst({
      where: { status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
      select: {
        status: true,
        rounds: {
          select: {
            number: true,
            status: true,
            opensAt: true,
            closesAt: true,
          },
          orderBy: { number: 'asc' },
        },
      },
    })

    if (upcomingSeason) {
      return deriveHomepageHeroStatusLabel(upcomingSeason)
    }

    const completedSeason = await prisma.season.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { endDate: 'desc' },
      select: {
        status: true,
        rounds: {
          select: {
            number: true,
            status: true,
            opensAt: true,
            closesAt: true,
          },
          orderBy: { number: 'asc' },
        },
      },
    })

    return deriveHomepageHeroStatusLabel(completedSeason)
  } catch {
    return HOMEPAGE_DEFAULT_HERO_STATUS_LABEL
  }
}

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

  const { startDate, endDate, rounds } = getSeasonDateBoundaries(data.startDate)

  if (endDate <= startDate) {
    throw new ApiError('End date must be after start date', 400, 'INVALID_INPUT')
  }

  const existingMarkets = await prisma.market.findMany({
    where: {
      id: { in: data.marketIds },
    },
  })

  if (existingMarkets.length !== data.marketIds.length) {
    throw new ApiError('One or more market IDs are invalid', 400, 'INVALID_INPUT')
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
    data: data.marketIds.map((marketId) => ({
      seasonId: season.id,
      marketId,
      isActive: true,
    })),
  })

  for (const round of rounds) {
    await prisma.round.create({
      data: {
        seasonId: season.id,
        number: round.number,
        opensAt: round.opensAt,
        closesAt: round.closesAt,
        isFinal: round.number === TOTAL_ROUNDS,
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
