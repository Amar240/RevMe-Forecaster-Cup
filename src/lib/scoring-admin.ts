export type AdminScoringScope = 'SEASON' | 'ROUND'

interface LegacyPreflightRound {
  roundNumber: number
  uploaded: number
  expected: number
  complete: boolean
}

interface ApiPreflightCheck {
  roundNumber: number
  teamsSubmitted: number
  totalActiveTeams: number
  actualsUploaded: number
  actualsExpected: number
  actualsComplete: boolean
}

type PreflightRound = LegacyPreflightRound | ApiPreflightCheck

interface LegacyPreflightPayload {
  rounds?: PreflightRound[]
  totalActiveTeams?: number
  teamsSubmitted?: number
  missedSubmissionWarnings?: number
  teamsAtRiskOfDQ?: number
  hasCriticalIssues?: boolean
}

interface ApiPreflightPayload {
  checks?: PreflightRound[]
  activeTeams?: number
  totalWarningsExpected?: number
  teamsAtRiskOfDQ?: number
  ready?: boolean
}

export interface PreflightDialogData {
  rounds: Array<{
    roundNumber: number
    uploaded: number
    expected: number
    complete: boolean
  }>
  totalActiveTeams: number
  teamsSubmitted: number
  missedSubmissionWarnings: number
  teamsAtRiskOfDQ: number
  hasCriticalIssues: boolean
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function normalizeScoringScope(value: unknown): AdminScoringScope | null {
  if (typeof value !== 'string') return null

  switch (value.toUpperCase()) {
    case 'SEASON':
    case 'ALL':
      return 'SEASON'
    case 'ROUND':
      return 'ROUND'
    default:
      return null
  }
}

export function normalizePreflightDialogData(value: unknown): PreflightDialogData | null {
  const payload = asObject(value) as (LegacyPreflightPayload & ApiPreflightPayload) | null
  if (!payload) return null

  const sourceRounds = Array.isArray(payload.rounds)
    ? payload.rounds
    : Array.isArray(payload.checks)
      ? payload.checks
      : null

  if (!sourceRounds) return null

  const rounds = sourceRounds
    .map((round) => {
      const data = asObject(round)
      if (!data) return null

      const roundNumber = asNumber(data.roundNumber)
      const uploaded = asNumber(data.uploaded) ?? asNumber(data.actualsUploaded)
      const expected = asNumber(data.expected) ?? asNumber(data.actualsExpected)
      const complete =
        typeof data.complete === 'boolean'
          ? data.complete
          : typeof data.actualsComplete === 'boolean'
            ? data.actualsComplete
            : null

      if (roundNumber === null || uploaded === null || expected === null || complete === null) {
        return null
      }

      return { roundNumber, uploaded, expected, complete }
    })
    .filter((round): round is NonNullable<typeof round> => round !== null)

  if (rounds.length !== sourceRounds.length) return null

  const totalActiveTeams =
    asNumber(payload.totalActiveTeams) ??
    asNumber(payload.activeTeams) ??
    Math.max(...sourceRounds.map((round) => asNumber(asObject(round)?.totalActiveTeams) ?? 0), 0)

  const teamsSubmitted =
    asNumber(payload.teamsSubmitted) ??
    (() => {
      const submissionCounts = sourceRounds
        .map((round) => asNumber(asObject(round)?.teamsSubmitted))
        .filter((count): count is number => count !== null)
      if (submissionCounts.length === 0) return 0
      return Math.min(...submissionCounts)
    })()

  const missedSubmissionWarnings =
    asNumber(payload.missedSubmissionWarnings) ??
    asNumber(payload.totalWarningsExpected) ??
    0

  const teamsAtRiskOfDQ = asNumber(payload.teamsAtRiskOfDQ) ?? 0
  const hasCriticalIssues =
    typeof payload.hasCriticalIssues === 'boolean'
      ? payload.hasCriticalIssues
      : typeof payload.ready === 'boolean'
        ? !payload.ready
        : rounds.some((round) => !round.complete)

  return {
    rounds,
    totalActiveTeams,
    teamsSubmitted,
    missedSubmissionWarnings,
    teamsAtRiskOfDQ,
    hasCriticalIssues,
  }
}
