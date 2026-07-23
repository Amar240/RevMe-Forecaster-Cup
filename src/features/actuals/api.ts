import { csrfFetch } from '@/lib/csrf'
import type { ActualDetailsResponse, ActualImportOverride, ActualImportPreview, ActualsResponse, ActualsSummaryResponse } from '@/features/actuals/types'

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

export async function getActuals(params: { includeVoided: boolean; page: number; pageSize: number }) {
  const query = new URLSearchParams({
    includeVoided: String(params.includeVoided),
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  const res = await csrfFetch(`/api/admin/actuals?${query.toString()}`)
  return parseJson<ActualsResponse>(res)
}

export async function getActualsSummary(params: { includeVoided: boolean }) {
  const query = new URLSearchParams({
    includeVoided: String(params.includeVoided),
  })
  const res = await csrfFetch(`/api/admin/actuals/summary?${query.toString()}`)
  return parseJson<ActualsSummaryResponse>(res)
}

export async function getActualById(id: string) {
  const res = await csrfFetch(`/api/admin/actuals/${id}`)
  return parseJson<ActualDetailsResponse>(res)
}

export async function createActual(input: {
  roundId: string
  marketId: string
  weekOffset: number
  metric: 'OCCUPANCY' | 'ADR'
  value: number
  source?: 'MANUAL' | 'BULK'
  reason?: string
}) {
  const res = await csrfFetch('/api/admin/actuals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<{ message: string }>(res)
}

export async function updateActual(id: string, input: { value: number; reason?: string }) {
  const res = await csrfFetch(`/api/admin/actuals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<{ message: string }>(res)
}

export async function voidActual(id: string, input: { reason?: string }) {
  const res = await csrfFetch(`/api/admin/actuals/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<{ message: string }>(res)
}

export async function unvoidActual(id: string, input?: { reason?: string }) {
  const res = await csrfFetch(`/api/admin/actuals/${id}/unvoid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  })
  return parseJson<{ message: string }>(res)
}

export async function lockRoundActuals(roundId: string) {
  const res = await csrfFetch(`/api/admin/rounds/${roundId}/lock`, { method: 'POST' })
  return parseJson<{ message: string }>(res)
}

export async function unlockRoundActuals(roundId: string, reason: string) {
  const res = await csrfFetch(`/api/admin/rounds/${roundId}/lock`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  return parseJson<{ message: string }>(res)
}

function actualImportForm(file: File, overrides: ActualImportOverride[], extra?: { fileHash?: string; reason?: string }) {
  const form = new FormData()
  form.set('file', file)
  form.set('overrides', JSON.stringify(overrides))
  if (extra?.fileHash) form.set('fileHash', extra.fileHash)
  if (extra?.reason) form.set('reason', extra.reason)
  return form
}

export async function previewActualsFile(file: File, overrides: ActualImportOverride[] = []) {
  const res = await csrfFetch('/api/admin/actuals/import/preview', {
    method: 'POST',
    body: actualImportForm(file, overrides),
  })
  return parseJson<ActualImportPreview>(res)
}

export async function confirmActualsFile(file: File, fileHash: string, overrides: ActualImportOverride[], reason?: string) {
  const res = await csrfFetch('/api/admin/actuals/import/confirm', {
    method: 'POST',
    body: actualImportForm(file, overrides, { fileHash, reason }),
  })
  return parseJson<{ message: string; summary: ActualImportPreview['summary'] & { writtenRows: number } }>(res)
}
