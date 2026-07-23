export interface RoundInfo {
  id: string
  number: number
  isFinal: boolean
  status: string
}

// Progression maps are keyed by round id. Use the `rounds` array for display labels like R1 and R2.
export type LeaderboardRoundProgression = Record<string, number>

export interface LeaderboardEntry {
  rank: number
  teamId: string
  teamName: string
  teamDisplayId: string
  university: string
  universityId: string
  mape: number | null
  nErrors: number | null
  roundScores: LeaderboardRoundProgression
  cumulativeScores: LeaderboardRoundProgression
  occupancyMape?: number | null
  adrMape?: number | null
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  seasonName: string
  myTeamId: string | null
  metric: 'OCCUPANCY' | 'ADR' | 'COMBINED'
  expectedErrors: number
  rounds: RoundInfo[]
  myPosition: { rank: number; percentile: number; gapToNext: number | null; rankMovement: number | null } | null
  nextUnpublishedRound: { id: string; number: number; status: string; closesAt: string } | null
}
