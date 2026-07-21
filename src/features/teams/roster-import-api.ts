import { csrfFetch } from '@/lib/csrf'
import type { TeamImportOverride } from '@/lib/team-import/types'

async function parse<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Roster import request failed')
  return data as T
}

function form(file: File, options?: { batchId?: string; fileHash?: string; overrides?: TeamImportOverride[] }) {
  const data = new FormData()
  data.append('file', file)
  if (options?.batchId) data.append('batchId', options.batchId)
  if (options?.fileHash) data.append('fileHash', options.fileHash)
  data.append('overrides', JSON.stringify(options?.overrides ?? []))
  return data
}

export async function previewSupervisorRoster<T>(file: File, options?: { batchId?: string; fileHash?: string; overrides?: TeamImportOverride[] }) { return parse<T>(await csrfFetch('/api/supervisor/roster-import/preview', { method: 'POST', body: form(file, options) })) }
export async function confirmSupervisorRoster<T>(batchId: string, fileHash: string, file: File, overrides: TeamImportOverride[]) { return parse<T>(await csrfFetch('/api/supervisor/roster-import/confirm', { method: 'POST', body: form(file, { batchId, fileHash, overrides }) })) }
export async function getSupervisorRosterHistory<T>() { return parse<T>(await csrfFetch('/api/supervisor/roster-import')) }
