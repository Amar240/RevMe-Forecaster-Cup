import { NextRequest } from 'next/server'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { updateManagedUser } from '@/server/user-management'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const body = await request.json() as {
      firstName?: string
      lastName?: string
      email?: string
      universityId?: string
    }

    const supervisor = await updateManagedUser({
      actor: user!,
      scope: 'admin-supervisor',
      userId: id,
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
      email: body.email ?? '',
      universityId: body.universityId,
    })

    return jsonOk({ supervisor })
  } catch (error) {
    return jsonError(error, 'Failed to update supervisor')
  }
}
