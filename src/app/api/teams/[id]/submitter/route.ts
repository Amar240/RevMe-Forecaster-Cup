import { NextRequest } from 'next/server'
import { requireUserOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { setTeamSubmitter } from '@/server/team-roster'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const setSubmitterSchema = z.object({
  memberId: z.string(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, setSubmitterSchema)

    if (user!.role !== 'ADMIN' && user!.role !== 'SUPERVISOR') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    await setTeamSubmitter({
      actor: user!,
      access: user!.role === 'ADMIN' ? 'admin' : 'supervisor',
      teamId: id,
      memberId: data.memberId,
    })

    return jsonOk({ message: 'Submitter updated' })
  } catch (error) {
    return jsonError(error, 'Failed to set submitter')
  }
}
