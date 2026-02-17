import { csrfFetch } from '@/lib/csrf'
import type { SupervisorResponse, TicketResponse, TicketsResponse } from '@/features/support/types'

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

export async function getSupportTickets(): Promise<TicketsResponse> {
  const res = await csrfFetch('/api/support-tickets')
  return parseJson<TicketsResponse>(res)
}

export async function getSupportTicket(id: string): Promise<TicketResponse> {
  const res = await csrfFetch(`/api/support-tickets/${id}`)
  return parseJson<TicketResponse>(res)
}

export async function createSupportTicket(input: {
  category: string
  subject: string
  message: string
}): Promise<TicketResponse> {
  const res = await csrfFetch('/api/support-tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<TicketResponse>(res)
}

export async function replyToTicket(input: { id: string; message: string }) {
  const res = await csrfFetch(`/api/support-tickets/${input.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reply', message: input.message }),
  })
  return parseJson<{ message: string }>(res)
}

export async function submitTicketFeedback(input: { id: string; feedbackRating: boolean }) {
  const res = await csrfFetch(`/api/support-tickets/${input.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'feedback', feedbackRating: input.feedbackRating }),
  })
  return parseJson<{ message: string }>(res)
}

export async function getSupervisorInfo(): Promise<SupervisorResponse> {
  const res = await csrfFetch('/api/user/supervisor')
  return parseJson<SupervisorResponse>(res)
}
