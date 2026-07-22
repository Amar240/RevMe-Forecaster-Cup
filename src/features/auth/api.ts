import { csrfFetch } from '@/lib/csrf'
import type { SessionResponse } from '@/features/auth/types'

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

export async function getCurrentSession(): Promise<SessionResponse | null> {
  const res = await csrfFetch('/api/auth/me')
  if (res.status === 401) return null
  return parseJson<SessionResponse>(res)
}

export async function disconnectGoogle() {
  const response = await csrfFetch('/api/users/oauth/google', { method: 'DELETE' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Failed to disconnect Google')
  return data
}
