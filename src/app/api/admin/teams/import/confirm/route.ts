import { ApiError, requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { readTeamImportFormData } from '@/lib/team-import/request'
import { confirmRosterImport } from '@/server/roster-import'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { seasonId, fileName, fileBuffer, batchId } = await readTeamImportFormData(request)
    return jsonOk(await confirmRosterImport({ actor: user!, mode: 'admin', seasonId, batchId, fileName, fileBuffer }))
  } catch (error) {
    return jsonError(error, 'Failed to confirm team import')
  }
}
