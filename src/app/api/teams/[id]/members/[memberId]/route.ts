import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { id, memberId } = await params

    const team = await prisma.team.findUnique({
      where: { id },
      include: { members: true },
    })

    if (!team) {
      return NextResponse.json({ message: 'Team not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && team.supervisorId !== user.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const member = team.members.find((m) => m.id === memberId)
    if (!member) {
      return NextResponse.json({ message: 'Member not found' }, { status: 404 })
    }

    await prisma.teamMember.delete({
      where: { id: memberId },
    })

    if (member.isSubmitter && team.members.length > 1) {
      const remainingMember = team.members.find((m) => m.id !== memberId)
      if (remainingMember) {
        await prisma.teamMember.update({
          where: { id: remainingMember.id },
          data: { isSubmitter: true },
        })
      }
    }

    return NextResponse.json({ message: 'Member removed' })
  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json({ message: 'Failed to remove member' }, { status: 500 })
  }
}
