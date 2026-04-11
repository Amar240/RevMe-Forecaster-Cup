import { NextRequest } from 'next/server'
import { TeamStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError, parseJson } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { findSeasonMembershipConflict } from '@/server/team-membership'
import { sameUniversity } from '@/server/universities'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const joinableTeamStatuses: TeamStatus[] = ['PENDING_APPROVAL', 'APPROVED', 'ACTIVE']

const createJoinRequestSchema = z.object({
  supervisorId: z.string().trim().min(1).optional(),
  supervisorEmail: z.string().trim().email().optional(),
  teamId: z.string().trim().min(1).optional(),
  message: z.string().trim().max(500).optional(),
})

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const requests = await prisma.joinRequest.findMany({
      where: { studentId: user!.id },
      include: {
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
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
    const enrichedRequests = requests.map((request) => ({
      ...request,
      requestedTeam: request.teamId ? requestedTeamMap.get(request.teamId) ?? null : null,
    }))

    return jsonOk({ requests: enrichedRequests })
  } catch (error) {
    return jsonError(error, 'Failed to fetch join requests')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'STUDENT') {
      throw new ApiError('Only students can create join requests', 403, 'FORBIDDEN')
    }

    const body = await parseJson(request, createJoinRequestSchema)
    const supervisorIdentifier = body.supervisorId || body.supervisorEmail
    if (!supervisorIdentifier) {
      throw new ApiError('Select a supervisor before sending your request.', 400, 'INVALID_INPUT')
    }

    const student = await prisma.user.findUnique({
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

    if (!student?.universityId || !student.university) {
      throw new ApiError('Add your university before sending a join request.', 422, 'INVALID_INPUT')
    }

    const operationalSeason = await getCurrentOperationalSeason({
      select: { id: true },
    })

    if (!operationalSeason) {
      throw new ApiError('No operational season is available for join requests.', 422, 'INVALID_INPUT')
    }

    const existingMembership = await findSeasonMembershipConflict({
      userId: user!.id,
      seasonId: operationalSeason.id,
    })

    if (existingMembership) {
      throw new ApiError('You are already a member of a team in the current season', 400, 'CONFLICT')
    }

    const pendingRequest = await prisma.joinRequest.findFirst({
      where: {
        studentId: user!.id,
        status: 'PENDING',
        seasonId: operationalSeason.id,
      },
    })

    if (pendingRequest) {
      throw new ApiError('You already have a pending join request for the current season', 400, 'CONFLICT')
    }

    const supervisor = body.supervisorId
      ? await prisma.user.findUnique({
          where: { id: body.supervisorId },
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
      : await prisma.user.findFirst({
          where: { email: body.supervisorEmail!.toLowerCase(), role: 'SUPERVISOR' },
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

    if (!supervisor || supervisor.role !== 'SUPERVISOR') {
      throw new ApiError('Selected supervisor could not be found.', 404, 'NOT_FOUND')
    }

    if (!supervisor.universityId || !supervisor.university || !sameUniversity(student.university, supervisor.university)) {
      throw new ApiError('Join requests must stay within your university.', 422, 'INVALID_INPUT')
    }

    if (body.teamId) {
      const selectedTeam = await prisma.team.findUnique({
        where: { id: body.teamId },
        include: {
          university: {
            select: {
              id: true,
              name: true,
              normalizedName: true,
            },
          },
          members: { select: { id: true } },
        },
      })

      if (!selectedTeam) {
        throw new ApiError('Selected team could not be found.', 404, 'NOT_FOUND')
      }

      if (selectedTeam.supervisorId !== supervisor.id) {
        throw new ApiError('Selected team does not belong to the chosen supervisor.', 422, 'INVALID_INPUT')
      }

      if (!sameUniversity(student.university, selectedTeam.university)) {
        throw new ApiError('Selected team must belong to your university.', 422, 'INVALID_INPUT')
      }

      if (selectedTeam.seasonId !== operationalSeason.id) {
        throw new ApiError('Selected team must belong to the current season.', 422, 'INVALID_INPUT')
      }

      if (!joinableTeamStatuses.includes(selectedTeam.status)) {
        throw new ApiError('Selected team is not open for join requests.', 422, 'INVALID_INPUT')
      }

      if (selectedTeam.members.length >= 5) {
        throw new ApiError('Selected team is already full.', 422, 'CONFLICT')
      }
    }

    const joinRequest = await prisma.joinRequest.create({
      data: {
        studentId: user!.id,
        supervisorId: supervisor.id,
        supervisorEmailEntered: supervisor.email,
        teamId: body.teamId || null,
        seasonId: operationalSeason.id,
        message: body.message || null,
        status: 'PENDING',
      },
      include: {
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    const requestedTeam = joinRequest.teamId
      ? await prisma.team.findUnique({
          where: { id: joinRequest.teamId },
          select: { id: true, name: true, displayId: true, status: true },
        })
      : null

    return jsonOk({ request: { ...joinRequest, requestedTeam } })
  } catch (error) {
    return jsonError(error, 'Failed to create join request')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('id')

    if (!requestId) {
      throw new ApiError('Request ID is required', 400, 'INVALID_INPUT')
    }

    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
    })

    if (!joinRequest || joinRequest.studentId !== user!.id) {
      throw new ApiError('Join request not found', 404, 'NOT_FOUND')
    }

    if (joinRequest.status !== 'PENDING') {
      throw new ApiError('Only pending requests can be canceled', 400, 'INVALID_INPUT')
    }

    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELED' },
    })

    return jsonOk({ message: 'Request canceled' })
  } catch (error) {
    return jsonError(error, 'Failed to cancel join request')
  }
}
