import { prisma } from './db'

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

    let errorsUpserted = 0
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

          await prisma.predictionError.upsert({
            where: {
              seasonId_teamId_roundId_marketId_metric_weekOffset: {
                seasonId,
                teamId: submission.teamId,
                roundId: submission.roundId,
                marketId: value.marketId,
                metric: value.metric,
                weekOffset: value.weekOffset,
              },
            },
            update: {
              predictedValue: value.value,
              actualValue,
              absError,
              apeError,
              computedAt: new Date(),
              scoringRunId: scoringRun.id,
            },
            create: {
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
            },
          })
          errorsUpserted++
        }
      }
    }

    const aggregatesUpserted = await computeAggregates(seasonId, scoringRun.id, scope, roundId)

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

    const roundsWithActuals = new Set(actuals.map(a => a.roundId))
    for (const round of rounds) {
      if (roundsWithActuals.has(round.id)) {
        await prisma.round.update({
          where: { id: round.id },
          data: {
            isLockedActuals: true,
            lockedAt: new Date(),
            lockedById: adminId,
            scoresStale: false,
            lastScoredAt: new Date(),
            lastScoredById: adminId,
          },
        })
      }
    }

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

async function upsertScoreAggregate(
  data: {
    seasonId: string
    teamId: string
    metric: 'OCCUPANCY' | 'ADR'
    scopeType: 'SEASON' | 'ROUND' | 'MARKET_ROUND'
    roundId: string | null
    marketId: string | null
    mape: number
    nErrors: number
    scoringRunId: string
  }
): Promise<void> {
  const existing = await prisma.scoreAggregate.findFirst({
    where: {
      seasonId: data.seasonId,
      teamId: data.teamId,
      metric: data.metric,
      scopeType: data.scopeType,
      roundId: data.roundId,
      marketId: data.marketId,
    },
  })

  if (existing) {
    await prisma.scoreAggregate.update({
      where: { id: existing.id },
      data: {
        mape: data.mape,
        nErrors: data.nErrors,
        computedAt: new Date(),
        scoringRunId: data.scoringRunId,
      },
    })
  } else {
    await prisma.scoreAggregate.create({
      data: {
        seasonId: data.seasonId,
        teamId: data.teamId,
        metric: data.metric,
        scopeType: data.scopeType,
        roundId: data.roundId,
        marketId: data.marketId,
        mape: data.mape,
        nErrors: data.nErrors,
        scoringRunId: data.scoringRunId,
      },
    })
  }
}

async function computeAggregates(
  seasonId: string,
  scoringRunId: string,
  scope: 'SEASON' | 'ROUND',
  roundId?: string
): Promise<number> {
  let aggregatesUpserted = 0

  const errors = await prisma.predictionError.findMany({
    where: {
      seasonId,
      ...(scope === 'ROUND' && roundId ? { roundId } : {}),
    },
  })

  const teams = await prisma.team.findMany({
    where: {
      submissions: {
        some: {
          round: { seasonId },
        },
      },
    },
  })

  for (const team of teams) {
    const teamErrors = errors.filter((e) => e.teamId === team.id)

    for (const metric of ['OCCUPANCY', 'ADR'] as const) {
      const metricErrors = teamErrors.filter((e) => e.metric === metric)
      const validApeErrors = metricErrors.filter((e) => e.apeError !== null)

      if (validApeErrors.length > 0) {
        const mape = validApeErrors.reduce((sum, e) => sum + (e.apeError ?? 0), 0) / validApeErrors.length

        await upsertScoreAggregate({
          seasonId,
          teamId: team.id,
          metric,
          scopeType: 'SEASON',
          roundId: null,
          marketId: null,
          mape,
          nErrors: validApeErrors.length,
          scoringRunId,
        })
        aggregatesUpserted++
      }

      const roundGroups = new Map<string, typeof validApeErrors>()
      validApeErrors.forEach((e) => {
        const existing = roundGroups.get(e.roundId) || []
        existing.push(e)
        roundGroups.set(e.roundId, existing)
      })

      const roundEntries = Array.from(roundGroups.entries())
      for (const [rId, roundErrors] of roundEntries) {
        if (roundErrors.length > 0) {
          const roundMape = roundErrors.reduce((sum, e) => sum + (e.apeError ?? 0), 0) / roundErrors.length

          await upsertScoreAggregate({
            seasonId,
            teamId: team.id,
            metric,
            scopeType: 'ROUND',
            roundId: rId,
            marketId: null,
            mape: roundMape,
            nErrors: roundErrors.length,
            scoringRunId,
          })
          aggregatesUpserted++
        }
      }
    }
  }

  return aggregatesUpserted
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
