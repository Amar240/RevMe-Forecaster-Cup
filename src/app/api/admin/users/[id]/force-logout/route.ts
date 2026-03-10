import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) throw new ApiError('User not found', 404, 'NOT_FOUND')
    if (targetUser.id === user!.id) throw new ApiError('Cannot force logout yourself', 400, 'INVALID_INPUT')

    const result = await prisma.session.deleteMany({ where: { userId: id } })
    await logAuditAction(user!.id, 'FORCE_LOGOUT', 'User', id, { userEmail: targetUser.email, sessionsDeleted: result.count })

    return jsonOk({ message: `User logged out. ${result.count} session(s) terminated.` })
  } catch (error) {
    return jsonError(error, 'Failed to force logout')
  }
}
