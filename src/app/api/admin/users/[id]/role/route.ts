import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logAuditAction } from '@/lib/audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { role } = body

    if (!['STUDENT', 'SUPERVISOR', 'ADMIN'].includes(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    if (targetUser.id === user.id) {
      return NextResponse.json({ message: 'Cannot change your own role' }, { status: 400 })
    }

    const oldRole = targetUser.role

    await prisma.user.update({
      where: { id },
      data: { role },
    })

    await logAuditAction(user.id, 'CHANGE_USER_ROLE', 'User', id, {
      userEmail: targetUser.email,
      oldRole,
      newRole: role,
    })

    return NextResponse.json({ message: 'User role updated successfully' })
  } catch (error) {
    console.error('Change role error:', error)
    return NextResponse.json({ message: 'Failed to change user role' }, { status: 500 })
  }
}
