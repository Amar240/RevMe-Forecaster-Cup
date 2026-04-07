import { NextRequest } from 'next/server'
import { requireUserOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { addMemberToTeam } from '@/server/team-roster'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const addMemberSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().email().optional(),
  })
  .refine((value) => value.userId || value.email, {
    message: 'A student selection is required',
    path: ['userId'],
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
      studentId: data.userId,
      email: data.email,
    })

    return jsonOk({ member }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to add member')
  }
}
