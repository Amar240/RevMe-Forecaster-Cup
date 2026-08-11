import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { logAuditAction } from '@/lib/audit'
import { Prisma, type RoundStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const body = await request.json()
    const { status, opensAt, closesAt } = body

    if (!['UPCOMING', 'OPEN', 'PAUSED', 'CLOSED'].includes(status)) {
      throw new ApiError('Invalid status', 400, 'INVALID_INPUT')
    }

    const updateData: { status: RoundStatus; opensAt?: Date; closesAt?: Date } = { status: status as RoundStatus }
    if (opensAt) updateData.opensAt = new Date(opensAt)
    if (closesAt) updateData.closesAt = new Date(closesAt)

    const result = await prisma.$transaction(async (tx) => {
      const initialRound = await tx.round.findUnique({ where: { id }, select: { seasonId: true } })
      if (!initialRound) throw new ApiError('Round not found', 404, 'NOT_FOUND')

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initialRound.seasonId}))`
      const round = await tx.round.findUnique({ where: { id }, include: { season: true } })
      if (!round) throw new ApiError('Round not found', 404, 'NOT_FOUND')

      if (status === 'OPEN') {
        if (round.season.status !== 'ACTIVE') {
          throw new ApiError(`Cannot open Round ${round.number}. Season must be ACTIVE first (current: ${round.season.status}).`, 422, 'SEASON_NOT_ACTIVE')
        }
        const existingOpenRound = await tx.round.findFirst({
          where: { seasonId: round.seasonId, status: 'OPEN', id: { not: id } },
        })
        if (existingOpenRound) {
          throw new ApiError(`Cannot open Round ${round.number}. Round ${existingOpenRound.number} is already open. Close it first.`, 422, 'MAX_ONE_OPEN_ROUND')
        }
        const finalOpensAt = opensAt ? new Date(opensAt) : round.opensAt
        const finalClosesAt = closesAt ? new Date(closesAt) : round.closesAt
        if (finalOpensAt >= finalClosesAt) {
          throw new ApiError('Opens At must be before Closes At', 422, 'INVALID_DATE_RANGE')
        }
      }

      const automationModeChangedToManual = round.season.roundAutomationMode === 'AUTOMATIC'
      if (automationModeChangedToManual) {
        await tx.season.update({
          where: { id: round.seasonId },
          data: {
            roundAutomationMode: 'MANUAL',
            roundAutomationGeneration: { increment: 1 },
            roundAutomationScheduleError: null,
          },
        })
      }
      const updatedRound = await tx.round.update({ where: { id }, data: updateData })
      return { round, updatedRound, automationModeChangedToManual }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    await logAuditAction(user!.id, 'UPDATE_ROUND_STATUS', 'Round', id, {
      roundNumber: result.round.number, previousStatus: result.round.status, newStatus: status,
      previousOpensAt: result.round.opensAt.toISOString(), previousClosesAt: result.round.closesAt.toISOString(),
      newOpensAt: opensAt || undefined, newClosesAt: closesAt || undefined,
      automationModeChangedToManual: result.automationModeChangedToManual,
    }, null)

    return jsonOk({ message: `Round ${result.round.number} status updated to ${status}`, round: result.updatedRound })
  } catch (error) {
    return jsonError(error, 'Failed to update round status')
  }
}
