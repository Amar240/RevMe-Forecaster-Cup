export type TeamStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'REJECTED'
  | 'DISQUALIFIED'

export interface TeamMember {
  id: string
  isSubmitter: boolean
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

export interface TeamSummary {
  id: string
  name: string
  displayId: string
  externalTeamId?: string | null
  status: TeamStatus
  university: { id: string; name: string }
  supervisor: { id: string; firstName: string; lastName: string; email: string } | null
  members: TeamMember[]
  _count: { submissions: number; warnings: number }
}

export interface TeamsResponse {
  teams: TeamSummary[]
}

export interface PendingTeam {
  id: string
  name: string
  displayId: string
  createdAt: string
  supervisor: { firstName: string; lastName: string; email: string }
  university: { name: string }
  members: {
    id: string
    isSubmitter: boolean
    user: { id: string; firstName: string; lastName: string; email: string }
  }[]
  season: { name: string } | null
  importBatch?: { id: string; fileName: string; createdAt: string; status: string } | null
}

export interface PendingTeamsResponse {
  teams: PendingTeam[]
  groups: Array<{ batch: { id: string; fileName: string; createdAt: string; status: string }; teams: PendingTeam[] }>
  unbatched: PendingTeam[]
}
