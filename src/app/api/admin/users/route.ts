import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { canPerformAdminAction } from '@/lib/permissions'

export async function GET() {
  try {
    const user = await getSession()
    const canManage = await canPerformAdminAction(user, 'users:manage')
    if (!canManage) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      include: {
        university: true,
        teamMemberships: { include: { team: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ message: 'Failed to get users' }, { status: 500 })
  }
}
