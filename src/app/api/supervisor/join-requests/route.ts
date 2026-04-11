import { NextRequest } from 'next/server'
import { TeamStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { countSupervisorTeamsInSeason, findSeasonMembershipConflict } from '@/server/team-membership'
import { sameUniversity } from '@/server/universities'

export const dynamic = 'force-dynamic'

const joinableTeamStatuses: TeamStatus[] = ['PENDING_APPROVAL', 'APPROVED', 'ACTIVE']

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
            university: {
              select: {
                id: true,
                name: true,
                normalizedName: true,
              },
            },
          },
        },
        season: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const requestedTeamIds = requests.flatMap((request) => (request.teamId ? [request.teamId] : []))
    const requestedTeams = requestedTeamIds.length
      ? await prisma.team.findMany({
          where: { id: { in: requestedTeamIds } },
          select: { id: true, name: true, displayId: true, status: true },
        })
      : []

    const requestedTeamMap = new Map(requestedTeams.map((team) => [team.id, team]))

    return jsonOk({
      requests: requests.map((request) => ({
        ...request,
        requestedTeam: request.teamId ? requestedTeamMap.get(request.teamId) ?? null : null,
      })),
    })
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
      include: {
        student: {
          include: {
            university: {
              select: {
                id: true,
                name: true,
                normalizedName: true,
              },
            },
          },
        },
      },
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
      let targetTeamId = teamId || joinRequest.teamId

      if (!targetTeamId && teamName) {
        const operationalSeason = await getCurrentOperationalSeason({
          select: { id: true },
        })

        const studentWithUniversity = await prisma.user.findUnique({
          where: { id: joinRequest.studentId },
          include: {
            university: {
              select: {
                id: true,
                name: true,
                normalizedName: true,
              },
            },
          },
        })

        const actingSupervisor = await prisma.user.findUnique({
          where: { id: user!.id },
          include: {
            university: {
              select: {
                id: true,
                name: true,
                normalizedName: true,
              },
            },
          },
        })

        if (
          studentWithUniversity?.university &&
          actingSupervisor?.university &&
          !sameUniversity(studentWithUniversity.university, actingSupervisor.university)
        ) {
          throw new ApiError('Student and supervisor must belong to the same university', 422, 'INVALID_INPUT')
        }

        const targetSeasonId = joinRequest.seasonId || operationalSeason?.id || null
        if (!targetSeasonId) {
          throw new ApiError('No operational season is available for creating a team.', 422, 'INVALID_INPUT')
        }
        const existingTeamsCount = await countSupervisorTeamsInSeason({
          supervisorId: user!.id,
          seasonId: targetSeasonId,
          db: prisma,
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
            seasonId: targetSeasonId,
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
        include: {
          members: true,
          university: {
            select: {
              id: true,
              name: true,
              normalizedName: true,
            },
          },
        },
      })

      if (!team) {
        throw new ApiError('Team not found', 404, 'NOT_FOUND')
      }

      if (user!.role === 'SUPERVISOR' && team.supervisorId !== user!.id) {
        throw new ApiError('You can only add students to your own teams', 403, 'FORBIDDEN')
      }

      if (!joinableTeamStatuses.includes(team.status)) {
        throw new ApiError('Selected team is not open for join requests', 422, 'INVALID_INPUT')
      }

      if (joinRequest.seasonId && team.seasonId !== joinRequest.seasonId) {
        throw new ApiError('Selected team must belong to the same season as the request', 422, 'INVALID_INPUT')
      }

      if (joinRequest.student.university && team.university && !sameUniversity(joinRequest.student.university, team.university)) {
        throw new ApiError('Selected team must belong to the same university as the student', 422, 'INVALID_INPUT')
      }

      if (team.members.length >= 5) {
        throw new ApiError('Maximum 5 members per team reached', 400, 'CONFLICT')
      }

      const existingMembership = await findSeasonMembershipConflict({
        userId: joinRequest.studentId,
        seasonId: team.seasonId,
        db: prisma,
      })

      if (existingMembership) {
        throw new ApiError(
          `Student is already assigned to ${existingMembership.team.name} in this season`,
          409,
          'CONFLICT'
        )
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
