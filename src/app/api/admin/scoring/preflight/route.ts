import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { getScoringReadinessSummary } from '@/server/scoring-readiness'
import { getCurrentOperationalSeason } from '@/server/season'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse('scoring:run')
    if (response) return response

    const operationalSeason = await getCurrentOperationalSeason({
      select: { id: true },
    })

    if (!operationalSeason) return jsonOk({ ready: false, reason: 'No operational season', checks: [] })

    const summary = await getScoringReadinessSummary({
      seasonId: operationalSeason.id,
      scope: 'SEASON',
    })

    if (!summary) {
      return jsonOk({ ready: false, reason: 'No operational season', checks: [] })
    }

    return jsonOk({
      ready: summary.ready,
      reason: summary.ready ? 'All checks passed' : 'Some rounds have incomplete actuals',
      seasonName: summary.seasonName,
      activeTeams: summary.activeTeams,
      marketCount: summary.marketCount,
      totalWarningsExpected: summary.totalWarningsExpected,
      teamsAtRiskOfDQ: summary.teamsAtRiskOfDQ,
      checks: summary.checks,
    })
  } catch (error) {
    return jsonError(error, 'Failed to run preflight check')
  }
}
