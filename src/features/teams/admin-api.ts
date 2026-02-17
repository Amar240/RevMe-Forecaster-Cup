import { csrfFetch } from '@/lib/csrf'
import type { PendingTeamsResponse } from '@/features/teams/types'

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

export async function getPendingTeams(): Promise<PendingTeamsResponse> {
  const res = await csrfFetch('/api/admin/teams/pending')
  return parseJson<PendingTeamsResponse>(res)
}

export async function approveTeam(teamId: string): Promise<{ message: string }> {
  const res = await csrfFetch('/api/admin/teams/pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, action: 'approve' }),
  })
  return parseJson<{ message: string }>(res)
}

export async function rejectTeam(teamId: string, reason?: string): Promise<{ message: string }> {
  const res = await csrfFetch('/api/admin/teams/pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, action: 'reject', reason }),
  })
  return parseJson<{ message: string }>(res)
}
