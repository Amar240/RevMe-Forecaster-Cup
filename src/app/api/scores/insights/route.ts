import { requireUserOrResponse, jsonError, jsonOk } from '@/server/http'
import { prisma } from '@/server/db'
import { getCurrentOperationalSeason } from '@/server/season'
import { getScoreInsights } from '@/server/score-insights'
import { resolveScoreTeam } from '@/server/scoped-score-team'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const season = await getCurrentOperationalSeason({ select: { id: true } })
    if (!season) return jsonOk({ insights: null })
    const team = await resolveScoreTeam({ userId: user!.id, role: user!.role, seasonId: season.id, requestedTeamId: new URL(request.url).searchParams.get('teamId') })
    if (!team) return jsonOk({ insights: null })
    return jsonOk({ insights: await getScoreInsights(season.id, team.id), team })
  } catch (error) { return jsonError(error, 'Failed to load score insights') }
}
