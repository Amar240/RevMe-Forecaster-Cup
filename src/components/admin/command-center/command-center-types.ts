export interface DashboardData {
  activeSeason: {
    id: string
    name: string
    status: string
  } | null
  currentRound: {
    id: string
    number: number
    opensAt: string
    closesAt: string
    status: string
    leaderboardReviewed: boolean
    participantsNotified: boolean
  } | null
  stats: {
    totalTeams: number
    activeTeams: number
    disqualifiedTeams: number
    totalUsers: number
    totalSubmissions: number
    currentRoundSubmissions: number
    totalWarnings: number
    teamsWithActuals: number
    scoredSubmissions: number
    oneWarningTeams: number
    twoWarningTeams: number
  }
  meta: {
    weekOffsets: number[]
    lastScoredAt: string | null
    lastActualsUploadAt: string | null
    expectedErrors: number | null
    pendingTeamApprovals: number | null
    activeMarketCount: number
  }
  submissionProgress: {
    submitted: number
    pending: number
    total: number
  }
  rounds: RoundEntry[]
  runbook: Array<{
    id: string
    number: number
    timing: 'current' | 'next'
    items: Array<{
      key: string
      label: string
      detail: string
      status: 'done' | 'pending' | 'blocked'
      href: string
    }>
  }>
}

export interface RoundEntry {
  id: string
  number: number
  opensAt: string
  closesAt: string
  status: string
  submissionCount: number
  hasActuals: boolean
  isScored: boolean
}

export function getCountdown(closesAt?: string | null): string {
  if (!closesAt) return 'Not scheduled'
  const diffMs = new Date(closesAt).getTime() - Date.now()
  if (diffMs <= 0) return 'Closed'
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return `${diffHours}h ${diffMinutes}m`
}
