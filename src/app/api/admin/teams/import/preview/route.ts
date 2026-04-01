import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { readTeamImportFormData } from '@/lib/team-import/request'
import { parseTeamImportFile } from '@/lib/team-import/parser'
import { validateTeamImport } from '@/lib/team-import/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { seasonId, fileName, fileBuffer } = await readTeamImportFormData(request)
    const parsedFile = await parseTeamImportFile({ fileName, fileBuffer })
    const validation = await validateTeamImport({ seasonId, parsedFile })

    return jsonOk({
      fileName,
      season: validation.season,
      summary: validation.summary,
      rows: validation.rows,
    })
  } catch (error) {
    return jsonError(error, 'Failed to preview team import')
  }
}
