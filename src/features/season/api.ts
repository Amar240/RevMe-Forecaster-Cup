import { csrfFetch } from '@/lib/csrf'
import type { CreateSeasonInput } from '@/features/season/schema'
import type { SeasonOverviewResponse } from '@/features/season/types'

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

export async function getSeasonOverview(): Promise<SeasonOverviewResponse> {
  const res = await csrfFetch('/api/admin/season')
  return parseJson<SeasonOverviewResponse>(res)
}

export async function createSeason(input: CreateSeasonInput): Promise<SeasonOverviewResponse> {
  const res = await csrfFetch('/api/admin/season', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<SeasonOverviewResponse>(res)
}

export async function updateSeasonStatus(
  action: 'start' | 'pause' | 'resume' | 'complete',
  seasonId?: string
): Promise<{ message: string }> {
  const res = await csrfFetch('/api/admin/season/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, seasonId }),
  })
  return parseJson<{ message: string }>(res)
}

export async function updateRoundStatus(input: {
  roundId: string
  status: 'UPCOMING' | 'OPEN' | 'PAUSED' | 'CLOSED'
  opensAt?: string
  closesAt?: string
}): Promise<{ message: string }> {
  const res = await csrfFetch(`/api/admin/rounds/${input.roundId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: input.status,
      opensAt: input.opensAt,
      closesAt: input.closesAt,
    }),
  })
  return parseJson<{ message: string }>(res)
}
