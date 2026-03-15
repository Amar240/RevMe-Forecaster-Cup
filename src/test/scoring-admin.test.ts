import { describe, expect, it } from 'vitest'
import { normalizePreflightDialogData, normalizeScoringScope } from '@/lib/scoring-admin'

describe('normalizeScoringScope', () => {
  it('accepts current UI and canonical API scope values', () => {
    expect(normalizeScoringScope('SEASON')).toBe('SEASON')
    expect(normalizeScoringScope('ROUND')).toBe('ROUND')
    expect(normalizeScoringScope('all')).toBe('SEASON')
    expect(normalizeScoringScope('round')).toBe('ROUND')
  })

  it('rejects invalid scope values', () => {
    expect(normalizeScoringScope('team')).toBeNull()
    expect(normalizeScoringScope(undefined)).toBeNull()
  })
})

describe('normalizePreflightDialogData', () => {
  it('normalizes the current scoring preflight API payload', () => {
    const normalized = normalizePreflightDialogData({
      ready: false,
      activeTeams: 4,
      totalWarningsExpected: 2,
      teamsAtRiskOfDQ: 1,
      checks: [
        {
          roundNumber: 1,
          actualsUploaded: 10,
          actualsExpected: 12,
          actualsComplete: false,
          teamsSubmitted: 3,
          totalActiveTeams: 4,
        },
        {
          roundNumber: 2,
          actualsUploaded: 12,
          actualsExpected: 12,
          actualsComplete: true,
          teamsSubmitted: 4,
          totalActiveTeams: 4,
        },
      ],
    })

    expect(normalized).toEqual({
      rounds: [
        { roundNumber: 1, uploaded: 10, expected: 12, complete: false },
        { roundNumber: 2, uploaded: 12, expected: 12, complete: true },
      ],
      totalActiveTeams: 4,
      teamsSubmitted: 3,
      missedSubmissionWarnings: 2,
      teamsAtRiskOfDQ: 1,
      hasCriticalIssues: true,
    })
  })

  it('keeps compatibility with the dialog legacy shape', () => {
    const normalized = normalizePreflightDialogData({
      rounds: [{ roundNumber: 7, uploaded: 6, expected: 6, complete: true }],
      totalActiveTeams: 5,
      teamsSubmitted: 5,
      missedSubmissionWarnings: 0,
      teamsAtRiskOfDQ: 0,
      hasCriticalIssues: false,
    })

    expect(normalized).toEqual({
      rounds: [{ roundNumber: 7, uploaded: 6, expected: 6, complete: true }],
      totalActiveTeams: 5,
      teamsSubmitted: 5,
      missedSubmissionWarnings: 0,
      teamsAtRiskOfDQ: 0,
      hasCriticalIssues: false,
    })
  })
})
