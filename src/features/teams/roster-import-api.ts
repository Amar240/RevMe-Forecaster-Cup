import { csrfFetch } from '@/lib/csrf'
import type { TeamImportColumnMapping, TeamImportOverride } from '@/lib/team-import/types'

async function parse<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Roster import request failed')
  return data as T
}

function form(file: File, options?: { batchId?: string; fileHash?: string; overrides?: TeamImportOverride[]; columnMapping?: TeamImportColumnMapping | null }) {
  const data = new FormData()
  data.append('file', file)
  if (options?.batchId) data.append('batchId', options.batchId)
  if (options?.fileHash) data.append('fileHash', options.fileHash)
  data.append('overrides', JSON.stringify(options?.overrides ?? []))
  if (options?.columnMapping) data.append('columnMapping', JSON.stringify(options.columnMapping))
  return data
}

export async function previewSupervisorRoster<T>(file: File, options?: { batchId?: string; fileHash?: string; overrides?: TeamImportOverride[]; columnMapping?: TeamImportColumnMapping | null }) { return parse<T>(await csrfFetch('/api/supervisor/roster-import/preview', { method: 'POST', body: form(file, options) })) }
export async function confirmSupervisorRoster<T>(batchId: string, fileHash: string, file: File, overrides: TeamImportOverride[], columnMapping?: TeamImportColumnMapping | null) { return parse<T>(await csrfFetch('/api/supervisor/roster-import/confirm', { method: 'POST', body: form(file, { batchId, fileHash, overrides, columnMapping }) })) }
export async function getSupervisorRosterHistory<T>() { return parse<T>(await csrfFetch('/api/supervisor/roster-import')) }
export async function requestImportLayoutAssist<T>(file: File, options?: { batchId?: string; fileHash?: string }) { return parse<T>(await csrfFetch('/api/supervisor/roster-import/assist/layout', { method: 'POST', body: form(file, options) })) }
export async function requestImportRepairAssist<T>(file: File, options: { batchId: string; fileHash: string; overrides: TeamImportOverride[]; columnMapping?: TeamImportColumnMapping | null }) { return parse<T>(await csrfFetch('/api/supervisor/roster-import/assist/repair', { method: 'POST', body: form(file, options) })) }
export async function recordImportAssistOutcome(batchId: string, suggestionId: string, outcome: 'ACCEPTED' | 'REJECTED') { return parse<{ recorded: true }>(await csrfFetch('/api/supervisor/roster-import/assist/outcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId, suggestionId, outcome }) })) }
