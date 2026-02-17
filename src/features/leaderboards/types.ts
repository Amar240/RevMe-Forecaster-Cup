export interface RoundInfo {
  id: string
  number: number
  isFinal: boolean
  status: string
}

export interface LeaderboardEntry {
  rank: number
  teamId: string
  teamName: string
  teamDisplayId: string
  university: string
  universityId: string
  mape: number | null
  nErrors: number | null
  roundScores: Record<string, number>
  cumulativeScores: Record<string, number>
  occupancyMape?: number | null
  adrMape?: number | null
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  seasonName: string
  myTeamId: string | null
  metric: 'OCCUPANCY' | 'ADR'
  expectedErrors: number
  rounds: RoundInfo[]
}
