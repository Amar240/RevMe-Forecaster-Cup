import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { setTeamSubmitter } from '@/server/team-roster'

export const dynamic = 'force-dynamic'

const submitterSchema = z.object({
  memberId: z.string().min(1),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, submitterSchema)

    await setTeamSubmitter({
      actor: user!,
      access: 'admin',
      teamId: id,
      memberId: data.memberId,
    })

    return jsonOk({ message: 'Submitter updated' })
  } catch (error) {
    return jsonError(error, 'Failed to set submitter')
  }
}
