import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'SUPERVISOR' && user!.role !== 'ADMIN') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const requests = await prisma.joinRequest.findMany({
      where: {
        OR: [
          { supervisorId: user!.id },
          { supervisorEmailEntered: user!.email },
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

    return jsonOk({ requests })
  } catch (error) {
    return jsonError(error, 'Failed to fetch join requests')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'SUPERVISOR' && user!.role !== 'ADMIN') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const body = await request.json()
    const { requestId, action, teamId, teamName } = body

    if (!requestId || !action) {
      throw new ApiError('Request ID and action are required', 400, 'INVALID_INPUT')
    }

    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { student: true },
    })

    if (!joinRequest) {
      throw new ApiError('Join request not found', 404, 'NOT_FOUND')
    }

    if (joinRequest.supervisorId !== user!.id && joinRequest.supervisorEmailEntered !== user!.email) {
      throw new ApiError('You are not authorized to handle this request', 403, 'FORBIDDEN')
    }

    if (joinRequest.status !== 'PENDING') {
      throw new ApiError('This request has already been processed', 400, 'INVALID_INPUT')
    }

    if (action === 'reject') {
      await prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      })
      return jsonOk({ message: 'Request rejected' })
    }

    if (action === 'accept') {
      let targetTeamId = teamId

      if (!targetTeamId && teamName) {
        const activeSeason = await prisma.season.findFirst({
          where: { status: 'ACTIVE' },
        })

        const existingTeamsCount = await prisma.team.count({
          where: { supervisorId: user!.id },
        })

        if (existingTeamsCount >= 10) {
          throw new ApiError('Maximum 10 teams per supervisor reached', 400, 'CONFLICT')
        }

        const displayId = `T-${Date.now().toString(36).toUpperCase()}`
        const newTeam = await prisma.team.create({
          data: {
            name: teamName,
            displayId,
            supervisorId: user!.id,
            universityId: joinRequest.student.universityId || user!.universityId!,
            seasonId: activeSeason?.id || null,
            status: 'PENDING_APPROVAL',
          },
        })
        targetTeamId = newTeam.id
      }

      if (!targetTeamId) {
        throw new ApiError('Team ID or team name is required', 400, 'INVALID_INPUT')
      }

      const team = await prisma.team.findUnique({
        where: { id: targetTeamId },
        include: { members: true },
      })

      if (!team) {
        throw new ApiError('Team not found', 404, 'NOT_FOUND')
      }

      if (team.members.length >= 5) {
        throw new ApiError('Maximum 5 members per team reached', 400, 'CONFLICT')
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

      return jsonOk({ message: 'Student added to team' })
    }

    throw new ApiError('Invalid action', 400, 'INVALID_INPUT')
  } catch (error) {
    return jsonError(error, 'Failed to process join request')
  }
}
