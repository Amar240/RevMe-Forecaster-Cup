import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { readTeamImportFormData } from '@/lib/team-import/request'
import { previewRosterImport } from '@/server/roster-import'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { seasonId, fileName, fileBuffer } = await readTeamImportFormData(request)
    return jsonOk(await previewRosterImport({ actor: user!, mode: 'admin', seasonId, fileName, fileBuffer }))
  } catch (error) {
    return jsonError(error, 'Failed to preview team import')
  }
}
