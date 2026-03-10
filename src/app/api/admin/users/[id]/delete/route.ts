import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) throw new ApiError('User not found', 404, 'NOT_FOUND')
    if (targetUser.id === user!.id) throw new ApiError('Cannot delete yourself', 400, 'INVALID_INPUT')
    if (targetUser.role === 'ADMIN') throw new ApiError('Cannot delete admin users', 400, 'FORBIDDEN')

    if (targetUser.role === 'SUPERVISOR') {
      const supervisedTeams = await prisma.team.findMany({ where: { supervisorId: id } })
      if (supervisedTeams.length > 0) {
        throw new ApiError('Cannot delete supervisor with active teams. Please reassign their teams first.', 400, 'INVALID_INPUT')
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: id } })
      await tx.notification.deleteMany({ where: { userId: id } })
      await tx.userPermission.deleteMany({ where: { userId: id } })
      await tx.supportTicketReply.deleteMany({ where: { authorId: id } })
      await tx.supportTicket.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } })
      await tx.supportTicket.deleteMany({ where: { createdById: id } })
      await tx.joinRequest.deleteMany({ where: { studentId: id } })
      await tx.joinRequest.updateMany({ where: { supervisorId: id }, data: { supervisorId: null } })
      await tx.teamMember.deleteMany({ where: { userId: id } })
      await tx.user.delete({ where: { id } })
    })

    await logAuditAction(user!.id, 'DELETE_USER', 'User', id, { deletedUserEmail: targetUser.email, deletedUserRole: targetUser.role })

    return jsonOk({ message: 'User deleted successfully' })
  } catch (error) {
    return jsonError(error, 'Failed to delete user')
  }
}
