import { requireUserOrResponse, jsonOk, jsonError } from '@/server/http'
import { readTeamImportFormData } from '@/lib/team-import/request'
import { confirmRosterImport, getSupervisorImportSeason } from '@/server/roster-import'

export async function POST(request: Request) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const season = await getSupervisorImportSeason(user!)
    const form = await request.formData()
    if (!form.get('seasonId')) form.set('seasonId', season.id)
    const { fileName, fileBuffer, batchId, fileHash, overrides, columnMapping } = await readTeamImportFormData(new Request(request.url, { method: 'POST', body: form }))
    return jsonOk(await confirmRosterImport({ actor: user!, mode: 'supervisor', seasonId: season.id, batchId, fileName, fileBuffer, submittedFileHash: fileHash, overrides, columnMapping }))
  } catch (error) { return jsonError(error, 'Failed to confirm roster import') }
}
