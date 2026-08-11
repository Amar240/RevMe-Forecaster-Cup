import { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { z } from 'zod'

import { buildAuditLogData } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { reconcileSeasonRoundState } from '@/lib/round-scheduler'
import {
  getRoundSchedulerConfigurationStatus,
  syncSeasonRoundSchedules,
} from '@/server/round-automation-schedules'
import { ApiError, jsonError, jsonOk, requireAdminOrResponse } from '@/server/http'

export const dynamic = 'force-dynamic'

const updateModeSchema = z.object({
  mode: z.enum(['AUTOMATIC', 'MANUAL']),
  reason: z.string().trim().min(5).max(500),
})

async function getStatus(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      rounds: {
        orderBy: { number: 'asc' },
        select: { id: true, number: true, opensAt: true, closesAt: true, status: true },
      },
      roundTransitionRuns: {
        orderBy: { processedAt: 'desc' },
        take: 1,
      },
    },
  })
  if (!season) throw new ApiError('Season not found', 404, 'NOT_FOUND')

  const now = new Date()
  const boundaries = season.rounds.flatMap((round) => [
    { type: 'OPEN' as const, at: round.opensAt, roundId: round.id, roundNumber: round.number },
    { type: 'CLOSE' as const, at: round.closesAt, roundId: round.id, roundNumber: round.number },
  ])
  const nextTransition = boundaries
    .filter((boundary) => boundary.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null

  return {
    seasonId: season.id,
    mode: season.roundAutomationMode,
    generation: season.roundAutomationGeneration,
    lastSyncedAt: season.roundAutomationLastSyncedAt,
    scheduleError: season.roundAutomationScheduleError,
    infrastructure: getRoundSchedulerConfigurationStatus(),
    nextTransition,
    latestRun: season.roundTransitionRuns[0] ?? null,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response
    const { seasonId } = await params
    return jsonOk(await getStatus(seasonId))
  } catch (error) {
    return jsonError(error, 'Failed to load round automation status')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    if (user?.role !== 'ADMIN') {
      throw new ApiError('Only a full administrator can change round automation mode', 403, 'FORBIDDEN')
    }

    const { seasonId } = await params
    const parsed = updateModeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw parsed.error

    if (parsed.data.mode === 'AUTOMATIC') {
      const infrastructure = getRoundSchedulerConfigurationStatus()
      if (!infrastructure.configured) {
        throw new ApiError(
          `Automatic mode is unavailable until ${infrastructure.missing.join(' and ')} are configured`,
          409,
          'ROUND_AUTOMATION_NOT_CONFIGURED'
        )
      }
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${seasonId}))`
        const season = await tx.season.findUnique({ where: { id: seasonId } })
        if (!season) throw new ApiError('Season not found', 404, 'NOT_FOUND')

        if (season.roundAutomationMode === parsed.data.mode) {
          if (parsed.data.mode === 'AUTOMATIC') {
            await tx.auditLog.create({
              data: buildAuditLogData(
                { id: user.id, email: user.email, role: user.role },
                'ROUND_AUTOMATION_SYNC_REQUESTED',
                'Season',
                season.id,
                {
                  details: {
                    generation: season.roundAutomationGeneration,
                    reason: parsed.data.reason,
                  },
                }
              ),
            })
          }
          return season
        }
        const next = await tx.season.update({
          where: { id: season.id },
          data: {
            roundAutomationMode: parsed.data.mode,
            roundAutomationGeneration: { increment: 1 },
            roundAutomationScheduleError: null,
          },
        })

        await tx.auditLog.create({
          data: buildAuditLogData(
            { id: user.id, email: user.email, role: user.role },
            'ROUND_AUTOMATION_MODE_CHANGED',
            'Season',
            season.id,
            {
              details: {
                previousMode: season.roundAutomationMode,
                newMode: parsed.data.mode,
                previousGeneration: season.roundAutomationGeneration,
                newGeneration: next.roundAutomationGeneration,
                reason: parsed.data.reason,
              },
            }
          ),
        })
        return next
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )

    let reconciliation = null
    let schedules = null
    let scheduleSyncWarning: string | null = null
    if (parsed.data.mode === 'AUTOMATIC') {
      reconciliation = await reconcileSeasonRoundState({
        seasonId,
        trigger: 'MODE_CHANGE',
        actorId: user.id,
        generation: updated.roundAutomationGeneration,
      })
      try {
        schedules = await syncSeasonRoundSchedules(seasonId)
      } catch (error) {
        // The database mode change and immediate reconciliation already
        // succeeded. Preserve that truth and surface the durable sync error
        // instead of returning a misleading failed-mode-change response.
        scheduleSyncWarning = error instanceof Error
          ? error.message
          : 'Future round schedules could not be synchronized.'
      }
    }

    return jsonOk({
      ...(await getStatus(seasonId)),
      reconciliation,
      schedules,
      scheduleSyncWarning,
    })
  } catch (error) {
    return jsonError(error, 'Failed to change round automation mode')
  }
}
