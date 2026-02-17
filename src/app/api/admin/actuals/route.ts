import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { canPerformAdminAction } from '@/server/permissions'
import { z } from 'zod'
import { logger } from '@/server/logger'
import { getSession } from '@/server/auth'
import { jsonError } from '@/server/http'

const actualSchema = z.object({
  roundId: z.string(),
  marketId: z.string(),
  weekOffset: z.number().min(1).max(2),
  metric: z.enum(['OCCUPANCY', 'ADR']),
  value: z.number().min(0),
  reason: z.string().optional(),
  source: z.enum(['MANUAL', 'BULK']).optional().default('MANUAL'),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    const canUpload = await canPerformAdminAction(user, 'actuals:upload')

    if (!user || !canUpload) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = actualSchema.parse(body)

    const round = await prisma.round.findUnique({
      where: { id: data.roundId },
      include: { season: true },
    })

    if (!round) {
      return NextResponse.json({ message: 'Round not found' }, { status: 404 })
    }

    const seasonId = round.seasonId

    const existingActual = await prisma.actual.findUnique({
      where: {
        seasonId_roundId_marketId_metric_weekOffset: {
          seasonId,
          roundId: data.roundId,
          marketId: data.marketId,
          metric: data.metric,
          weekOffset: data.weekOffset,
        },
      },
    })

    const isLockedOrScored = round.isLockedActuals || round.lastScoredAt !== null

    if (isLockedOrScored && !data.reason) {
      return NextResponse.json(
        {
          message: 'Reason is required when modifying actuals for a locked or scored round',
          requiresReason: true,
        },
        { status: 400 }
      )
    }

    if (existingActual) {
      const oldValue = existingActual.value
      await prisma.$transaction(async (tx) => {
        await tx.actual.update({
          where: { id: existingActual.id },
          data: {
            value: data.value,
            updatedById: user.id,
            source: data.source,
          },
        })

        await tx.actualValueRevision.create({
          data: {
            actualId: existingActual.id,
            actorId: user.id,
            action: 'EDIT',
            oldValue,
            newValue: data.value,
            reason: data.reason || null,
          },
        })

        if (isLockedOrScored && oldValue !== data.value) {
          await tx.round.update({
            where: { id: data.roundId },
            data: {
              scoresStale: true,
              actualsVersion: { increment: 1 },
            },
          })
        }
      })
    } else {
      await prisma.$transaction(async (tx) => {
        const newActual = await tx.actual.create({
          data: {
            seasonId,
            roundId: data.roundId,
            marketId: data.marketId,
            metric: data.metric,
            weekOffset: data.weekOffset,
            value: data.value,
            source: data.source,
            createdById: user.id,
            updatedById: user.id,
          },
        })

        await tx.actualValueRevision.create({
          data: {
            actualId: newActual.id,
            actorId: user.id,
            action: 'CREATE',
            oldValue: null,
            newValue: data.value,
            reason: data.reason || null,
          },
        })

        if (isLockedOrScored) {
          await tx.round.update({
            where: { id: data.roundId },
            data: {
              scoresStale: true,
              actualsVersion: { increment: 1 },
            },
          })
        }
      })
    }

    return NextResponse.json({ message: 'Actual saved' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 })
    }
    logger.error('Create actual error:', error)
    return jsonError(error, 'Failed to save actual')
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const roundId = searchParams.get('roundId')
    const includeVoided = searchParams.get('includeVoided') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(200, Math.max(20, parseInt(searchParams.get('pageSize') || '50', 10)))
    const skip = (page - 1) * pageSize

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    })

    if (!activeSeason) {
      return NextResponse.json({ actuals: [], rounds: [] })
    }

    interface WhereClause {
      seasonId: string
      roundId?: string
      isVoided?: boolean
    }

    const where: WhereClause = { seasonId: activeSeason.id }
    if (roundId) where.roundId = roundId
    if (!includeVoided) where.isVoided = false

    const [actuals, rounds, totalActuals] = await Promise.all([
      prisma.actual.findMany({
        where,
        include: {
          market: true,
          round: true,
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          updatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ roundId: 'asc' }, { marketId: 'asc' }, { metric: 'asc' }, { weekOffset: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.round.findMany({
        where: { seasonId: activeSeason.id },
        orderBy: { number: 'asc' },
        select: {
          id: true,
          number: true,
          isFinal: true,
          status: true,
          isLockedActuals: true,
          lockedAt: true,
          scoresStale: true,
          lastScoredAt: true,
          actualsVersion: true,
        },
      }),
      prisma.actual.count({ where }),
    ])

    return NextResponse.json({
      actuals: actuals.map((a) => ({
        id: a.id,
        roundId: a.roundId,
        roundNumber: a.round.number,
        marketId: a.marketId,
        marketName: a.market.name,
        metric: a.metric,
        weekOffset: a.weekOffset,
        value: a.value,
        source: a.source,
        isVoided: a.isVoided,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        createdBy: a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}` : null,
        updatedBy: a.updatedBy ? `${a.updatedBy.firstName} ${a.updatedBy.lastName}` : null,
      })),
      rounds,
      totalActuals,
      page,
      pageSize,
    })
  } catch (error) {
    logger.error('Get actuals error:', error)
    return jsonError(error, 'Failed to get actuals')
  }
}
