import { NextRequest } from 'next/server'
import { requireUserOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { addMemberToTeam } from '@/server/team-roster'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const addMemberSchema = z.object({
  email: z.string().email(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, addMemberSchema)

    if (user!.role !== 'ADMIN' && user!.role !== 'SUPERVISOR') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const member = await addMemberToTeam({
      actor: user!,
      access: user!.role === 'ADMIN' ? 'admin' : 'supervisor',
      teamId: id,
      email: data.email,
    })

    return jsonOk({ member }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to add member')
  }
}
