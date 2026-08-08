import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { logAuditAction } from '@/server/audit'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { closeSeasonSupervisorAssignments } from '@/server/team-supervisor-assignment'

export const dynamic = 'force-dynamic'

const VALID_ACTIONS = ['start', 'pause', 'resume', 'complete'] as const

type SeasonAction = (typeof VALID_ACTIONS)[number]

async function hasExactlyThreeActiveMarkets(seasonId: string) {
  const count = await prisma.seasonMarket.count({
    where: { seasonId, isActive: true },
  })
  return count === 3
}

async function openRoundOneIfUpcoming(seasonId: string) {
  const round1 = await prisma.round.findFirst({
    where: { seasonId, number: 1 },
  })

  if (round1 && round1.status === 'UPCOMING') {
    await prisma.round.update({
      where: { id: round1.id },
      data: { status: 'OPEN' },
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const { action, seasonId } = body as { action?: SeasonAction; seasonId?: string }

    if (!action || !VALID_ACTIONS.includes(action)) {
      const season = await prisma.season.findFirst({
        where: { status: 'DRAFT' },
        orderBy: { createdAt: 'desc' },
      })

      if (!season) {
        return jsonOk({ message: 'No draft season found' }, 404)
      }

      const validMarkets = await hasExactlyThreeActiveMarkets(season.id)
      if (!validMarkets) {
        return jsonOk(
          { message: 'Season must have exactly 3 active markets before activation' },
          422
        )
      }

      const activeSeasons = await prisma.season.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })
      await prisma.$transaction(async (tx) => {
        await tx.season.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'COMPLETED' } })
        for (const active of activeSeasons) {
          await closeSeasonSupervisorAssignments({ seasonId: active.id, actorId: user!.id, reason: 'Season completed when a new season started', db: tx })
        }
      })

      const updatedSeason = await prisma.season.update({
        where: { id: season.id },
        data: { status: 'ACTIVE' },
      })

      await openRoundOneIfUpcoming(season.id)

      await logAuditAction(user!.id, 'SEASON_START', 'Season', season.id, {
        seasonName: season.name,
        previousStatus: 'DRAFT',
        newStatus: 'ACTIVE',
      })

      return jsonOk({ message: 'Season activated', season: updatedSeason })
    }

    const season = seasonId
      ? await prisma.season.findUnique({ where: { id: seasonId } })
      : await prisma.season.findFirst({
          where: { status: { in: ['DRAFT', 'ACTIVE', 'PAUSED'] } },
          orderBy: { createdAt: 'desc' },
        })

    if (!season) {
      return jsonOk({ message: 'Season not found' }, 404)
    }

    const previousStatus = season.status
    let newStatus: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'

    switch (action) {
      case 'start':
        if (season.status !== 'DRAFT') {
          return jsonOk({ message: 'Can only start a DRAFT season' }, 422)
        }
        if (!(await hasExactlyThreeActiveMarkets(season.id))) {
          return jsonOk(
            { message: 'Season must have exactly 3 active markets before activation' },
            422
          )
        }
        {
          const activeSeasons = await prisma.season.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })
          await prisma.$transaction(async (tx) => {
            await tx.season.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'COMPLETED' } })
            for (const active of activeSeasons) {
              await closeSeasonSupervisorAssignments({ seasonId: active.id, actorId: user!.id, reason: 'Season completed when a new season started', db: tx })
            }
          })
        }
        newStatus = 'ACTIVE'
        break
      case 'pause':
        if (season.status !== 'ACTIVE') {
          return jsonOk({ message: 'Can only pause an ACTIVE season' }, 422)
        }
        newStatus = 'PAUSED'
        break
      case 'resume':
        if (season.status !== 'PAUSED') {
          return jsonOk({ message: 'Can only resume a PAUSED season' }, 422)
        }
        if (!(await hasExactlyThreeActiveMarkets(season.id))) {
          return jsonOk(
            { message: 'Season must have exactly 3 active markets before activation' },
            422
          )
        }
        newStatus = 'ACTIVE'
        break
      case 'complete':
        if (season.status !== 'ACTIVE' && season.status !== 'PAUSED') {
          return jsonOk({ message: 'Can only complete an ACTIVE or PAUSED season' }, 422)
        }
        newStatus = 'COMPLETED'
        break
      default:
        return jsonOk({ message: 'Invalid action' }, 400)
    }

    // If starting the season, immediately open Round 1
    if (action === 'start') {
      await openRoundOneIfUpcoming(season.id)
    }

    const updatedSeason = action === 'complete'
      ? await prisma.$transaction(async (tx) => {
          const completed = await tx.season.update({ where: { id: season.id }, data: { status: newStatus } })
          await closeSeasonSupervisorAssignments({ seasonId: season.id, actorId: user!.id, reason: 'Season completed', db: tx })
          return completed
        })
      : await prisma.season.update({
          where: { id: season.id },
          data: { status: newStatus },
        })

    await logAuditAction(user!.id, `SEASON_${action.toUpperCase()}`, 'Season', season.id, {
      seasonName: season.name,
      previousStatus,
      newStatus,
    })

    return jsonOk({
      message: `Season ${action}ed successfully`,
      season: updatedSeason,
    })
  } catch (error) {
    return jsonError(error, 'Failed to update season')
  }
}
