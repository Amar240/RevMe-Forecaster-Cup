import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

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
