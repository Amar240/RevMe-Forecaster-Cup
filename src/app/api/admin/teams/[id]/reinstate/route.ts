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

    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) {
      return NextResponse.json({ message: 'Team not found' }, { status: 404 })
    }

    if (team.status === 'ACTIVE') {
      return NextResponse.json({ message: 'Team is already active' }, { status: 400 })
    }

    await prisma.team.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        disqualifiedAt: null,
        disqualifiedReason: null,
      },
    })

    await logAuditAction(user.id, 'REINSTATE_TEAM', 'Team', id, {
      teamName: team.name,
    })

    return NextResponse.json({ message: 'Team reinstated successfully' })
  } catch (error) {
    console.error('Reinstate team error:', error)
    return NextResponse.json({ message: 'Failed to reinstate team' }, { status: 500 })
  }
}
