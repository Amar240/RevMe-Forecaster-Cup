import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const body = await request.json()
    const { role } = body

    if (!['STUDENT', 'SUPERVISOR', 'ADMIN'].includes(role)) {
      throw new ApiError('Invalid role', 400, 'INVALID_INPUT')
    }

    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) throw new ApiError('User not found', 404, 'NOT_FOUND')
    if (targetUser.id === user!.id) throw new ApiError('Cannot change your own role', 400, 'INVALID_INPUT')

    const oldRole = targetUser.role
    await prisma.user.update({ where: { id }, data: { role } })
    await logAuditAction(user!.id, 'CHANGE_USER_ROLE', 'User', id, { userEmail: targetUser.email, oldRole, newRole: role })

    return jsonOk({ message: 'User role updated successfully' })
  } catch (error) {
    return jsonError(error, 'Failed to change user role')
  }
}
