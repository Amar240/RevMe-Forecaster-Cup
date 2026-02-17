export interface SessionUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

export interface SessionResponse {
  user: SessionUser
}
