import { NextRequest } from 'next/server'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { searchEligibleStudents } from '@/server/team-roster'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'SUPERVISOR') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const { id } = await params
    const query = request.nextUrl.searchParams.get('query') ?? ''

    const students = await searchEligibleStudents({
      actor: user!,
      access: 'supervisor',
      teamId: id,
      query,
    })

    return jsonOk({ students })
  } catch (error) {
    return jsonError(error, 'Failed to get eligible students')
  }
}
