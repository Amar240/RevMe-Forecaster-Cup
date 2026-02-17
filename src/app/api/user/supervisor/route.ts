import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'STUDENT') {
      return NextResponse.json({ supervisor: null })
    }

    const teamMembership = await prisma.teamMember.findFirst({
      where: { userId: user.id },
      include: {
        team: {
          include: {
            supervisor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!teamMembership?.team?.supervisor) {
      return NextResponse.json({ supervisor: null })
    }

    return NextResponse.json({ supervisor: teamMembership.team.supervisor })
  } catch (error) {
    console.error('Failed to fetch supervisor:', error)
    return NextResponse.json({ message: 'Failed to fetch supervisor' }, { status: 500 })
  }
}
