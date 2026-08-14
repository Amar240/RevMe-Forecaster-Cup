import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { logAuditAction } from '@/lib/audit'
import { Prisma, type RoundStatus } from '@prisma/client'
import { assignMissedSubmissionWarnings } from '@/server/missed-submission-warnings'
import { getActiveRoundAutomationOverride } from '@/server/round-automation-emergency'
import { safeScheduleError, syncSeasonRoundSchedules } from '@/server/round-automation-schedules'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const updateRoundSchema = z.object({
  status: z.enum(['UPCOMING', 'OPEN', 'PAUSED', 'CLOSED']),
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime().optional(),
  reason: z.string().trim().min(10).max(500).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const parsed = updateRoundSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw parsed.error
    const { status, opensAt, closesAt, reason } = parsed.data

    const updateData: { status: RoundStatus; opensAt?: Date; closesAt?: Date } = { status }
    if (opensAt) updateData.opensAt = new Date(opensAt)
    if (closesAt) updateData.closesAt = new Date(closesAt)

    const result = await prisma.$transaction(async (tx) => {
      const initialRound = await tx.round.findUnique({ where: { id }, select: { seasonId: true } })
      if (!initialRound) throw new ApiError('Round not found', 404, 'NOT_FOUND')

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initialRound.seasonId}))`
      const round = await tx.round.findUnique({ where: { id }, include: { season: true } })
      if (!round) throw new ApiError('Round not found', 404, 'NOT_FOUND')

      const finalOpensAt = opensAt ? new Date(opensAt) : round.opensAt
      const finalClosesAt = closesAt ? new Date(closesAt) : round.closesAt
      const statusChanged = status !== round.status
      const timeChanged = finalOpensAt.getTime() !== round.opensAt.getTime()
        || finalClosesAt.getTime() !== round.closesAt.getTime()

      if (finalOpensAt >= finalClosesAt) {
        throw new ApiError('Opens At must be before Closes At', 422, 'INVALID_DATE_RANGE')
      }

      if (timeChanged && !reason) {
        throw new ApiError(
          'A reason is required when changing a round schedule.',
          400,
          'INVALID_INPUT'
        )
      }

      const activeOverride = await getActiveRoundAutomationOverride(round.seasonId, tx)
      if (statusChanged && !activeOverride) {
        throw new ApiError(
          'Emergency round control is required before manually changing round status.',
          409,
          'ROUND_EMERGENCY_CONTROL_REQUIRED',
          {
            seasonId: round.seasonId,
            roundId: round.id,
            requestedStatus: status,
            action: 'START_EMERGENCY_CONTROL',
          }
        )
      }

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
      }

      if (timeChanged && round.season.roundAutomationMode === 'AUTOMATIC' && !activeOverride) {
        await tx.season.update({
          where: { id: round.seasonId },
          data: {
            roundAutomationGeneration: { increment: 1 },
            roundAutomationScheduleError: null,
          },
        })
      }
      const updatedRound = await tx.round.update({ where: { id }, data: updateData })
      return {
        round,
        updatedRound,
        statusChanged,
        timeChanged,
        activeOverrideId: activeOverride?.id ?? null,
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    let scheduleSyncWarning: string | null = null
    if (result.timeChanged && !result.activeOverrideId) {
      try {
        await syncSeasonRoundSchedules(result.round.seasonId)
      } catch (error) {
        scheduleSyncWarning = safeScheduleError(error)
        logger.error('Round schedule changed but future round schedules could not be synchronized', {
          roundId: id,
          seasonId: result.round.seasonId,
          error: scheduleSyncWarning,
        })
      }
    }

    // A manual close can leave teams with a missed submission — assign warnings + emails. Non-fatal.
    if (status === 'CLOSED' && result.statusChanged) {
      try {
        await assignMissedSubmissionWarnings({ roundIds: [id], sendEmail: true, actorId: user!.id })
      } catch (error) {
        logger.error('Missed-submission warning assignment failed after manual close', {
          roundId: id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    await logAuditAction(user!.id, 'UPDATE_ROUND_STATUS', 'Round', id, {
      roundNumber: result.round.number, previousStatus: result.round.status, newStatus: status,
      previousOpensAt: result.round.opensAt.toISOString(), previousClosesAt: result.round.closesAt.toISOString(),
      newOpensAt: opensAt || undefined, newClosesAt: closesAt || undefined,
      statusChanged: result.statusChanged,
      timeChanged: result.timeChanged,
      reason,
      activeOverrideId: result.activeOverrideId,
      scheduleSyncWarning,
    }, null)

    return jsonOk({
      message: `Round ${result.round.number} updated`,
      round: result.updatedRound,
      scheduleSyncWarning,
    })
  } catch (error) {
    return jsonError(error, 'Failed to update round status')
  }
}
