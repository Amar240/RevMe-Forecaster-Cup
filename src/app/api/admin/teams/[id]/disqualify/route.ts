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
    const body = await request.json()
    const reason = body.reason || 'Admin decision'

    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) {
      return NextResponse.json({ message: 'Team not found' }, { status: 404 })
    }

    if (team.status === 'DISQUALIFIED') {
      return NextResponse.json({ message: 'Team is already disqualified' }, { status: 400 })
    }

    await prisma.team.update({
      where: { id },
      data: {
        status: 'DISQUALIFIED',
        disqualifiedAt: new Date(),
        disqualifiedReason: reason,
      },
    })

    await logAuditAction(user.id, 'DISQUALIFY_TEAM', 'Team', id, {
      teamName: team.name,
      reason,
    })

    return NextResponse.json({ message: 'Team disqualified successfully' })
  } catch (error) {
    console.error('Disqualify team error:', error)
    return NextResponse.json({ message: 'Failed to disqualify team' }, { status: 500 })
  }
}
