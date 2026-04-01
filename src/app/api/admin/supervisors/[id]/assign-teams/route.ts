import { requireAdmin, jsonOk, jsonError, ApiError, parseJson } from '@/server/http'
import { z } from 'zod'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const assignTeamsSchema = z.object({
  teamIds: z.array(z.string()).min(1, 'teamIds must be a non-empty array'),
})

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

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

    const { teamIds } = await parseJson(
      request as import('next/server').NextRequest,
      assignTeamsSchema
    )

    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: {
        id: true,
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

    const currentTeamCount = await prisma.team.count({
      where: { supervisorId: params.id },
    })

    if (currentTeamCount + teamIds.length > 10) {
      throw new ApiError('Maximum 10 teams per supervisor reached', 422, 'CONFLICT')
    }

    const { count } = await prisma.team.updateMany({
      where: { id: { in: teamIds }, supervisorId: null },
      data: { supervisorId: params.id },
    })

    if (count !== teamIds.length) {
      throw new ApiError('One or more teams were assigned before this request completed. Please refresh and try again.', 409, 'CONFLICT')
    }

    return jsonOk({ teamsUpdated: count })
  } catch (error) {
    return jsonError(error, 'Failed to assign teams')
  }
}
