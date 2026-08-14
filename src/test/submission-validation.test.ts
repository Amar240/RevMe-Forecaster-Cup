import { describe, expect, it } from 'vitest'
import { getSubmissionMetricError } from '@/lib/submission-values'
import { predictionsBreakdownLabel, predictionsRequired } from '@/lib/competition-config'

describe('competition-config prediction counts', () => {
  it('computes 12 for a normal 3-market round and 6 for the final round', () => {
    expect(predictionsRequired(3, false)).toBe(12)
    expect(predictionsRequired(3, true)).toBe(6)
  })

  it('labels the breakdown with the correct week count and pluralization', () => {
    expect(predictionsBreakdownLabel(3, false)).toBe('12 predictions (3 markets × 2 weeks × 2 metrics)')
    expect(predictionsBreakdownLabel(3, true)).toBe('6 predictions (3 markets × 1 week × 2 metrics)')
  })
})

describe('getSubmissionMetricError', () => {
  it('returns null for an empty field (incomplete, not an error)', () => {
    expect(getSubmissionMetricError('OCCUPANCY', '')).toBeNull()
    expect(getSubmissionMetricError('ADR', '   ')).toBeNull()
  })

  it('flags non-numeric input with a metric-specific hint', () => {
    expect(getSubmissionMetricError('OCCUPANCY', 'abc')).toMatch(/number between 0 and 100/i)
    expect(getSubmissionMetricError('ADR', '9o9')).toMatch(/189\.50/)
  })

  it('flags out-of-range values', () => {
    expect(getSubmissionMetricError('OCCUPANCY', '150')).toMatch(/between 0 and 100/i)
    expect(getSubmissionMetricError('OCCUPANCY', '-5')).toMatch(/between 0 and 100/i)
    expect(getSubmissionMetricError('ADR', '0')).toMatch(/greater than 0/i)
    expect(getSubmissionMetricError('ADR', '-10')).toMatch(/greater than 0/i)
  })

  it('accepts valid values', () => {
    expect(getSubmissionMetricError('OCCUPANCY', '72.5')).toBeNull()
    expect(getSubmissionMetricError('OCCUPANCY', '0')).toBeNull()
    expect(getSubmissionMetricError('OCCUPANCY', '100')).toBeNull()
    expect(getSubmissionMetricError('ADR', '189.50')).toBeNull()
  })
})
