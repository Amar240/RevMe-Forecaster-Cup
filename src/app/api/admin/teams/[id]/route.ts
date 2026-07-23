import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { getAdminTeamDetail } from '@/server/team-roster'
import { updateAdminTeamMetadata } from '@/server/team-management'

export const dynamic = 'force-dynamic'

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  externalTeamId: z.string().max(100).optional().nullable(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const data = await getAdminTeamDetail(id)

    return jsonOk(data)
  } catch (error) {
    return jsonError(error, 'Failed to get admin team detail')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, updateTeamSchema)

    await updateAdminTeamMetadata({
      actor: user!,
      teamId: id,
      name: data.name,
      externalTeamId: data.externalTeamId,
    })

    const detail = await getAdminTeamDetail(id)

    return jsonOk({ team: detail.team })
  } catch (error) {
    return jsonError(error, 'Failed to update team')
  }
}
