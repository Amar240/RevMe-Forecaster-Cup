import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logAuditAction } from '@/lib/audit'

export async function POST(
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
      return NextResponse.json({ message: 'Cannot force logout yourself' }, { status: 400 })
    }

    const result = await prisma.session.deleteMany({
      where: { userId: id },
    })

    await logAuditAction(user.id, 'FORCE_LOGOUT', 'User', id, {
      userEmail: targetUser.email,
      sessionsDeleted: result.count,
    })

    return NextResponse.json({
      message: `User logged out. ${result.count} session(s) terminated.`,
    })
  } catch (error) {
    console.error('Force logout error:', error)
    return NextResponse.json({ message: 'Failed to force logout' }, { status: 500 })
  }
}
