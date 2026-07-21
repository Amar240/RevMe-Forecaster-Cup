export interface MarketInfo {
  id: string
  name: string
}

export interface RoundInfo {
  id: string
  number: number
  opensAt: string
  closesAt: string
  isFinal: boolean
  status?: 'UPCOMING' | 'OPEN' | 'PAUSED' | 'CLOSED'
}

export interface ExistingSubmission {
  marketId: string
  weekOffset: number
  occupancy: number
  adr: number
}

export type LockReason =
  | 'SEASON_NOT_ACTIVE'
  | 'ROUND_NOT_OPEN'
  | 'ROUND_PAUSED'
  | 'ROUND_CLOSED'
  | 'DEADLINE_PASSED'
  | 'NO_ACTIVE_ROUND'
  | 'INVALID_MARKETS'
  | null

export interface CurrentSubmissionResponse {
  context?: { userId: string; teamId: string; seasonId: string }
  currentRound: RoundInfo | null
  markets: MarketInfo[]
  existingSubmissions: ExistingSubmission[]
  canSubmit: boolean
  seasonStatus: string | null
  lockReason: LockReason
  evidenceByMarket?: Record<string, {
    actuals: Array<{ metric: 'OCCUPANCY' | 'ADR'; weekOffset: number; value: number; roundNumber: number }>
    lastActual: { occupancy: number | null; adr: number | null }
    trailingAverage: { occupancy: number | null; adr: number | null }
    latestError: { metric: 'OCCUPANCY' | 'ADR'; direction: 'OVER' | 'UNDER' | 'EXACT'; apeError: number | null; roundNumber: number } | null
    marketInfo: { summary: string | null; quickInsights: unknown; resourceLinks: Array<{ id: string; label: string; url: string; type: string; note: string | null }> } | null
    roundUpdate: { headline: string; whatChanged: string } | null
  }>
}
