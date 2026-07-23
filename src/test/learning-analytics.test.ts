import { describe, expect, it } from 'vitest'
import { competitionRanks, detectBias, detectConsecutiveBias, detectHorizonGap, detectImprovingStreak, formatMape, insightTakeaway, percentError, scoreDistribution, selectCalls } from '@/lib/learning-analytics'

describe('learning analytics', () => {
  it('uses competition ranks and percentiles with ties', () => {
    expect(competitionRanks([{ teamId: 'a', score: 0.1 }, { teamId: 'b', score: 0.2 }, { teamId: 'c', score: 0.2 }])).toEqual([
      { teamId: 'a', score: 0.1, rank: 1, percentile: 100 },
      { teamId: 'b', score: 0.2, rank: 2, percentile: 0 },
      { teamId: 'c', score: 0.2, rank: 2, percentile: 0 },
    ])
  })

  it('handles distributions and zero actuals', () => {
    expect(scoreDistribution([1, 2, 3, 4])).toEqual({ q1: 1.75, median: 2.5, q3: 3.25 })
    expect(percentError(10, 0)).toBeNull()
    expect(formatMape(null)).toBe('—')
    expect(formatMape(0.0684)).toBe('6.84%')
  })

  it('detects repeated directional bias and best calls', () => {
    const errors = [1, 2, 3].map((roundNumber, index) => ({ marketId: 'm', marketName: 'Dubai', metric: 'ADR' as const, weekOffset: 1, predictedValue: 110 + index, actualValue: 100, apeError: 0.1 + index / 100, roundNumber }))
    const bias = detectBias(errors)[0]
    expect(bias.direction).toBe('OVER')
    expect(insightTakeaway({ bias })).toContain('over-forecast Dubai ADR')
    expect(selectCalls(errors).best?.roundNumber).toBe(1)
    expect(selectCalls(errors).largestMiss?.roundNumber).toBe(3)
  })

  it('requires consecutive published rounds for directional patterns', () => {
    const row = (roundNumber: number, predictedValue: number) => ({ marketId: 'm', marketName: 'Dubai', metric: 'ADR' as const, weekOffset: 1, predictedValue, actualValue: 100, apeError: Math.abs(predictedValue - 100) / 100, roundNumber })
    expect(detectConsecutiveBias([row(1, 110), row(2, 90), row(3, 110), row(4, 110), row(5, 110)])[0]).toMatchObject({ direction: 'OVER', observations: 3 })
    expect(detectConsecutiveBias([row(1, 110), row(2, 110), row(3, 90)])).toEqual([])
  })

  it('detects horizon gaps and improving streaks deterministically', () => {
    const errors = [
      { marketId: 'm', metric: 'ADR' as const, weekOffset: 1, predictedValue: 105, actualValue: 100, apeError: 0.05 },
      { marketId: 'm', metric: 'ADR' as const, weekOffset: 2, predictedValue: 120, actualValue: 100, apeError: 0.2 },
    ]
    const horizon = detectHorizonGap(errors)
    expect(horizon).toMatchObject({ horizonOne: 0.05, horizonTwo: 0.2, needsAttention: true })
    expect(horizon?.gap).toBeCloseTo(0.15)
    expect(detectImprovingStreak([{ roundNumber: 1, score: 0.3 }, { roundNumber: 2, score: 0.2 }, { roundNumber: 3, score: 0.1 }])).toEqual({ length: 3, improving: true })
  })
})
