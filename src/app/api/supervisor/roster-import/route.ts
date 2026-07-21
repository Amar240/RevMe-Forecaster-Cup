import { requireUserOrResponse, jsonOk, jsonError } from '@/server/http'
import { getSupervisorImportHistory } from '@/server/roster-import'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    return jsonOk({ batches: await getSupervisorImportHistory(user!) })
  } catch (error) { return jsonError(error, 'Failed to load roster import history') }
}
