import { prisma } from './db'
import type { Metric, Prisma } from '@prisma/client'

export interface ScoringResult {
  scoringRunId: string
  submissionsProcessed: number
  errorsUpserted: number
  aggregatesUpserted: number
  status: 'SUCCESS' | 'FAILED'
  errorMessage?: string
  warnings?: string[]
}

export async function runScoring(
  seasonId: string,
  adminId: string,
  scope: 'SEASON' | 'ROUND' = 'SEASON',
  roundId?: string
): Promise<ScoringResult> {
  const scoringRun = await prisma.scoringRun.create({
    data: {
      seasonId,
      triggeredByAdminId: adminId,
      scope,
      roundId: scope === 'ROUND' ? roundId : null,
      status: 'RUNNING',
    },
  })

  const warnings: string[] = []

  try {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        rounds: true,
        markets: { include: { market: true } },
      },
    })

    if (!season) {
      throw new Error('Season not found')
    }

    const roundFilter = scope === 'ROUND' && roundId ? { id: roundId } : {}
    const rounds = await prisma.round.findMany({
      where: { seasonId, ...roundFilter },
      orderBy: { number: 'asc' },
    })

    const submissions = await prisma.submission.findMany({
      where: {
        round: { seasonId },
        ...(scope === 'ROUND' && roundId ? { roundId } : {}),
      },
      include: {
        values: true,
        round: true,
        team: true,
      },
    })

    const actuals = await prisma.actual.findMany({
      where: { 
        seasonId,
        isVoided: false,
      },
    })

    const actualMap = new Map<string, number>()
    actuals.forEach((a) => {
      const key = `${a.roundId}-${a.marketId}-${a.metric}-${a.weekOffset}`
      actualMap.set(key, a.value)
    })

    const roundActualsVersions = new Map<string, number>()
    for (const round of rounds) {
      roundActualsVersions.set(round.id, round.actualsVersion)
    }

    const errorRows: Prisma.PredictionErrorCreateManyInput[] = []
    let submissionsProcessed = 0

    for (const submission of submissions) {
      submissionsProcessed++

      for (const value of submission.values) {
        const actualKey = `${submission.roundId}-${value.marketId}-${value.metric}-${value.weekOffset}`
        const actualValue = actualMap.get(actualKey)

        if (actualValue !== undefined) {
          const absError = Math.abs(value.value - actualValue)

          let apeError: number | null = null

          if (actualValue === 0) {
            if (value.value === 0) {
              apeError = 0
            } else {
              apeError = null
              warnings.push(
                `Team ${submission.team.name}: actual=0 for ${value.metric} ` +
                `(Round ${submission.round.number}, Week+${value.weekOffset}), ` +
                `predicted=${value.value} - excluded from MAPE`
              )
            }
          } else {
            apeError = absError / actualValue
          }

          errorRows.push({
              seasonId,
              teamId: submission.teamId,
              roundId: submission.roundId,
              marketId: value.marketId,
              metric: value.metric,
              weekOffset: value.weekOffset,
              predictedValue: value.value,
              actualValue,
              absError,
              apeError,
              scoringRunId: scoringRun.id,
          })
        }
      }
    }

    const aggregatesUpserted = await prisma.$transaction(async (tx) => {
      await tx.predictionError.deleteMany({
        where: { seasonId, ...(scope === 'ROUND' && roundId ? { roundId } : {}) },
      })
      if (errorRows.length > 0) await tx.predictionError.createMany({ data: errorRows })
      return computeAggregates(tx, seasonId, scoringRun.id, scope, roundId)
    })
    const errorsUpserted = errorRows.length

    const totalActualsVersion = Array.from(roundActualsVersions.values()).reduce((a, b) => a + b, 0)

    await prisma.scoringRun.update({
      where: { id: scoringRun.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        submissionsProcessed,
        errorsUpserted,
        aggregatesUpserted,
        actualsVersionAtRun: totalActualsVersion,
        summaryJson: {
          roundsScored: rounds.map(r => r.id),
          roundVersions: Object.fromEntries(roundActualsVersions),
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      },
    })

    return {
      scoringRunId: scoringRun.id,
      submissionsProcessed,
      errorsUpserted,
      aggregatesUpserted,
      status: 'SUCCESS',
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await prisma.scoringRun.update({
      where: { id: scoringRun.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorMessage,
      },
    })

    return {
      scoringRunId: scoringRun.id,
      submissionsProcessed: 0,
      errorsUpserted: 0,
      aggregatesUpserted: 0,
      status: 'FAILED',
      errorMessage,
    }
  }
}

async function computeAggregates(
  tx: Prisma.TransactionClient,
  seasonId: string,
  scoringRunId: string,
  scope: 'SEASON' | 'ROUND',
  roundId?: string
): Promise<number> {
  // Season aggregates must always use the complete season error set, including
  // when only one round was rescored.
  const errors = await tx.predictionError.findMany({ where: { seasonId } })
  const aggregateRows: Prisma.ScoreAggregateCreateManyInput[] = []
  const teamIds = [...new Set(errors.map((error) => error.teamId))]

  for (const teamId of teamIds) {
    const teamErrors = errors.filter((error) => error.teamId === teamId)

    for (const metric of ['OCCUPANCY', 'ADR'] as Metric[]) {
      const metricErrors = teamErrors.filter((e) => e.metric === metric)
      const validApeErrors = metricErrors.filter((e) => e.apeError !== null)

      if (validApeErrors.length > 0) {
        const mape = validApeErrors.reduce((sum, e) => sum + (e.apeError ?? 0), 0) / validApeErrors.length

        aggregateRows.push({
          seasonId,
          teamId,
          metric,
          scopeType: 'SEASON',
          roundId: null,
          marketId: null,
          mape,
          nErrors: validApeErrors.length,
          scoringRunId,
        })
      }

      const roundGroups = new Map<string, typeof validApeErrors>()
      validApeErrors.forEach((e) => {
        const existing = roundGroups.get(e.roundId) || []
        existing.push(e)
        roundGroups.set(e.roundId, existing)
      })

      for (const [rId, roundErrors] of roundGroups.entries()) {
        if (scope === 'ROUND' && roundId && rId !== roundId) continue
        if (roundErrors.length > 0) {
          const roundMape = roundErrors.reduce((sum, e) => sum + (e.apeError ?? 0), 0) / roundErrors.length

          aggregateRows.push({
            seasonId,
            teamId,
            metric,
            scopeType: 'ROUND',
            roundId: rId,
            marketId: null,
            mape: roundMape,
            nErrors: roundErrors.length,
            scoringRunId,
          })
        }
      }
    }
  }

  await tx.scoreAggregate.deleteMany({
    where: {
      seasonId,
      OR: [
        { scopeType: 'SEASON' },
        ...(scope === 'ROUND' && roundId ? [{ scopeType: 'ROUND' as const, roundId }] : [{ scopeType: 'ROUND' as const }]),
      ],
    },
  })
  if (aggregateRows.length > 0) await tx.scoreAggregate.createMany({ data: aggregateRows })
  return aggregateRows.length
}

export function getExpectedPredictions(roundNumber: number): number {
  if (roundNumber === 7) {
    return 3 * 2 * 1
  }
  return 3 * 2 * 2
}

export function getTotalExpectedPredictions(): number {
  return (6 * 12) + 6
}
