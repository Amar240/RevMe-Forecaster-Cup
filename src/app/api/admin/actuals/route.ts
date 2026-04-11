import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'

export const dynamic = 'force-dynamic'


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
    const { user, response } = await requireAdminOrResponse('actuals:upload')
    if (response) return response

    const body = await request.json()
    const data = actualSchema.parse(body)

    const round = await prisma.round.findUnique({
      where: { id: data.roundId },
      include: { season: true },
    })

    if (!round) {
      return jsonOk({ message: 'Round not found' }, 404)
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
      return jsonOk(
        {
          message: 'Reason is required when modifying actuals for a locked or scored round',
          requiresReason: true,
        },
        400
      )
    }

    if (existingActual) {
      const oldValue = existingActual.value
      await prisma.$transaction(async (tx) => {
        await tx.actual.update({
          where: { id: existingActual.id },
          data: {
            value: data.value,
            updatedById: user!.id,
            source: data.source,
          },
        })

        await tx.actualValueRevision.create({
          data: {
            actualId: existingActual.id,
            actorId: user!.id,
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
            createdById: user!.id,
            updatedById: user!.id,
          },
        })

        await tx.actualValueRevision.create({
          data: {
            actualId: newActual.id,
            actorId: user!.id,
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

    return jsonOk({ message: 'Actual saved' }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to save actual')
  }
}

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { searchParams } = new URL(request.url)
    const roundId = searchParams.get('roundId')
    const includeVoided = searchParams.get('includeVoided') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(200, Math.max(20, parseInt(searchParams.get('pageSize') || '50', 10)))
    const skip = (page - 1) * pageSize

    const operationalSeason = await getCurrentOperationalSeason({
      select: { id: true },
    })

    if (!operationalSeason) {
      return jsonOk({ actuals: [], rounds: [] })
    }

    interface WhereClause {
      seasonId: string
      roundId?: string
      isVoided?: boolean
    }

    const where: WhereClause = { seasonId: operationalSeason.id }
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
        where: { seasonId: operationalSeason.id },
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

    return jsonOk({
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
    return jsonError(error, 'Failed to get actuals')
  }
}
