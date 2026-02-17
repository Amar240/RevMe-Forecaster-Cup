import { csrfFetch } from '@/lib/csrf'
import type { LeaderboardResponse } from '@/features/leaderboards/types'

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

export async function getLeaderboard(metric: 'OCCUPANCY' | 'ADR' | 'COMBINED') {
  const res = await csrfFetch(`/api/leaderboards?metric=${metric}`)
  return parseJson<LeaderboardResponse>(res)
}
