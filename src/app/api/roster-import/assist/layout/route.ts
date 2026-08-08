import { requireUserOrResponse, jsonOk } from '@/server/http'
import { readTeamImportFormData } from '@/lib/team-import/request'
import { suggestRosterLayout } from '@/server/roster-import-assist'
import { importAssistJsonError, importAssistSeason, requireImportAssistEnabled } from '../route-utils'

export async function POST(request: Request) {
  try {
    requireImportAssistEnabled()
    const { user, response } = await requireUserOrResponse(); if (response) return response
    const form = await request.formData(); const submittedSeason = typeof form.get('seasonId') === 'string' ? String(form.get('seasonId')) : null
    const seasonId = await importAssistSeason(user!, submittedSeason); form.set('seasonId', seasonId)
    const data = await readTeamImportFormData(new Request(request.url, { method: 'POST', body: form }))
    return jsonOk(await suggestRosterLayout({ actor: user!, seasonId, fileName: data.fileName, fileBuffer: data.fileBuffer, batchId: data.batchId, fileHash: data.fileHash, trustedAdminContext: data.universityId && data.supervisorId ? { universityId: data.universityId, supervisorId: data.supervisorId } : null }))
  } catch (error) { return importAssistJsonError(error, 'Import layout assistance is unavailable') }
}
