import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { canPerformAdminAction } from '@/server/permissions'
import { z } from 'zod'
import { logger } from '@/server/logger'
import { getSession } from '@/server/auth'
import { jsonError } from '@/server/http'

const unvoidSchema = z.object({
  reason: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    const canUpload = await canPerformAdminAction(user, 'actuals:upload')

    if (!user || !canUpload) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const data = unvoidSchema.parse(body)

    const actual = await prisma.actual.findUnique({
      where: { id },
      include: { round: true },
    })

    if (!actual) {
      return NextResponse.json({ message: 'Actual not found' }, { status: 404 })
    }

    if (!actual.isVoided) {
      return NextResponse.json({ message: 'Actual is not voided' }, { status: 400 })
    }

    const isLockedOrScored = actual.round.isLockedActuals || actual.round.lastScoredAt !== null

    if (isLockedOrScored && !data.reason) {
      return NextResponse.json(
        {
          message: 'Reason is required when unvoiding actuals for a locked or scored round',
          requiresReason: true,
        },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.actual.update({
        where: { id },
        data: {
          isVoided: false,
          updatedById: user.id,
        },
      })

      await tx.actualValueRevision.create({
        data: {
          actualId: id,
          actorId: user.id,
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

    return NextResponse.json({ message: 'Actual restored' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 })
    }
    logger.error('Unvoid actual error:', error)
    return jsonError(error, 'Failed to restore actual')
  }
}
