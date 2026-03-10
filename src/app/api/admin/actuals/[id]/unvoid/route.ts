import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'


const unvoidSchema = z.object({
  reason: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse('actuals:upload')
    if (response) return response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const data = unvoidSchema.parse(body)

    const actual = await prisma.actual.findUnique({
      where: { id },
      include: { round: true },
    })

    if (!actual) {
      return jsonOk({ message: 'Actual not found' }, 404)
    }

    if (!actual.isVoided) {
      return jsonOk({ message: 'Actual is not voided' }, 400)
    }

    const isLockedOrScored = actual.round.isLockedActuals || actual.round.lastScoredAt !== null

    if (isLockedOrScored && !data.reason) {
      return jsonOk(
        {
          message: 'Reason is required when unvoiding actuals for a locked or scored round',
          requiresReason: true,
        },
        400
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.actual.update({
        where: { id },
        data: {
          isVoided: false,
          updatedById: user!.id,
        },
      })

      await tx.actualValueRevision.create({
        data: {
          actualId: id,
          actorId: user!.id,
          action: 'UNVOID',
          oldValue: null,
          newValue: actual.value,
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

    return jsonOk({ message: 'Actual restored' })
  } catch (error) {
    return jsonError(error, 'Failed to restore actual')
  }
}
