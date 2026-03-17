import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { getAdminTeamDetail, renameTeam } from '@/server/team-roster'

export const dynamic = 'force-dynamic'

const renameTeamSchema = z.object({
  name: z.string().min(1).max(100),
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
    const data = await parseJson(request, renameTeamSchema)

    const team = await renameTeam({
      actor: user!,
      access: 'admin',
      teamId: id,
      name: data.name,
    })

    return jsonOk({ team })
  } catch (error) {
    return jsonError(error, 'Failed to update team')
  }
}
