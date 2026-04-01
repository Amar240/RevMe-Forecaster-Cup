import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { z } from 'zod'
import { createAdminTeam } from '@/server/team-management'

export const dynamic = 'force-dynamic'

const createAdminTeamSchema = z.object({
  seasonId: z.string().min(1),
  universityId: z.string().min(1),
  name: z.string().min(1).max(100),
  externalTeamId: z.string().max(100).optional().nullable(),
  supervisorId: z.string().min(1),
})

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const teams = await prisma.team.findMany({
      include: {
        season: true,
        university: true,
        supervisor: true,
        members: { include: { user: true } },
        _count: { select: { submissions: true, warnings: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return jsonOk({ teams, totalTeams: teams.length })
  } catch (error) {
    return jsonError(error, 'Failed to get teams')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const data = await parseJson(request, createAdminTeamSchema)
    const team = await createAdminTeam({
      actor: user!,
      seasonId: data.seasonId,
      universityId: data.universityId,
      name: data.name,
      externalTeamId: data.externalTeamId,
      supervisorId: data.supervisorId,
    })

    return jsonOk({ team }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to create team')
  }
}
