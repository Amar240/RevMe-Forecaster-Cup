import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        university: true,
        supervisor: true,
        members: {
          include: { user: true },
        },
        submissions: {
          include: { round: true, values: true },
          orderBy: { submittedAt: 'desc' },
        },
        warnings: {
          include: { round: true },
        },
      },
    })

    if (!team) {
      return NextResponse.json({ message: 'Team not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && team.supervisorId !== user.id) {
      const isMember = team.members.some((m) => m.userId === user.id)
      if (!isMember) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ team })
  } catch (error) {
    console.error('Get team error:', error)
    return NextResponse.json({ message: 'Failed to get team' }, { status: 500 })
  }
}
