import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse('scoring:run')
    if (response) return response

    const operationalSeason = await getCurrentOperationalSeason({
      include: {
        rounds: { orderBy: { number: 'desc' }, take: 2 },
      },
    })

    if (!operationalSeason) return jsonOk({ anomalies: [] })

    const latestRound = operationalSeason.rounds[0]
    const previousRound = operationalSeason.rounds[1]
    if (!latestRound) return jsonOk({ anomalies: [] })

    const anomalies: Array<{
      type: 'high_error' | 'ranking_jump' | 'bad_actuals' | 'uniform_scores'
      severity: 'warning' | 'critical'
      message: string
      details?: string
    }> = []

    const errors = await prisma.predictionError.findMany({
      where: { roundId: latestRound.id },
      include: { team: { select: { name: true } } },
    })

    if (errors.length > 0) {
      const avgAE = errors.reduce((sum, e) => sum + (e.absError || 0), 0) / errors.length
      const threshold = avgAE * 3

      const highErrorTeams = errors.filter(e => (e.absError || 0) > threshold)
      const uniqueHighErrorTeams = [...new Set(highErrorTeams.map(e => e.team.name))]

      if (uniqueHighErrorTeams.length > 0) {
        anomalies.push({
          type: 'high_error',
          severity: 'warning',
          message: `${uniqueHighErrorTeams.length} team(s) have AE > 3x average`,
          details: `Teams: ${uniqueHighErrorTeams.slice(0, 5).join(', ')}${uniqueHighErrorTeams.length > 5 ? ` and ${uniqueHighErrorTeams.length - 5} more` : ''}. Average AE: ${avgAE.toFixed(2)}, Threshold: ${threshold.toFixed(2)}`,
        })
      }

      const errorsByMarket = new Map<string, number[]>()
      for (const err of errors) {
        const existing = errorsByMarket.get(err.marketId) || []
        existing.push(err.absError || 0)
        errorsByMarket.set(err.marketId, existing)
      }

      for (const [marketId, marketErrors] of errorsByMarket) {
        const highErrorRate = marketErrors.filter(e => e > avgAE * 2).length / marketErrors.length
        if (highErrorRate > 0.8) {
          const market = await prisma.market.findUnique({ where: { id: marketId }, select: { name: true } })
          anomalies.push({
            type: 'bad_actuals',
            severity: 'critical',
            message: `Possible bad actuals for ${market?.name || 'Unknown Market'}`,
            details: `${(highErrorRate * 100).toFixed(0)}% of teams scored above 2x the average AE. This might indicate incorrect actual values were uploaded.`,
          })
        }
      }

      const uniqueScores = new Set(errors.map(e => e.absError?.toFixed(4)))
      if (errors.length > 5 && uniqueScores.size === 1) {
        anomalies.push({
          type: 'uniform_scores',
          severity: 'critical',
          message: 'All teams have identical scores',
          details: 'This likely indicates a data issue — all prediction errors are the same value.',
        })
      }
    }

    if (previousRound) {
      const currentAggregates = await prisma.scoreAggregate.findMany({
        where: { seasonId: operationalSeason.id, scopeType: 'SEASON' },
        include: { team: { select: { name: true } } },
        orderBy: { mape: 'asc' },
      })

      const mapeValues = currentAggregates.map(a => a.mape)
      if (mapeValues.length > 0) {
        const meanMape = mapeValues.reduce((s, v) => s + v, 0) / mapeValues.length
        const stdDev = Math.sqrt(mapeValues.reduce((s, v) => s + Math.pow(v - meanMape, 2), 0) / mapeValues.length)

        const outliers = currentAggregates.filter(a => Math.abs(a.mape - meanMape) > 2 * stdDev)
        if (outliers.length > 0) {
          anomalies.push({
            type: 'ranking_jump',
            severity: 'warning',
            message: `${outliers.length} team(s) have MAPE > 2 standard deviations from mean`,
            details: `Teams: ${outliers.slice(0, 5).map(o => o.team.name).join(', ')}. Mean MAPE: ${meanMape.toFixed(2)}, StdDev: ${stdDev.toFixed(2)}`,
          })
        }
      }
    }

    return jsonOk({ anomalies, roundNumber: latestRound.number })
  } catch (error) {
    return jsonError(error, 'Failed to analyze anomalies')
  }
}
