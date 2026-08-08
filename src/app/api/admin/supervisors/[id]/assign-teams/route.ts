import { requireAdminOrResponse, jsonOk, jsonError, ApiError, parseJson } from '@/server/http'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { countSupervisorTeamsInSeason } from '@/server/team-membership'
import { changeTeamSupervisorInTransaction } from '@/server/team-supervisor-change'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const assignTeamsSchema = z.object({
  teamIds: z.array(z.string()).min(1, 'teamIds must be a non-empty array'),
  reason: z.string().trim().min(5).max(500),
})

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    if (user!.role !== 'ADMIN') {
      throw new ApiError('Only full administrators can assign team supervisors.', 403, 'FORBIDDEN')
    }

    const supervisor = await prisma.user.findUnique({
      where: { id: params.id, role: 'SUPERVISOR' },
      select: {
        id: true,
        universityId: true,
        isActive: true,
      },
    })

    if (!supervisor) {
      throw new ApiError('Supervisor not found', 404, 'NOT_FOUND')
    }

    if (!supervisor.isActive) {
      throw new ApiError('Inactive supervisors cannot be assigned to teams', 422, 'INVALID_INPUT')
    }

    if (!supervisor.universityId) {
      throw new ApiError('Supervisor must be linked to a university before teams can be assigned', 422, 'INVALID_INPUT')
    }

    const { teamIds, reason } = await parseJson(
      request as import('next/server').NextRequest,
      assignTeamsSchema
    )

    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: {
        id: true,
        seasonId: true,
        universityId: true,
        supervisorId: true,
      },
    })

    if (teams.length !== teamIds.length) {
      throw new ApiError('One or more teams were not found', 404, 'NOT_FOUND')
    }

    if (teams.some((team) => team.supervisorId)) {
      throw new ApiError('Only unassigned teams can be assigned here', 422, 'INVALID_INPUT')
    }

    if (teams.some((team) => team.universityId !== supervisor.universityId)) {
      throw new ApiError('Supervisors can only be assigned teams from their own university', 422, 'INVALID_INPUT')
    }

    const requestedTeamsBySeason = new Map<string | null, number>()
    for (const team of teams) {
      requestedTeamsBySeason.set(team.seasonId ?? null, (requestedTeamsBySeason.get(team.seasonId ?? null) ?? 0) + 1)
    }

    for (const [seasonId, incomingCount] of requestedTeamsBySeason.entries()) {
      const currentTeamCount = await countSupervisorTeamsInSeason({
        supervisorId: params.id,
        seasonId,
        db: prisma,
      })

      if (currentTeamCount + incomingCount > 10) {
        throw new ApiError('Maximum 10 teams per supervisor reached in the selected season', 422, 'CONFLICT')
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const team of teams) {
        await changeTeamSupervisorInTransaction({
          tx,
          actor: user!,
          teamId: team.id,
          supervisorId: supervisor.id,
          reason,
        })
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return jsonOk({ teamsUpdated: teams.length })
  } catch (error) {
    return jsonError(error, 'Failed to assign teams')
  }
}
