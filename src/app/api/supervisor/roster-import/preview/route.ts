import { requireUserOrResponse, jsonOk, jsonError } from '@/server/http'
import { readTeamImportFormData } from '@/lib/team-import/request'
import { getSupervisorImportSeason, previewRosterImport } from '@/server/roster-import'

export async function POST(request: Request) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const season = await getSupervisorImportSeason(user!)
    const { fileName, fileBuffer, batchId, fileHash, overrides, columnMapping, excludedRowNumbers } = await readTeamImportFormDataWithSeason(request, season.id)
    return jsonOk(await previewRosterImport({ actor: user!, mode: 'supervisor', seasonId: season.id, fileName, fileBuffer, batchId, submittedFileHash: fileHash, overrides, columnMapping, excludedRowNumbers }))
  } catch (error) { return jsonError(error, 'Failed to preview roster import') }
}

async function readTeamImportFormDataWithSeason(request: Request, seasonId: string) {
  const original = request.formData.bind(request)
  const form = await original()
  if (!form.get('seasonId')) form.set('seasonId', seasonId)
  return readTeamImportFormData(new Request(request.url, { method: 'POST', body: form }))
}
