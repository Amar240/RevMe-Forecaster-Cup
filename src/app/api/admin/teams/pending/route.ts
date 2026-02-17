import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const pendingTeams = await prisma.team.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        supervisor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        university: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        season: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ teams: pendingTeams })
  } catch (error) {
    console.error('Failed to fetch pending teams:', error)
    return NextResponse.json({ message: 'Failed to fetch pending teams' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { teamId, action, reason } = body

    if (!teamId || !action) {
      return NextResponse.json({ message: 'Team ID and action are required' }, { status: 400 })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ message: 'Team not found' }, { status: 404 })
    }

    if (team.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ message: 'Team is not pending approval' }, { status: 400 })
    }

    if (action === 'approve') {
      await prisma.team.update({
        where: { id: teamId },
        data: {
          status: 'ACTIVE',
          approvedAt: new Date(),
          approvedById: user.id,
        },
      })

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          action: 'TEAM_APPROVED',
          entityType: 'Team',
          entityId: teamId,
          details: { teamName: team.name, status: 'ACTIVE' },
        },
      })

      return NextResponse.json({ message: 'Team approved and activated' })
    }

    if (action === 'reject') {
      await prisma.team.update({
        where: { id: teamId },
        data: {
          status: 'REJECTED',
          rejectionReason: reason || 'No reason provided',
        },
      })

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          action: 'TEAM_REJECTED',
          entityType: 'Team',
          entityId: teamId,
          details: { teamName: team.name, reason },
        },
      })

      return NextResponse.json({ message: 'Team rejected' })
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Failed to process team approval:', error)
    return NextResponse.json({ message: 'Failed to process team approval' }, { status: 500 })
  }
}
