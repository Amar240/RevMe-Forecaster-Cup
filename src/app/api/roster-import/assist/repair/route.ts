import { ApiError, requireUserOrResponse, jsonOk } from '@/server/http'
import { readTeamImportFormData } from '@/lib/team-import/request'
import { suggestRosterRepairs } from '@/server/roster-import-assist'
import { importAssistJsonError, importAssistSeason, requireImportAssistEnabled } from '../route-utils'

export async function POST(request: Request) {
  try {
    requireImportAssistEnabled()
    const { user, response } = await requireUserOrResponse(); if (response) return response
    const form = await request.formData(); const submittedSeason = typeof form.get('seasonId') === 'string' ? String(form.get('seasonId')) : null
    const seasonId = await importAssistSeason(user!, submittedSeason); form.set('seasonId', seasonId)
    const data = await readTeamImportFormData(new Request(request.url, { method: 'POST', body: form }))
    if (!data.batchId || !data.fileHash) throw new ApiError('Batch and file hash are required', 400, 'INVALID_INPUT')
    return jsonOk(await suggestRosterRepairs({ actor: user!, seasonId, batchId: data.batchId, fileHash: data.fileHash, fileName: data.fileName, fileBuffer: data.fileBuffer, columnMapping: data.columnMapping, overrides: data.overrides, excludedRowNumbers: data.excludedRowNumbers }))
  } catch (error) { return importAssistJsonError(error, 'Import repair assistance is unavailable') }
}
