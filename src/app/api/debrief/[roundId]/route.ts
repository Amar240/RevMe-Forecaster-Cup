import { requireUserOrResponse, jsonError, jsonOk, ApiError } from '@/server/http'
import { getAuthorizedDebrief } from '@/server/debrief'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const { roundId } = await params
    const requestedTeamId = new URL(request.url).searchParams.get('teamId')
    if (user!.role !== 'STUDENT' && !requestedTeamId) throw new ApiError('teamId is required', 400, 'VALIDATION_ERROR')
    const debrief = await getAuthorizedDebrief({ id: user!.id, role: user!.role }, roundId, requestedTeamId)
    if (!debrief) throw new ApiError('Published debrief not found', 404, 'NOT_FOUND')
    return jsonOk({ debrief })
  } catch (error) {
    return jsonError(error, 'Failed to load round debrief')
  }
}
