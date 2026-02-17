import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { logAuditAction } from '@/server/audit'
import { logger } from '@/server/logger'
import { getSession } from '@/server/auth'
import { jsonError } from '@/server/http'

const VALID_ACTIONS = ['start', 'pause', 'resume', 'complete'] as const

type SeasonAction = (typeof VALID_ACTIONS)[number]

async function hasExactlyThreeActiveMarkets(seasonId: string) {
  const count = await prisma.seasonMarket.count({
    where: { seasonId, isActive: true },
  })
  return count === 3
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { action, seasonId } = body as { action?: SeasonAction; seasonId?: string }

    if (!action || !VALID_ACTIONS.includes(action)) {
      const season = await prisma.season.findFirst({
        where: { status: 'DRAFT' },
        orderBy: { createdAt: 'desc' },
      })

      if (!season) {
        return NextResponse.json({ message: 'No draft season found' }, { status: 404 })
      }

      const validMarkets = await hasExactlyThreeActiveMarkets(season.id)
      if (!validMarkets) {
        return NextResponse.json(
          { message: 'Season must have exactly 3 active markets before activation' },
          { status: 422 }
        )
      }

      await prisma.season.updateMany({
        where: { status: 'ACTIVE' },
        data: { status: 'COMPLETED' },
      })

      const updatedSeason = await prisma.season.update({
        where: { id: season.id },
        data: { status: 'ACTIVE' },
      })

      await logAuditAction(user.id, 'SEASON_START', 'Season', season.id, {
        seasonName: season.name,
        previousStatus: 'DRAFT',
        newStatus: 'ACTIVE',
      })

      return NextResponse.json({ message: 'Season activated', season: updatedSeason })
    }

    const season = seasonId
      ? await prisma.season.findUnique({ where: { id: seasonId } })
      : await prisma.season.findFirst({
          where: { status: { in: ['DRAFT', 'ACTIVE', 'PAUSED'] } },
          orderBy: { createdAt: 'desc' },
        })

    if (!season) {
      return NextResponse.json({ message: 'Season not found' }, { status: 404 })
    }

    const previousStatus = season.status
    let newStatus: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'

    switch (action) {
      case 'start':
        if (season.status !== 'DRAFT') {
          return NextResponse.json({ message: 'Can only start a DRAFT season' }, { status: 422 })
        }
        if (!(await hasExactlyThreeActiveMarkets(season.id))) {
          return NextResponse.json(
            { message: 'Season must have exactly 3 active markets before activation' },
            { status: 422 }
          )
        }
        await prisma.season.updateMany({
          where: { status: 'ACTIVE' },
          data: { status: 'COMPLETED' },
        })
        newStatus = 'ACTIVE'
        break
      case 'pause':
        if (season.status !== 'ACTIVE') {
          return NextResponse.json({ message: 'Can only pause an ACTIVE season' }, { status: 422 })
        }
        newStatus = 'PAUSED'
        break
      case 'resume':
        if (season.status !== 'PAUSED') {
          return NextResponse.json({ message: 'Can only resume a PAUSED season' }, { status: 422 })
        }
        if (!(await hasExactlyThreeActiveMarkets(season.id))) {
          return NextResponse.json(
            { message: 'Season must have exactly 3 active markets before activation' },
            { status: 422 }
          )
        }
        newStatus = 'ACTIVE'
        break
      case 'complete':
        if (season.status !== 'ACTIVE' && season.status !== 'PAUSED') {
          return NextResponse.json({ message: 'Can only complete an ACTIVE or PAUSED season' }, { status: 422 })
        }
        newStatus = 'COMPLETED'
        break
      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
    }

    const updatedSeason = await prisma.season.update({
      where: { id: season.id },
      data: { status: newStatus },
    })

    await logAuditAction(user.id, `SEASON_${action.toUpperCase()}`, 'Season', season.id, {
      seasonName: season.name,
      previousStatus,
      newStatus,
    })

    return NextResponse.json({
      message: `Season ${action}ed successfully`,
      season: updatedSeason,
    })
  } catch (error) {
    logger.error('Season lifecycle error:', error)
    return jsonError(error, 'Failed to update season')
  }
}
