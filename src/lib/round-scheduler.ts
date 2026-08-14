import { randomUUID } from 'node:crypto'
import {
  Prisma,
  type RoundTransitionOutcome,
  type RoundTransitionTrigger,
} from '@prisma/client'

import { buildAuditLogData } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { assignMissedSubmissionWarnings } from '@/server/missed-submission-warnings'

const MAX_SERIALIZATION_ATTEMPTS = 3

export interface ReconcileSeasonRoundOptions {
  seasonId: string
  trigger: RoundTransitionTrigger
  now?: Date
  actorId?: string | null
  generation?: number
  idempotencyKey?: string
  force?: boolean
  scheduledFor?: Date
}

export interface ReconcileSeasonRoundResult {
  seasonId: string
  generation: number
  outcome: RoundTransitionOutcome
  opened: number
  closed: number
  openedRoundId: string | null
  closedRoundIds: string[]
  reason?: string
}

function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[database]').slice(0, 500)
}

function createIdempotencyKey(options: ReconcileSeasonRoundOptions, generation: number) {
  return options.idempotencyKey
    ?? `${options.trigger.toLowerCase()}:${options.seasonId}:${generation}:${randomUUID()}`
}

async function persistFailedRun(
  options: ReconcileSeasonRoundOptions,
  generation: number,
  idempotencyKey: string,
  error: unknown
) {
  try {
    await prisma.roundTransitionRun.upsert({
      where: { idempotencyKey },
      create: {
        seasonId: options.seasonId,
        idempotencyKey,
        trigger: options.trigger,
        outcome: 'FAILED',
        generation,
        scheduledFor: options.scheduledFor,
        actorId: options.actorId ?? null,
        errorMessage: safeErrorMessage(error),
      },
      update: {
        outcome: 'FAILED',
        processedAt: new Date(),
        errorMessage: safeErrorMessage(error),
      },
    })
  } catch (persistError) {
    logger.error('Failed to persist round transition failure', {
      seasonId: options.seasonId,
      error: safeErrorMessage(persistError),
    })
  }
}

export async function reconcileSeasonRoundState(
  options: ReconcileSeasonRoundOptions
): Promise<ReconcileSeasonRoundResult> {
  const requestedAt = options.now ?? new Date()
  const initialSeason = await prisma.season.findUnique({
    where: { id: options.seasonId },
    select: { roundAutomationGeneration: true },
  })

  if (!initialSeason) {
    throw new Error(`Season ${options.seasonId} was not found`)
  }

  const requestedGeneration = options.generation ?? initialSeason.roundAutomationGeneration
  const idempotencyKey = createIdempotencyKey(options, requestedGeneration)

  for (let attempt = 1; attempt <= MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Serialize all state decisions for one season, even across app instances.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${options.seasonId}))`

          const existingRun = await tx.roundTransitionRun.findUnique({
            where: { idempotencyKey },
          })
          if (existingRun) {
            const closedRoundIds = Array.isArray(existingRun.closedRoundIds)
              ? existingRun.closedRoundIds.filter((value): value is string => typeof value === 'string')
              : []
            return {
              seasonId: options.seasonId,
              generation: existingRun.generation,
              outcome: existingRun.outcome,
              opened: existingRun.openedRoundId ? 1 : 0,
              closed: closedRoundIds.length,
              openedRoundId: existingRun.openedRoundId,
              closedRoundIds,
              reason: 'This transition request was already processed.',
            }
          }

          const season = await tx.season.findUnique({
            where: { id: options.seasonId },
            include: { rounds: { orderBy: [{ opensAt: 'asc' }, { number: 'asc' }] } },
          })
          if (!season) throw new Error(`Season ${options.seasonId} was not found`)

          let skipReason: string | null = null
          if (season.status !== 'ACTIVE') {
            skipReason = `Season status is ${season.status}; only ACTIVE seasons are reconciled.`
          } else if (!options.force && season.roundAutomationMode !== 'AUTOMATIC') {
            skipReason = 'Season is in manual round-control mode.'
          } else if (
            options.generation !== undefined
            && options.generation !== season.roundAutomationGeneration
          ) {
            skipReason = 'Scheduled transition belongs to an earlier automation generation.'
          }

          if (skipReason) {
            await tx.roundTransitionRun.create({
              data: {
                seasonId: season.id,
                idempotencyKey,
                trigger: options.trigger,
                outcome: 'SKIPPED',
                generation: season.roundAutomationGeneration,
                scheduledFor: options.scheduledFor,
                actorId: options.actorId ?? null,
                details: { reason: skipReason },
              },
            })
            return {
              seasonId: season.id,
              generation: season.roundAutomationGeneration,
              outcome: 'SKIPPED',
              opened: 0,
              closed: 0,
              openedRoundId: null,
              closedRoundIds: [],
              reason: skipReason,
            }
          }

          // A round remains eligible through its stored closesAt instant, matching
          // the server-side submission deadline gate.
          const targetRound = [...season.rounds]
            .reverse()
            .find((round) => round.opensAt <= requestedAt && round.closesAt >= requestedAt)

          const openRounds = season.rounds.filter((round) => round.status === 'OPEN')
          const roundsToClose = openRounds.filter((round) => round.id !== targetRound?.id)

          if (roundsToClose.length > 0) {
            await tx.round.updateMany({
              where: { id: { in: roundsToClose.map((round) => round.id) } },
              data: { status: 'CLOSED' },
            })
          }

          let openedRoundId: string | null = null
          if (targetRound && targetRound.status !== 'OPEN') {
            await tx.round.update({
              where: { id: targetRound.id },
              data: { status: 'OPEN' },
            })
            openedRoundId = targetRound.id
          }

          const closedRoundIds = roundsToClose.map((round) => round.id)
          const outcome: RoundTransitionOutcome = openedRoundId || closedRoundIds.length > 0
            ? 'APPLIED'
            : 'NO_CHANGE'

          await tx.roundTransitionRun.create({
            data: {
              seasonId: season.id,
              idempotencyKey,
              trigger: options.trigger,
              outcome,
              generation: season.roundAutomationGeneration,
              scheduledFor: options.scheduledFor,
              actorId: options.actorId ?? null,
              openedRoundId,
              closedRoundIds,
              details: {
                evaluatedAt: requestedAt.toISOString(),
                targetRoundId: targetRound?.id ?? null,
                targetRoundNumber: targetRound?.number ?? null,
              },
            },
          })

          if (outcome === 'APPLIED') {
            await tx.auditLog.create({
              data: buildAuditLogData(
                options.actorId ? { id: options.actorId } : null,
                'ROUND_AUTOMATION_RECONCILED',
                'Season',
                season.id,
                {
                  details: {
                    trigger: options.trigger,
                    generation: season.roundAutomationGeneration,
                    evaluatedAt: requestedAt.toISOString(),
                    openedRoundId,
                    closedRoundIds,
                  },
                }
              ),
            })
          }

          return {
            seasonId: season.id,
            generation: season.roundAutomationGeneration,
            outcome,
            opened: openedRoundId ? 1 : 0,
            closed: closedRoundIds.length,
            openedRoundId,
            closedRoundIds,
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      if (isSerializationFailure(error) && attempt < MAX_SERIALIZATION_ATTEMPTS) continue
      await persistFailedRun(options, requestedGeneration, idempotencyKey, error)
      throw error
    }
  }

  throw new Error('Round transition retry limit exceeded')
}

export async function processRoundTransitions(options?: {
  now?: Date
  trigger?: RoundTransitionTrigger
  actorId?: string | null
  seasonId?: string
  force?: boolean
  dueOnly?: boolean
}): Promise<{ opened: number; closed: number; closedRoundIds: string[] }> {
  const evaluatedAt = options?.now ?? new Date()
  const seasons = await prisma.season.findMany({
    where: {
      id: options?.seasonId,
      status: 'ACTIVE',
      ...(options?.force ? {} : { roundAutomationMode: 'AUTOMATIC' as const }),
      ...(options?.dueOnly
        ? {
            rounds: {
              some: {
                OR: [
                  { status: 'OPEN' as const, closesAt: { lt: evaluatedAt } },
                  {
                    status: { in: ['UPCOMING', 'PAUSED', 'CLOSED'] as const },
                    opensAt: { lte: evaluatedAt },
                    closesAt: { gte: evaluatedAt },
                  },
                ],
              },
            },
          }
        : {}),
    },
    select: { id: true },
  })

  let opened = 0
  let closed = 0
  const closedRoundIds: string[] = []
  for (const season of seasons) {
    const result = await reconcileSeasonRoundState({
      seasonId: season.id,
      trigger: options?.trigger ?? 'RECOVERY',
      actorId: options?.actorId,
      now: evaluatedAt,
      force: options?.force,
    })
    opened += result.opened
    closed += result.closed
    closedRoundIds.push(...result.closedRoundIds)
  }

  logger.info('Round lifecycle reconciliation completed', {
    seasons: seasons.length,
    opened,
    closed,
    evaluatedAt: evaluatedAt.toISOString(),
  })

  // Any round that just closed may leave teams with a missed submission. Assign warnings + emails
  // idempotently so this is guaranteed regardless of which close path ran. Non-fatal.
  if (closedRoundIds.length > 0) {
    try {
      await assignMissedSubmissionWarnings({
        roundIds: closedRoundIds,
        sendEmail: true,
        actorId: options?.actorId ?? null,
      })
    } catch (error) {
      logger.error('Missed-submission warning assignment failed after round close', {
        closedRoundIds,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { opened, closed, closedRoundIds }
}
