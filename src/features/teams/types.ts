export type TeamStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
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
  status: TeamStatus
  university: { id: string; name: string }
  supervisor: { id: string; firstName: string; lastName: string; email: string }
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
  members: { user: { firstName: string; lastName: string; email: string } }[]
  season: { name: string } | null
}

export interface PendingTeamsResponse {
  teams: PendingTeam[]
}
