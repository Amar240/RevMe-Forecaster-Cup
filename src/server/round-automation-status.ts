import { prisma } from '@/lib/db'
import { ApiError } from '@/server/http'
import { getRoundSchedulerConfigurationStatus } from '@/server/round-automation-schedules'

export async function getRoundAutomationStatusPayload(seasonId: string) {
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
      roundAutomationOverrides: {
        where: { status: 'ACTIVE' },
        take: 1,
        include: {
          activatedBy: { select: { firstName: true, lastName: true, email: true } },
          extendedBy: { select: { firstName: true, lastName: true, email: true } },
        },
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
  const infrastructure = getRoundSchedulerConfigurationStatus()
  const activeOverride = season.roundAutomationOverrides[0] ?? null
  const health = activeOverride || season.roundAutomationScheduleError
    ? 'ATTENTION_NEEDED'
    : infrastructure.configured
      ? 'RUNNING'
      : 'SETUP_REQUIRED'

  const displayMessage = activeOverride
    ? 'Emergency control is active. Automatic transitions are paused until an administrator resumes them.'
    : season.roundAutomationScheduleError
      ? 'Automatic scheduling needs attention. Use emergency controls if round timing must be managed immediately.'
      : infrastructure.configured
        ? 'Automatic scheduling is connected and ready.'
        : 'Automatic scheduling is not connected yet. Manual round actions require emergency controls.'

  return {
    seasonId: season.id,
    mode: season.roundAutomationMode,
    generation: season.roundAutomationGeneration,
    lastSyncedAt: season.roundAutomationLastSyncedAt,
    scheduleError: season.roundAutomationScheduleError,
    health,
    displayMessage,
    activeOverride: activeOverride
      ? {
          id: activeOverride.id,
          reason: activeOverride.reason,
          expectedEndAt: activeOverride.expectedEndAt?.toISOString() ?? null,
          activatedAt: activeOverride.activatedAt.toISOString(),
          activatedBy: activeOverride.activatedBy
            ? `${activeOverride.activatedBy.firstName} ${activeOverride.activatedBy.lastName}`.trim()
              || activeOverride.activatedBy.email
            : null,
          extendedAt: activeOverride.extendedAt?.toISOString() ?? null,
          extendedBy: activeOverride.extendedBy
            ? `${activeOverride.extendedBy.firstName} ${activeOverride.extendedBy.lastName}`.trim()
              || activeOverride.extendedBy.email
            : null,
          extensionReason: activeOverride.extensionReason,
          dueReminderSentAt: activeOverride.dueReminderSentAt?.toISOString() ?? null,
          escalationReminderSentAt: activeOverride.escalationReminderSentAt?.toISOString() ?? null,
        }
      : null,
    infrastructure,
    nextTransition,
    latestRun: season.roundTransitionRuns[0] ?? null,
  }
}
