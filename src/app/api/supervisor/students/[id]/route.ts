import { NextRequest } from 'next/server'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { updateManagedUser } from '@/server/user-management'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'SUPERVISOR') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const { id } = await params
    const body = await request.json() as {
      firstName?: string
      lastName?: string
      email?: string
    }

    const updatedUser = await updateManagedUser({
      actor: user!,
      scope: 'supervisor-student',
      userId: id,
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
      email: body.email ?? '',
    })

    return jsonOk({ user: updatedUser })
  } catch (error) {
    return jsonError(error, 'Failed to update student')
  }
}
