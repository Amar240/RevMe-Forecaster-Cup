import { ApiError, requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { readTeamImportFormData } from '@/lib/team-import/request'
import { confirmRosterImport } from '@/server/roster-import'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { seasonId, fileName, fileBuffer, batchId, fileHash, overrides, columnMapping, excludedRowNumbers, universityId, supervisorId } = await readTeamImportFormData(request)
    if (Boolean(universityId) !== Boolean(supervisorId)) throw new ApiError('University and supervisor must be selected together', 400, 'INVALID_INPUT')
    return jsonOk(await confirmRosterImport({ actor: user!, mode: 'admin', seasonId, batchId, fileName, fileBuffer, submittedFileHash: fileHash, overrides, columnMapping, excludedRowNumbers, trustedAdminContext: universityId && supervisorId ? { universityId, supervisorId } : null }))
  } catch (error) {
    return jsonError(error, 'Failed to confirm team import')
  }
}
