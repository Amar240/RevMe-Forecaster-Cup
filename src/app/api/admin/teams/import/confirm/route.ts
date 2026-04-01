import { ApiError, requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { readTeamImportFormData } from '@/lib/team-import/request'
import { parseTeamImportFile } from '@/lib/team-import/parser'
import { validateTeamImport } from '@/lib/team-import/validate'
import { importValidatedTeams } from '@/lib/team-import/import'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { seasonId, fileName, fileBuffer } = await readTeamImportFormData(request)
    const parsedFile = await parseTeamImportFile({ fileName, fileBuffer })
    const validation = await validateTeamImport({ seasonId, parsedFile })

    if (validation.validRows.length === 0) {
      throw new ApiError('No valid rows are available to import', 422, 'INVALID_INPUT', {
        summary: validation.summary,
        rows: validation.rows,
      })
    }

    const result = await importValidatedTeams({
      actor: {
        id: user!.id,
        email: user!.email,
        role: user!.role,
      },
      fileName,
      validation,
    })

    return jsonOk(result)
  } catch (error) {
    return jsonError(error, 'Failed to confirm team import')
  }
}
