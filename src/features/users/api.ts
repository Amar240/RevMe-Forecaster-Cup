import { csrfFetch } from '@/lib/csrf'
import type { AdminUsersResponse, ResetLinkResponse } from '@/features/users/types'

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

export async function listUsers(params: { page: number; pageSize: number }) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  const res = await csrfFetch(`/api/admin/users?${query.toString()}`)
  return parseJson<AdminUsersResponse>(res)
}

export async function changeUserRole(userId: string, role: string) {
  const res = await csrfFetch(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  return parseJson<{ message: string }>(res)
}

export async function generateResetLink(userId: string) {
  const res = await csrfFetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' })
  return parseJson<ResetLinkResponse>(res)
}

export async function forceLogout(userId: string) {
  const res = await csrfFetch(`/api/admin/users/${userId}/force-logout`, { method: 'POST' })
  return parseJson<{ message: string }>(res)
}

export async function deleteUser(userId: string) {
  const res = await csrfFetch(`/api/admin/users/${userId}/delete`, { method: 'DELETE' })
  return parseJson<{ message: string }>(res)
}
