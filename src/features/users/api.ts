import { csrfFetch } from '@/lib/csrf'
import type {
  AdminUsersResponse,
  CreateStudentResponse,
  ResetPasswordEmailResponse,
} from '@/features/users/types'

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || 'Request failed'
    const error = new Error(message)
    ;(error as Error & { status?: number }).status = res.status
    throw error
  }
  return data as T
}

export async function listUsers(query?: {
  page?: number
  pageSize?: number
  role?: 'STUDENT' | 'SUPERVISOR' | 'SUB_ADMIN' | 'ADMIN'
}) {
  const searchParams = new URLSearchParams()

  if (query?.page) {
    searchParams.set('page', String(query.page))
  }

  if (query?.pageSize) {
    searchParams.set('pageSize', String(query.pageSize))
  }

  if (query?.role) {
    searchParams.set('role', query.role)
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const res = await csrfFetch(`/api/admin/users${suffix}`)
  return parseJson<AdminUsersResponse>(res)
}

export async function createStudent(payload: {
  firstName: string
  lastName: string
  email: string
  universityId: string
}) {
  const res = await csrfFetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<CreateStudentResponse>(res)
}

export async function updateStudent(
  userId: string,
  payload: {
    firstName: string
    lastName: string
    email: string
    universityId: string
  }
) {
  const res = await csrfFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<{ user: AdminUsersResponse['users'][number] }>(res)
}

export async function setStudentActiveStatus(userId: string, isActive: boolean) {
  const res = await csrfFetch(`/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  })
  return parseJson<{ user: AdminUsersResponse['users'][number] }>(res)
}

export async function sendResetPasswordEmail(userId: string) {
  const res = await csrfFetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' })
  return parseJson<ResetPasswordEmailResponse>(res)
}

export async function forceLogout(userId: string) {
  const res = await csrfFetch(`/api/admin/users/${userId}/force-logout`, { method: 'POST' })
  return parseJson<{ message: string }>(res)
}
