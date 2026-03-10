import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const teams = await prisma.team.findMany({
      where: user!.role === 'ADMIN' ? {} : { supervisorId: user!.id },
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

    const existingTeamWithName = await prisma.team.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' } },
    })

    if (existingTeamWithName) {
      throw new ApiError('A team with this name already exists. Please choose a different name.', 422, 'CONFLICT')
    }

    const teamCount = await prisma.team.count({
      where: { supervisorId: user!.id },
    })

    if (teamCount >= 10) {
      throw new ApiError('Maximum 10 teams per supervisor', 422, 'CONFLICT')
    }

    if (!user!.universityId) {
      throw new ApiError('User must be associated with a university', 422, 'INVALID_INPUT')
    }

    const university = await prisma.university.findUnique({
      where: { id: user!.universityId },
    })

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    })

    if (!activeSeason) {
      throw new ApiError('No active season for team registration', 422, 'INVALID_INPUT')
    }

    const existingTeamsCount = await prisma.team.count({
      where: { universityId: user!.universityId },
    })

    const displayId = `${university?.name || 'Team'}${existingTeamsCount + 1}`

    const team = await prisma.team.create({
      data: {
        name: data.name,
        displayId,
        supervisorId: user!.id,
        universityId: user!.universityId,
        seasonId: activeSeason.id,
      },
      include: {
        university: true,
        members: true,
      },
    })

    return jsonOk({ team }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to create team')
  }
}
