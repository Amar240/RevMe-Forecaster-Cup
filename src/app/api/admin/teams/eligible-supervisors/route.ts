import { NextRequest } from 'next/server'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { searchEligibleSupervisors } from '@/server/team-roster'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const teamId = request.nextUrl.searchParams.get('teamId')
    const query = request.nextUrl.searchParams.get('query') ?? ''

    if (!teamId) {
      throw new ApiError('teamId is required', 400, 'INVALID_INPUT')
    }

    const supervisors = await searchEligibleSupervisors({
      actor: user!,
      teamId,
      query,
    })

    return jsonOk({ supervisors })
  } catch (error) {
    return jsonError(error, 'Failed to get eligible supervisors')
  }
}
