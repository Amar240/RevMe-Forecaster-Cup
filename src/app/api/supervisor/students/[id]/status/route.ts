import { NextRequest } from 'next/server'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { setManagedUserActiveStatus } from '@/server/user-management'

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
    const body = await request.json() as { isActive?: boolean }

    if (typeof body.isActive !== 'boolean') {
      throw new ApiError('isActive must be a boolean', 400, 'INVALID_INPUT')
    }

    const updatedUser = await setManagedUserActiveStatus({
      actor: user!,
      scope: 'supervisor-student',
      userId: id,
      isActive: body.isActive,
    })

    return jsonOk({ user: updatedUser })
  } catch (error) {
    return jsonError(error, 'Failed to update student status')
  }
}
