import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logAuditAction } from '@/lib/audit'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    if (targetUser.id === user.id) {
      return NextResponse.json({ message: 'Cannot delete yourself' }, { status: 400 })
    }

    if (targetUser.role === 'ADMIN') {
      return NextResponse.json({ message: 'Cannot delete admin users' }, { status: 400 })
    }

    await prisma.session.deleteMany({ where: { userId: id } })
    await prisma.notification.deleteMany({ where: { userId: id } })
    await prisma.userPermission.deleteMany({ where: { userId: id } })
    await prisma.supportTicketReply.deleteMany({ where: { authorId: id } })
    await prisma.supportTicket.updateMany({ 
      where: { assignedToId: id },
      data: { assignedToId: null }
    })
    await prisma.supportTicket.deleteMany({ where: { createdById: id } })
    await prisma.joinRequest.deleteMany({ where: { studentId: id } })
    await prisma.joinRequest.updateMany({
      where: { supervisorId: id },
      data: { supervisorId: null }
    })
    
    const isSupervisor = targetUser.role === 'SUPERVISOR'
    if (isSupervisor) {
      const supervisedTeams = await prisma.team.findMany({
        where: { supervisorId: id }
      })
      if (supervisedTeams.length > 0) {
        return NextResponse.json({ 
          message: 'Cannot delete supervisor with active teams. Please reassign their teams first.' 
        }, { status: 400 })
      }
    }
    
    await prisma.teamMember.deleteMany({ where: { userId: id } })
    await prisma.user.delete({ where: { id } })

    await logAuditAction(user.id, 'DELETE_USER', 'User', id, {
      deletedUserEmail: targetUser.email,
      deletedUserRole: targetUser.role,
    })

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Delete user error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ message: `Failed to delete user: ${errorMessage}` }, { status: 500 })
  }
}
