import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { canPerformAdminAction } from '@/lib/permissions'
import { z } from 'zod'

const createSeasonSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
})

export async function GET() {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
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
        _count: {
          select: {
            teams: true,
          },
        },
      },
      orderBy: { endDate: 'desc' },
      take: 10,
    })

    return NextResponse.json({ season, completedSeasons })
  } catch (error) {
    console.error('Get season error:', error)
    return NextResponse.json({ message: 'Failed to get season' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    const canCreate = await canPerformAdminAction(user, 'season:write')
    if (!canCreate) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = createSeasonSchema.parse(body)

    const [startYear, startMonth, startDay] = data.startDate.split('-').map(Number)
    const [endYear, endMonth, endDay] = data.endDate.split('-').map(Number)
    const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0)
    const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59)

    if (endDate <= startDate) {
      return NextResponse.json({ message: 'End date must be after start date' }, { status: 400 })
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

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const daysPerRound = Math.floor(totalDays / 7)
    
    for (let i = 1; i <= 7; i++) {
      const roundStartDay = new Date(startDate)
      roundStartDay.setDate(startDate.getDate() + (i - 1) * daysPerRound)
      roundStartDay.setHours(0, 0, 0, 0)
      
      const roundEndDay = new Date(startDate)
      roundEndDay.setDate(startDate.getDate() + i * daysPerRound - 1)
      roundEndDay.setHours(23, 59, 59, 999)

      await prisma.round.create({
        data: {
          seasonId: season.id,
          number: i,
          opensAt: roundStartDay,
          closesAt: roundEndDay,
          isFinal: i === 7,
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

    return NextResponse.json({ season: fullSeason }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input' }, { status: 400 })
    }
    console.error('Create season error:', error)
    return NextResponse.json({ message: 'Failed to create season' }, { status: 500 })
  }
}
