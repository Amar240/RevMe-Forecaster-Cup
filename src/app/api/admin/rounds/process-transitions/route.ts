import { processRoundTransitions } from '@/lib/round-scheduler'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const result = await processRoundTransitions()
    return jsonOk(result)
  } catch (error) {
    return jsonError(error, 'Failed to process round transitions')
  }
}
