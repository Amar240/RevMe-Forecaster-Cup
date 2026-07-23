import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { getAdminTeamDetail } from '@/server/team-roster'
import { setAdminTeamStatus } from '@/server/team-management'

export const dynamic = 'force-dynamic'

const updateTeamStatusSchema = z.object({
  action: z.enum(['archive', 'restore-draft', 'activate']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, updateTeamStatusSchema)

    await setAdminTeamStatus({
      actor: user!,
      teamId: id,
      action: data.action,
    })

    const detail = await getAdminTeamDetail(id)

    return jsonOk({ team: detail.team })
  } catch (error) {
    return jsonError(error, 'Failed to update team status')
  }
}
