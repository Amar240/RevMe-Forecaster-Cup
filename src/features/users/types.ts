export interface AdminUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'ADMIN' | 'SUPERVISOR' | 'STUDENT' | 'SUB_ADMIN'
  isActive: boolean
  canDelete: boolean
  deleteBlockedReason?: string | null
  universityId: string | null
  university: { id: string; name: string } | null
  teamMemberships: { id: string; isSubmitter: boolean; team: { id: string; name: string; displayId: string } }[]
  _count: {
    supervisedTeams: number
    submissions: number
    teamMemberships: number
    joinRequestsAsStudent: number
    joinRequestsAsSupervisor: number
    supportTicketsCreated: number
    supportTicketsAsSupervisor: number
    supportTicketsAssigned: number
    supportTicketsEscalated: number
    ticketReplies: number
  }
  createdAt: string
}

export interface AdminUsersResponse {
  users: AdminUser[]
  total: number
  page: number
  pageSize: number
  summary?: {
    totalUsers: number
    studentCount: number
    supervisorCount: number
    subAdminCount: number
    adminCount: number
    inactiveCount: number
  }
}

export interface ResetPasswordEmailResponse {
  emailSent: boolean
  message: string
}

export interface CreateStudentResponse {
  user: AdminUser
  emailSent: boolean
  devPassword: string | null
}
