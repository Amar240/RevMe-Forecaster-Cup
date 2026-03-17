import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { reassignTeamSupervisor } from '@/server/team-roster'

export const dynamic = 'force-dynamic'

const supervisorSchema = z.object({
  supervisorId: z.string().min(1),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, supervisorSchema)

    const team = await reassignTeamSupervisor({
      actor: user!,
      teamId: id,
      supervisorId: data.supervisorId,
    })

    return jsonOk({ team })
  } catch (error) {
    return jsonError(error, 'Failed to update supervisor')
  }
}
