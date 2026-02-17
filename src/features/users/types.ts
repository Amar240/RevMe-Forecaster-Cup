export interface AdminUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'ADMIN' | 'SUPERVISOR' | 'STUDENT' | 'SUB_ADMIN'
  university: { name: string } | null
  teamMemberships: { team: { name: string } }[]
  createdAt: string
}

export interface AdminUsersResponse {
  users: AdminUser[]
  total: number
  page: number
  pageSize: number
}

export interface ResetLinkResponse {
  resetLink: string
}
