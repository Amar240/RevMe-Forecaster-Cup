import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'


const updateSchema = z.object({
  value: z.number().min(0),
  reason: z.string().optional(),
})

const voidSchema = z.object({
  reason: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params

    const actual = await prisma.actual.findUnique({
      where: { id },
      include: {
        market: true,
        round: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        revisions: {
          include: {
            actor: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!actual) {
      return jsonOk({ message: 'Actual not found' }, 404)
    }

    return jsonOk({
      actual: {
        id: actual.id,
        roundId: actual.roundId,
        roundNumber: actual.round.number,
        marketId: actual.marketId,
        marketName: actual.market.name,
        metric: actual.metric,
        weekOffset: actual.weekOffset,
        value: actual.value,
        source: actual.source,
        isVoided: actual.isVoided,
        createdAt: actual.createdAt,
        updatedAt: actual.updatedAt,
        createdBy: actual.createdBy ? `${actual.createdBy.firstName} ${actual.createdBy.lastName}` : null,
        updatedBy: actual.updatedBy ? `${actual.updatedBy.firstName} ${actual.updatedBy.lastName}` : null,
        round: {
          isLockedActuals: actual.round.isLockedActuals,
          lastScoredAt: actual.round.lastScoredAt,
          scoresStale: actual.round.scoresStale,
        },
        revisions: actual.revisions.map((r) => ({
          id: r.id,
          action: r.action,
          oldValue: r.oldValue,
          newValue: r.newValue,
          reason: r.reason,
          createdAt: r.createdAt,
          actor: `${r.actor.firstName} ${r.actor.lastName}`,
          actorEmail: r.actor.email,
        })),
      },
    })
  } catch (error) {
    return jsonError(error, 'Failed to get actual')
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse('actuals:upload')
    if (response) return response

    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const actual = await prisma.actual.findUnique({
      where: { id },
      include: { round: true },
    })

    if (!actual) {
      return jsonOk({ message: 'Actual not found' }, 404)
    }

    const isLockedOrScored = actual.round.isLockedActuals || actual.round.lastScoredAt !== null

    if (isLockedOrScored && !data.reason) {
      return jsonOk(
        {
          message: 'Reason is required when editing actuals for a locked or scored round',
          requiresReason: true,
        },
        400
      )
    }

    const oldValue = actual.value

    await prisma.$transaction(async (tx) => {
      await tx.actual.update({
        where: { id },
        data: {
          value: data.value,
          updatedById: user!.id,
        },
      })

      await tx.actualValueRevision.create({
        data: {
          actualId: id,
          actorId: user!.id,
          action: 'EDIT',
          oldValue,
          newValue: data.value,
          reason: data.reason || null,
        },
      })

      if (isLockedOrScored && oldValue !== data.value) {
        await tx.round.update({
          where: { id: actual.roundId },
          data: {
            scoresStale: true,
            actualsVersion: { increment: 1 },
          },
        })
      }
    })

    return jsonOk({ message: 'Actual updated' })
  } catch (error) {
    return jsonError(error, 'Failed to update actual')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse('actuals:upload')
    if (response) return response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const data = voidSchema.parse(body)

    const actual = await prisma.actual.findUnique({
      where: { id },
      include: { round: true },
    })

    if (!actual) {
      return jsonOk({ message: 'Actual not found' }, 404)
    }

    const isLockedOrScored = actual.round.isLockedActuals || actual.round.lastScoredAt !== null

    if (isLockedOrScored && !data.reason) {
      return jsonOk(
        {
          message: 'Reason is required when voiding actuals for a locked or scored round',
          requiresReason: true,
        },
        400
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.actual.update({
        where: { id },
        data: {
          isVoided: true,
          updatedById: user!.id,
        },
      })

      await tx.actualValueRevision.create({
        data: {
          actualId: id,
          actorId: user!.id,
          action: 'VOID',
          oldValue: actual.value,
          newValue: null,
          reason: data.reason || null,
        },
      })

      if (isLockedOrScored) {
        await tx.round.update({
          where: { id: actual.roundId },
          data: {
            scoresStale: true,
            actualsVersion: { increment: 1 },
          },
        })
      }
    })

    return jsonOk({ message: 'Actual voided' })
  } catch (error) {
    return jsonError(error, 'Failed to void actual')
  }
}
