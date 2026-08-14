export type RoundStatus = 'UPCOMING' | 'OPEN' | 'PAUSED' | 'CLOSED'
export type SeasonStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
export type RoundAutomationMode = 'AUTOMATIC' | 'MANUAL'
export type RoundAutomationHealth = 'RUNNING' | 'ATTENTION_NEEDED' | 'SETUP_REQUIRED'

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
  health: RoundAutomationHealth
  displayMessage: string
  generation: number
  lastSyncedAt: string | null
  scheduleError: string | null
  scheduleSyncWarning?: string | null
  activeOverride: {
    id: string
    reason: string
    expectedEndAt: string | null
    activatedAt: string
    activatedBy: string | null
    extendedAt: string | null
    extendedBy: string | null
    extensionReason: string | null
    dueReminderSentAt: string | null
    escalationReminderSentAt: string | null
  } | null
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

export interface RoundAutomationResumePreview {
  seasonId: string
  seasonName: string
  fingerprint: string
  evaluatedAt: string
  generation: number
  nextGeneration: number
  activeOverride: {
    id: string
    reason: string
    expectedEndAt: string | null
    activatedAt: string
    activatedBy: string | null
  } | null
  currentRounds: Array<{
    id: string
    number: number
    status: RoundStatus
    opensAt: string
    closesAt: string
  }>
  impliedOpenRound: { id: string; number: number } | null
  roundsToOpen: Array<{ id: string; number: number }>
  roundsToClose: Array<{ id: string; number: number }>
  schedulesToReplace: number
  submissionsPermitted: boolean
}

export interface SeasonOverviewResponse {
  season: SeasonSummary | null
  completedSeasons: SeasonSummary[]
}
