import { TeamStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { sameUniversity } from '@/server/universities'

export const dynamic = 'force-dynamic'

const joinableTeamStatuses: TeamStatus[] = ['PENDING_APPROVAL', 'APPROVED', 'ACTIVE']

export async function GET(request: Request) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'STUDENT') {
      throw new ApiError('Only students can request to join teams.', 403, 'FORBIDDEN')
    }

    const { searchParams } = new URL(request.url)
    const supervisorId = searchParams.get('supervisorId')

    if (!supervisorId) {
      throw new ApiError('Supervisor is required.', 400, 'INVALID_INPUT')
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
      return jsonOk({ teams: [] })
    }

    const operationalSeason = await getCurrentOperationalSeason({
      select: { id: true },
    })

    if (!operationalSeason) {
      return jsonOk({ teams: [] })
    }

    const teams = await prisma.team.findMany({
      where: {
        supervisorId,
        status: { in: joinableTeamStatuses },
        seasonId: operationalSeason.id,
      },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            normalizedName: true,
          },
        },
        members: {
          select: { id: true },
        },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    })

    return jsonOk({
      teams: teams
        .filter((team) => team.members.length < 5 && sameUniversity(student.university, team.university))
        .map((team) => ({
          id: team.id,
          name: team.name,
          displayId: team.displayId,
          status: team.status,
          memberCount: team.members.length,
        })),
    })
  } catch (error) {
    return jsonError(error, 'Failed to load supervisor teams')
  }
}
