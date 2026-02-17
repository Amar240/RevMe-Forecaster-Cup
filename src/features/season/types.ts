export type RoundStatus = 'UPCOMING' | 'OPEN' | 'PAUSED' | 'CLOSED'
export type SeasonStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'

export interface SeasonRound {
  id: string
  number: number
  opensAt: string
  closesAt: string
  isFinal: boolean
  status: RoundStatus
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
  startDate: string
  endDate: string
  rounds: SeasonRound[]
  markets: SeasonMarket[]
  _count?: { teams: number }
}

export interface SeasonOverviewResponse {
  season: SeasonSummary | null
  completedSeasons: SeasonSummary[]
}
