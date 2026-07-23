import { NextRequest } from 'next/server'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { deleteManagedStudent } from '@/server/user-management'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    await deleteManagedStudent({
      actor: user!,
      userId: id,
    })

    return jsonOk({ message: 'User deleted successfully' })
  } catch (error) {
    return jsonError(error, 'Failed to delete user')
  }
}
