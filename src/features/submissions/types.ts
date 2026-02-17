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
  currentRound: RoundInfo | null
  markets: MarketInfo[]
  existingSubmissions: ExistingSubmission[]
  canSubmit: boolean
  seasonStatus: string | null
  lockReason: LockReason
}
