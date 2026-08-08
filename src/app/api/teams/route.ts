import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { countSupervisorTeamsInSeason } from '@/server/team-membership'
import { ensureUniqueTeamName, normalizeTeamName } from '@/server/team-management'
import { z } from 'zod'
import { createInitialSupervisorAssignment } from '@/server/team-supervisor-assignment'

export const dynamic = 'force-dynamic'

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const operationalSeason = await getCurrentOperationalSeason({
      select: { id: true },
    })

    if (!operationalSeason) {
      return jsonOk({ teams: [] })
    }

    const teams = await prisma.team.findMany({
      where: {
        ...(user!.role === 'ADMIN' ? {} : { supervisorId: user!.id }),
        seasonId: operationalSeason.id,
      },
      include: {
        university: true,
        members: { include: { user: true } },
        _count: { select: { submissions: true, warnings: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return jsonOk({ teams })
  } catch (error) {
    return jsonError(error, 'Failed to get teams')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'SUPERVISOR' && user!.role !== 'ADMIN') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const data = await parseJson(request, createTeamSchema)
    const teamName = normalizeTeamName(data.name)

    if (!teamName) {
      throw new ApiError('Team name is required', 422, 'INVALID_INPUT')
    }

    if (!user!.universityId) {
      throw new ApiError('User must be associated with a university', 422, 'INVALID_INPUT')
    }

    const university = await prisma.university.findUnique({
      where: { id: user!.universityId },
    })

    const operationalSeason = await getCurrentOperationalSeason({
      select: { id: true },
    })

    if (!operationalSeason) {
      throw new ApiError('No operational season is available for team registration', 422, 'INVALID_INPUT')
    }

    await ensureUniqueTeamName({
      seasonId: operationalSeason.id,
      name: teamName,
      db: prisma,
    })

    const teamCount = await countSupervisorTeamsInSeason({
      supervisorId: user!.id,
      seasonId: operationalSeason.id,
      db: prisma,
    })

    if (teamCount >= 10) {
      throw new ApiError('Maximum 10 teams per supervisor', 422, 'CONFLICT')
    }

    const existingTeamsCount = await prisma.team.count({
      where: { universityId: user!.universityId },
    })

    const displayId = `${university?.name || 'Team'}${existingTeamsCount + 1}`

    const team = await prisma.$transaction(async (tx) => {
      const createdTeam = await tx.team.create({
        data: {
          name: teamName,
          displayId,
          supervisorId: user!.id,
          universityId: user!.universityId!,
          seasonId: operationalSeason.id,
        },
        include: {
          university: true,
          members: true,
        },
      })
      await createInitialSupervisorAssignment({
        teamId: createdTeam.id,
        supervisorId: createdTeam.supervisorId,
        assignedById: user!.id,
        reason: 'Initial team registration assignment',
        db: tx,
      })
      return createdTeam
    })

    return jsonOk({ team }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to create team')
  }
}
