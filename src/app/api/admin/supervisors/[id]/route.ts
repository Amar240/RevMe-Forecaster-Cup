import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { updateManagedUser } from '@/server/user-management'

export const dynamic = 'force-dynamic'

const updateSupervisorSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320),
  universityId: z.string().min(1).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const body = await parseJson(request, updateSupervisorSchema)

    const supervisor = await updateManagedUser({
      actor: user!,
      scope: 'admin-supervisor',
      userId: id,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      universityId: body.universityId,
    })

    return jsonOk({ supervisor })
  } catch (error) {
    return jsonError(error, 'Failed to update supervisor')
  }
}
