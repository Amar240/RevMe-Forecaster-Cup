import { csrfFetch } from '@/lib/csrf'
import type { CurrentSubmissionResponse } from '@/features/submissions/types'

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || 'Request failed'
    const detail =
      data?.errors && Array.isArray(data.errors) && data.errors.length > 0
        ? ': ' +
          data.errors
            .map(
              (e: { message: string; path?: unknown[] }) =>
                `${e.path?.join('.') ?? 'field'} — ${e.message}`
            )
            .join('; ')
        : ''
    const error = new Error(message + detail)
    ;(error as Error & { status?: number }).status = res.status
    throw error
  }
  return data as T
}

export async function getCurrentSubmission(): Promise<CurrentSubmissionResponse | null> {
  const res = await csrfFetch('/api/submissions/current')
  if (res.status === 401) return null
  return parseJson<CurrentSubmissionResponse>(res)
}

export async function submitForecast(input: {
  roundId: string | null
  submissions: Array<{
    marketId: string
    weekOffset: number
    occupancy: number
    adr: number
  }>
}): Promise<{ message: string }> {
  const res = await csrfFetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<{ message: string }>(res)
}
