import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const lockSchema = z.object({
  reason: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const round = await prisma.round.findUnique({ where: { id } })
    if (!round) throw new ApiError('Round not found', 404, 'NOT_FOUND')
    if (round.isLockedActuals) throw new ApiError('Round actuals are already locked', 400, 'INVALID_INPUT')

    await prisma.$transaction(async (tx) => {
      await tx.round.update({ where: { id }, data: { isLockedActuals: true, lockedAt: new Date(), lockedById: user!.id } })
      await tx.auditLog.create({
        data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'LOCK_ROUND_ACTUALS', entityType: 'Round', entityId: id, details: { roundNumber: round.number } },
      })
    })

    return jsonOk({ message: 'Round actuals locked' })
  } catch (error) {
    return jsonError(error, 'Failed to lock round')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const body = await request.json()
    const data = lockSchema.parse(body)

    if (!data.reason || data.reason.trim().length < 5) {
      throw new ApiError('A reason is required to unlock round actuals (minimum 5 characters)', 400, 'INVALID_INPUT')
    }

    const round = await prisma.round.findUnique({ where: { id } })
    if (!round) throw new ApiError('Round not found', 404, 'NOT_FOUND')
    if (!round.isLockedActuals) throw new ApiError('Round actuals are not locked', 400, 'INVALID_INPUT')

    await prisma.$transaction(async (tx) => {
      await tx.round.update({ where: { id }, data: { isLockedActuals: false, lockedAt: null, lockedById: null } })
      await tx.auditLog.create({
        data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'UNLOCK_ROUND_ACTUALS', entityType: 'Round', entityId: id, details: { roundNumber: round.number, reason: data.reason } },
      })
    })

    return jsonOk({ message: 'Round actuals unlocked' })
  } catch (error) {
    return jsonError(error, 'Failed to unlock round')
  }
}
