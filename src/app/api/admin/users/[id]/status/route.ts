import { NextRequest } from 'next/server'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { setManagedUserActiveStatus } from '@/server/user-management'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse('users:manage')
    if (response) return response

    const { id } = await params
    const body = await request.json() as { isActive?: boolean }

    if (typeof body.isActive !== 'boolean') {
      throw new ApiError('isActive must be a boolean', 400, 'INVALID_INPUT')
    }

    const updatedUser = await setManagedUserActiveStatus({
      actor: user!,
      scope: 'admin-student',
      userId: id,
      isActive: body.isActive,
    })

    return jsonOk({ user: updatedUser })
  } catch (error) {
    return jsonError(error, 'Failed to update student status')
  }
}
