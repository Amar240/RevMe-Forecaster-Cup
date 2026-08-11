export type RoundStatus = 'UPCOMING' | 'OPEN' | 'PAUSED' | 'CLOSED'
export type SeasonStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
export type RoundAutomationMode = 'AUTOMATIC' | 'MANUAL'

export interface SeasonRound {
  id: string
  number: number
  opensAt: string
  closesAt: string
  isFinal: boolean
  status: RoundStatus
  leaderboardVisible: boolean
}

export interface SeasonMarket {
  id: string
  market: { id: string; name: string }
  isActive: boolean
}

export interface SeasonSummary {
  id: string
  name: string
  status: SeasonStatus
  registrationOpen: boolean
  roundAutomationMode: RoundAutomationMode
  roundAutomationGeneration: number
  roundAutomationLastSyncedAt: string | null
  roundAutomationScheduleError: string | null
  startDate: string
  endDate: string
  rounds: SeasonRound[]
  markets: SeasonMarket[]
  _count?: { teams: number }
}

export interface RoundAutomationStatus {
  seasonId: string
  mode: RoundAutomationMode
  generation: number
  lastSyncedAt: string | null
  scheduleError: string | null
  scheduleSyncWarning?: string | null
  infrastructure: {
    configured: boolean
    region: string
    groupName: string
    missing: string[]
  }
  nextTransition: {
    type: 'OPEN' | 'CLOSE'
    at: string
    roundId: string
    roundNumber: number
  } | null
  latestRun: {
    outcome: 'APPLIED' | 'NO_CHANGE' | 'SKIPPED' | 'FAILED'
    trigger: 'SCHEDULED' | 'ADMIN' | 'MODE_CHANGE' | 'RECOVERY'
    processedAt: string
    errorMessage: string | null
  } | null
}

export interface SeasonOverviewResponse {
  season: SeasonSummary | null
  completedSeasons: SeasonSummary[]
}
