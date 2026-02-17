import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const requests = await prisma.joinRequest.findMany({
      where: {
        OR: [
          { supervisorId: user.id },
          { supervisorEmailEntered: user.email },
        ],
        status: 'PENDING',
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            university: { select: { name: true } },
          },
        },
        season: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Failed to fetch supervisor join requests:', error)
    return NextResponse.json({ message: 'Failed to fetch join requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { requestId, action, teamId, teamName } = body

    if (!requestId || !action) {
      return NextResponse.json({ message: 'Request ID and action are required' }, { status: 400 })
    }

    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { student: true },
    })

    if (!joinRequest) {
      return NextResponse.json({ message: 'Join request not found' }, { status: 404 })
    }

    if (joinRequest.supervisorId !== user.id && joinRequest.supervisorEmailEntered !== user.email) {
      return NextResponse.json({ message: 'You are not authorized to handle this request' }, { status: 403 })
    }

    if (joinRequest.status !== 'PENDING') {
      return NextResponse.json({ message: 'This request has already been processed' }, { status: 400 })
    }

    if (action === 'reject') {
      await prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      })
      return NextResponse.json({ message: 'Request rejected' })
    }

    if (action === 'accept') {
      let targetTeamId = teamId

      if (!targetTeamId && teamName) {
        const activeSeason = await prisma.season.findFirst({
          where: { status: 'ACTIVE' },
        })

        const existingTeamsCount = await prisma.team.count({
          where: { supervisorId: user.id },
        })

        if (existingTeamsCount >= 10) {
          return NextResponse.json({ message: 'Maximum 10 teams per supervisor reached' }, { status: 400 })
        }

        const displayId = `T-${Date.now().toString(36).toUpperCase()}`
        const newTeam = await prisma.team.create({
          data: {
            name: teamName,
            displayId,
            supervisorId: user.id,
            universityId: joinRequest.student.universityId || user.universityId!,
            seasonId: activeSeason?.id || null,
            status: 'PENDING_APPROVAL',
          },
        })
        targetTeamId = newTeam.id
      }

      if (!targetTeamId) {
        return NextResponse.json({ message: 'Team ID or team name is required' }, { status: 400 })
      }

      const team = await prisma.team.findUnique({
        where: { id: targetTeamId },
        include: { members: true },
      })

      if (!team) {
        return NextResponse.json({ message: 'Team not found' }, { status: 404 })
      }

      if (team.members.length >= 5) {
        return NextResponse.json({ message: 'Maximum 5 members per team reached' }, { status: 400 })
      }

      await prisma.$transaction([
        prisma.teamMember.create({
          data: {
            userId: joinRequest.studentId,
            teamId: targetTeamId,
            isSubmitter: team.members.length === 0,
          },
        }),
        prisma.joinRequest.update({
          where: { id: requestId },
          data: {
            status: 'ACCEPTED',
            teamId: targetTeamId,
            resolvedAt: new Date(),
          },
        }),
      ])

      return NextResponse.json({ message: 'Student added to team' })
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Failed to process join request:', error)
    return NextResponse.json({ message: 'Failed to process join request' }, { status: 500 })
  }
}
