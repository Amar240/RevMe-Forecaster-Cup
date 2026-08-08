import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { reassignTeamSupervisor } from '@/server/team-roster'

export const dynamic = 'force-dynamic'

const supervisorSchema = z.object({
  supervisorId: z.string().min(1).nullable(),
  reason: z.string().trim().min(5).max(500),
  fingerprint: z.coerce.date(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    if (user!.role !== 'ADMIN') {
      throw new ApiError('Only full administrators can change team supervisors.', 403, 'FORBIDDEN')
    }

    const { id } = await params
    const data = await parseJson(request, supervisorSchema)

    const team = await reassignTeamSupervisor({
      actor: user!,
      teamId: id,
      supervisorId: data.supervisorId,
      reason: data.reason,
      fingerprint: data.fingerprint,
    })

    return jsonOk({ team })
  } catch (error) {
    return jsonError(error, 'Failed to update supervisor')
  }
}
