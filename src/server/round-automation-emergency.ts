import { createHash, randomUUID } from 'node:crypto'
import { Prisma, type RoundStatus, type User } from '@prisma/client'

import { buildAuditLogData } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  safeScheduleError,
  syncEmergencyOverrideReminderSchedules,
  syncSeasonRoundSchedules,
} from '@/server/round-automation-schedules'
import { ApiError } from '@/server/http'

const MIN_EXPECTED_END_MS = 15 * 60 * 1000
const MAX_EXPECTED_END_MS = 24 * 60 * 60 * 1000
const MAX_SERIALIZATION_ATTEMPTS = 3

export type EmergencyReminderEventType =
  | 'EMERGENCY_OVERRIDE_DUE'
  | 'EMERGENCY_OVERRIDE_ESCALATION'

export interface RoundAutomationResumePreview {
  seasonId: string
  seasonName: string
  fingerprint: string
  evaluatedAt: string
  generation: number
  nextGeneration: number
  activeOverride: {
    id: string
    reason: string
    expectedEndAt: string | null
    activatedAt: string
    activatedBy: string | null
  } | null
  currentRounds: Array<{
    id: string
    number: number
    status: RoundStatus
    opensAt: string
    closesAt: string
  }>
  impliedOpenRound: { id: string; number: number } | null
  roundsToOpen: Array<{ id: string; number: number }>
  roundsToClose: Array<{ id: string; number: number }>
  schedulesToReplace: number
  submissionsPermitted: boolean
}

type TransactionClient = Prisma.TransactionClient

function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

function normalizeReason(reason: string) {
  return reason.trim()
}

function validateReason(reason: string) {
  const normalized = normalizeReason(reason)
  if (normalized.length < 10 || normalized.length > 500) {
    throw new ApiError('Reason must be between 10 and 500 characters.', 400, 'INVALID_INPUT')
  }
  return normalized
}

function validateExpectedEndAt(value: string | Date, now = new Date()) {
  const expectedEndAt = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(expectedEndAt.getTime())) {
    throw new ApiError('Expected end time is invalid.', 400, 'INVALID_INPUT')
  }
  const delta = expectedEndAt.getTime() - now.getTime()
  if (delta < MIN_EXPECTED_END_MS || delta > MAX_EXPECTED_END_MS) {
    throw new ApiError(
      'Expected end time must be between 15 minutes and 24 hours from now.',
      400,
      'INVALID_INPUT'
    )
  }
  return expectedEndAt
}

function toJsonRecord(value: RoundAutomationResumePreview) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject
}

function userAuditShape(user: Pick<User, 'id' | 'email' | 'role'>) {
  return { id: user.id, email: user.email, role: user.role }
}

async function notifyFullAdmins(
  tx: TransactionClient,
  input: {
    actorId?: string | null
    title: string
    message: string
    type: string
    link?: string
  }
) {
  const admins = await tx.user.findMany({
    where: {
      role: 'ADMIN',
      isActive: true,
      ...(input.actorId ? { id: { not: input.actorId } } : {}),
    },
    select: { id: true },
  })
  if (admins.length === 0) return 0

  await tx.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? '/admin/season',
    })),
  })
  return admins.length
}

function targetRoundForTime<T extends { opensAt: Date; closesAt: Date }>(rounds: T[], at: Date) {
  return [...rounds].reverse().find((round) => round.opensAt <= at && round.closesAt >= at) ?? null
}

function fingerprintPayload(input: {
  season: {
    id: string
    status: string
    roundAutomationMode: string
    roundAutomationGeneration: number
    roundAutomationLastSyncedAt: Date | null
  }
  rounds: Array<{ id: string; number: number; status: string; opensAt: Date; closesAt: Date }>
  override: { id: string; status: string; expectedEndAt: Date | null; updatedAt: Date } | null
}) {
  return {
    season: {
      id: input.season.id,
      status: input.season.status,
      mode: input.season.roundAutomationMode,
      generation: input.season.roundAutomationGeneration,
      lastSyncedAt: input.season.roundAutomationLastSyncedAt?.toISOString() ?? null,
    },
    override: input.override
      ? {
          id: input.override.id,
          status: input.override.status,
          expectedEndAt: input.override.expectedEndAt?.toISOString() ?? null,
          updatedAt: input.override.updatedAt.toISOString(),
        }
      : null,
    rounds: input.rounds.map((round) => ({
      id: round.id,
      number: round.number,
      status: round.status,
      opensAt: round.opensAt.toISOString(),
      closesAt: round.closesAt.toISOString(),
    })),
  }
}

function createFingerprint(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export async function getActiveRoundAutomationOverride(
  seasonId: string,
  db: typeof prisma | TransactionClient = prisma
) {
  return db.roundAutomationOverride.findFirst({
    where: { seasonId, status: 'ACTIVE' },
    include: {
      activatedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  })
}

export async function buildRoundAutomationResumePreview(
  seasonId: string,
  now = new Date(),
  db: typeof prisma | TransactionClient = prisma
): Promise<RoundAutomationResumePreview> {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: {
      rounds: { orderBy: [{ opensAt: 'asc' }, { number: 'asc' }] },
      roundAutomationOverrides: {
        where: { status: 'ACTIVE' },
        take: 1,
        include: {
          activatedBy: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  })
  if (!season) throw new Error('Season not found')

  const activeOverride = season.roundAutomationOverrides[0] ?? null
  const targetRound = targetRoundForTime(season.rounds, now)
  const openRounds = season.rounds.filter((round) => round.status === 'OPEN')
  const roundsToClose = openRounds.filter((round) => round.id !== targetRound?.id)
  const roundsToOpen = targetRound && targetRound.status !== 'OPEN' ? [targetRound] : []
  const futureBoundaries = season.rounds.flatMap((round) => [
    round.opensAt,
    new Date(round.closesAt.getTime() + 1_000),
  ]).filter((at) => at > now)

  const fingerprint = createFingerprint(fingerprintPayload({
    season,
    rounds: season.rounds,
    override: activeOverride,
  }))

  return {
    seasonId: season.id,
    seasonName: season.name,
    fingerprint,
    evaluatedAt: now.toISOString(),
    generation: season.roundAutomationGeneration,
    nextGeneration: season.roundAutomationGeneration + 1,
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
        }
      : null,
    currentRounds: season.rounds.map((round) => ({
      id: round.id,
      number: round.number,
      status: round.status,
      opensAt: round.opensAt.toISOString(),
      closesAt: round.closesAt.toISOString(),
    })),
    impliedOpenRound: targetRound ? { id: targetRound.id, number: targetRound.number } : null,
    roundsToOpen: roundsToOpen.map((round) => ({ id: round.id, number: round.number })),
    roundsToClose: roundsToClose.map((round) => ({ id: round.id, number: round.number })),
    schedulesToReplace: futureBoundaries.length,
    submissionsPermitted: Boolean(
      season.status === 'ACTIVE'
      && targetRound
      && targetRound.opensAt <= now
      && targetRound.closesAt >= now
    ),
  }
}

export async function startOrExtendRoundAutomationEmergency(input: {
  seasonId: string
  actor: Pick<User, 'id' | 'email' | 'role'>
  reason: string
  expectedEndAt: string | Date
  acknowledgeConsequences: boolean
}) {
  if (!input.acknowledgeConsequences) {
    throw new ApiError('Emergency control confirmation is required.', 400, 'INVALID_INPUT')
  }
  const reason = validateReason(input.reason)
  const expectedEndAt = validateExpectedEndAt(input.expectedEndAt)

  for (let attempt = 1; attempt <= MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.seasonId}))`
          const season = await tx.season.findUnique({ where: { id: input.seasonId } })
          if (!season) throw new ApiError('Season not found', 404, 'NOT_FOUND')

          const active = await tx.roundAutomationOverride.findFirst({
            where: { seasonId: season.id, status: 'ACTIVE' },
          })
          if (active) {
            const override = await tx.roundAutomationOverride.update({
              where: { id: active.id },
              data: {
                expectedEndAt,
                extendedAt: new Date(),
                extendedById: input.actor.id,
                extensionReason: reason,
              },
            })
            await tx.auditLog.create({
              data: buildAuditLogData(
                userAuditShape(input.actor),
                'ROUND_AUTOMATION_EMERGENCY_EXTENDED',
                'Season',
                season.id,
                {
                  details: {
                    overrideId: override.id,
                    reason,
                    expectedEndAt: expectedEndAt.toISOString(),
                  },
                }
              ),
            })
            await notifyFullAdmins(tx, {
              actorId: input.actor.id,
              type: 'ROUND_AUTOMATION_EMERGENCY_EXTENDED',
              title: 'Round scheduling emergency control extended',
              message: `Emergency round control for ${season.name} was extended. Review is due ${expectedEndAt.toLocaleString('en-US', { timeZone: 'America/New_York' })}.`,
            })
            return { season, override, action: 'extended' as const }
          }

          const override = await tx.roundAutomationOverride.create({
            data: {
              seasonId: season.id,
              reason,
              expectedEndAt,
              activatedById: input.actor.id,
            },
          })
          const updatedSeason = await tx.season.update({
            where: { id: season.id },
            data: {
              roundAutomationMode: 'MANUAL',
              roundAutomationGeneration: { increment: 1 },
              roundAutomationScheduleError: null,
            },
          })
          await tx.auditLog.create({
            data: buildAuditLogData(
              userAuditShape(input.actor),
              'ROUND_AUTOMATION_EMERGENCY_STARTED',
              'Season',
              season.id,
              {
                details: {
                  overrideId: override.id,
                  previousMode: season.roundAutomationMode,
                  previousGeneration: season.roundAutomationGeneration,
                  newGeneration: updatedSeason.roundAutomationGeneration,
                  reason,
                  expectedEndAt: expectedEndAt.toISOString(),
                },
              }
            ),
          })
          await notifyFullAdmins(tx, {
            actorId: input.actor.id,
            type: 'ROUND_AUTOMATION_EMERGENCY_STARTED',
            title: 'Round scheduling emergency control started',
            message: `Emergency round control is active for ${season.name}. Review is due ${expectedEndAt.toLocaleString('en-US', { timeZone: 'America/New_York' })}.`,
          })
          return { season: updatedSeason, override, action: 'started' as const }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )

      try {
        await syncEmergencyOverrideReminderSchedules(result.override.id)
      } catch (error) {
        logger.error('Failed to synchronize emergency override reminders', {
          seasonId: input.seasonId,
          overrideId: result.override.id,
          error: safeScheduleError(error),
        })
      }
      return result
    } catch (error) {
      if (isSerializationFailure(error) && attempt < MAX_SERIALIZATION_ATTEMPTS) continue
      throw error
    }
  }

  throw new Error('Emergency control retry limit exceeded.')
}

export async function resumeAutomaticRoundScheduling(input: {
  seasonId: string
  actor: Pick<User, 'id' | 'email' | 'role'>
  fingerprint: string
  reason: string
}) {
  const reason = validateReason(input.reason)
  const preview = await buildRoundAutomationResumePreview(input.seasonId)
  if (!preview.activeOverride) {
    throw new ApiError('No active emergency control is currently open.', 409, 'ROUND_EMERGENCY_CONTROL_NOT_ACTIVE')
  }
  if (preview.fingerprint !== input.fingerprint) {
    throw new ApiError(
      'Round state changed. Refresh the resume preview and try again.',
      409,
      'STALE_ROUND_AUTOMATION_PREVIEW'
    )
  }

  await syncSeasonRoundSchedules(input.seasonId, {
    generationOverride: preview.nextGeneration,
    forceAutomatic: true,
  })

  for (let attempt = 1; attempt <= MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.seasonId}))`
          const currentPreview = await buildRoundAutomationResumePreview(input.seasonId, new Date(), tx)
          if (!currentPreview.activeOverride) {
            throw new ApiError('No active emergency control is currently open.', 409, 'ROUND_EMERGENCY_CONTROL_NOT_ACTIVE')
          }
          if (currentPreview.fingerprint !== input.fingerprint) {
            throw new ApiError(
              'Round state changed. Refresh the resume preview and try again.',
              409,
              'STALE_ROUND_AUTOMATION_PREVIEW'
            )
          }

          if (currentPreview.roundsToClose.length > 0) {
            await tx.round.updateMany({
              where: { id: { in: currentPreview.roundsToClose.map((round) => round.id) } },
              data: { status: 'CLOSED' },
            })
          }
          if (currentPreview.roundsToOpen.length > 0) {
            await tx.round.update({
              where: { id: currentPreview.roundsToOpen[0].id },
              data: { status: 'OPEN' },
            })
          }

          const season = await tx.season.update({
            where: { id: input.seasonId },
            data: {
              roundAutomationMode: 'AUTOMATIC',
              roundAutomationGeneration: { increment: 1 },
              roundAutomationScheduleError: null,
            },
          })
          await tx.roundAutomationOverride.update({
            where: { id: currentPreview.activeOverride.id },
            data: {
              status: 'RESOLVED',
              resolvedAt: new Date(),
              resolvedById: input.actor.id,
              resolutionReason: reason,
            },
          })
          await tx.roundTransitionRun.create({
            data: {
              seasonId: input.seasonId,
              idempotencyKey: `resume:${input.seasonId}:${currentPreview.fingerprint}:${randomUUID()}`,
              trigger: 'MODE_CHANGE',
              outcome: currentPreview.roundsToClose.length || currentPreview.roundsToOpen.length
                ? 'APPLIED'
                : 'NO_CHANGE',
              generation: season.roundAutomationGeneration,
              actorId: input.actor.id,
              openedRoundId: currentPreview.roundsToOpen[0]?.id ?? null,
              closedRoundIds: currentPreview.roundsToClose.map((round) => round.id),
              details: {
                resumePreview: toJsonRecord(currentPreview),
                reason,
              },
            },
          })
          await tx.auditLog.create({
            data: buildAuditLogData(
              userAuditShape(input.actor),
              'ROUND_AUTOMATION_EMERGENCY_RESOLVED',
              'Season',
              input.seasonId,
              {
                details: {
                  reason,
                  preview: toJsonRecord(currentPreview),
                  generation: season.roundAutomationGeneration,
                },
              }
            ),
          })
          await notifyFullAdmins(tx, {
            actorId: input.actor.id,
            type: 'ROUND_AUTOMATION_EMERGENCY_RESOLVED',
            title: 'Round scheduling returned to automatic',
            message: `${currentPreview.seasonName} is back on automatic round scheduling.`,
          })
          return { season, preview: currentPreview }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      if (isSerializationFailure(error) && attempt < MAX_SERIALIZATION_ATTEMPTS) continue
      throw error
    }
  }

  throw new Error('Resume automatic scheduling retry limit exceeded.')
}

export async function processRoundAutomationOverrideReminder(input: {
  seasonId: string
  overrideId: string
  eventType: EmergencyReminderEventType
}) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.seasonId}))`
      const override = await tx.roundAutomationOverride.findUnique({
        where: { id: input.overrideId },
        include: { season: { select: { id: true, name: true } } },
      })
      if (!override || override.seasonId !== input.seasonId || override.status !== 'ACTIVE') {
        return { ok: true, outcome: 'SKIPPED' as const, reason: 'Emergency control is no longer active.' }
      }

      const now = new Date()
      if (input.eventType === 'EMERGENCY_OVERRIDE_DUE') {
        if (override.dueReminderSentAt) {
          return { ok: true, outcome: 'SKIPPED' as const, reason: 'Due reminder was already sent.' }
        }
        await tx.roundAutomationOverride.update({
          where: { id: override.id },
          data: { dueReminderSentAt: now },
        })
        const count = await notifyFullAdmins(tx, {
          type: 'ROUND_AUTOMATION_EMERGENCY_DUE',
          title: 'Round scheduling emergency control needs review',
          message: `Emergency round control for ${override.season.name} has reached its expected review time.`,
        })
        await tx.auditLog.create({
          data: buildAuditLogData(null, 'ROUND_AUTOMATION_EMERGENCY_DUE', 'Season', override.seasonId, {
            details: { overrideId: override.id, notifiedAdmins: count },
          }),
        })
        return { ok: true, outcome: 'APPLIED' as const, notifiedAdmins: count }
      }

      if (override.escalationReminderSentAt) {
        return { ok: true, outcome: 'SKIPPED' as const, reason: 'Escalation reminder was already sent.' }
      }
      await tx.roundAutomationOverride.update({
        where: { id: override.id },
        data: { escalationReminderSentAt: now },
      })
      const count = await notifyFullAdmins(tx, {
        type: 'ROUND_AUTOMATION_EMERGENCY_OVERDUE',
        title: 'Round scheduling emergency control is overdue',
        message: `Emergency round control for ${override.season.name} is still active one hour after its review time.`,
      })
      await tx.auditLog.create({
        data: buildAuditLogData(null, 'ROUND_AUTOMATION_EMERGENCY_OVERDUE', 'Season', override.seasonId, {
          details: { overrideId: override.id, notifiedAdmins: count },
        }),
      })
      return { ok: true, outcome: 'APPLIED' as const, notifiedAdmins: count }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}
