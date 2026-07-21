import { prisma } from '@/server/db'
import { detectBias, insightTakeaway, scoreDistribution, type DirectionalError } from '@/lib/learning-analytics'

const average = (values: Array<number | null>) => {
  const valid = values.filter((value): value is number => value !== null)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

export async function getScoreInsights(seasonId: string, teamId: string) {
  const [errors, cohortAggregates] = await Promise.all([
    prisma.predictionError.findMany({ where: { seasonId, teamId, round: { leaderboardVisible: true } }, include: { market: { select: { name: true } }, round: { select: { id: true, number: true } } } }),
    prisma.scoreAggregate.findMany({ where: { seasonId, scopeType: 'ROUND', round: { leaderboardVisible: true }, team: { status: { in: ['ACTIVE', 'APPROVED'] } } }, include: { round: { select: { id: true, number: true } } } }),
  ])
  const directional: DirectionalError[] = errors.map((error) => ({ marketId: error.marketId, marketName: error.market.name, metric: error.metric, weekOffset: error.weekOffset, predictedValue: error.predictedValue, actualValue: error.actualValue, apeError: error.apeError, roundNumber: error.round.number }))
  const horizon = { week1: average(errors.filter((error) => error.weekOffset === 1).map((error) => error.apeError)), week2: average(errors.filter((error) => error.weekOffset === 2).map((error) => error.apeError)) }
  const biases = detectBias(directional)

  const cohortBands = [...new Map(cohortAggregates.flatMap((item) => item.round ? [[item.round.id, item.round]] as const : [])).values()].sort((a, b) => a.number - b.number).map((round) => {
    const byTeam = new Map<string, { occupancy?: number; adr?: number }>()
    for (const aggregate of cohortAggregates.filter((item) => item.roundId === round.id)) {
      const item = byTeam.get(aggregate.teamId) || {}
      if (aggregate.metric === 'OCCUPANCY') item.occupancy = aggregate.mape
      if (aggregate.metric === 'ADR') item.adr = aggregate.mape
      byTeam.set(aggregate.teamId, item)
    }
    const scores = Array.from(byTeam.values()).flatMap((item) => item.occupancy == null || item.adr == null ? [] : [(item.occupancy + item.adr) / 2])
    const mine = byTeam.get(teamId)
    return { roundId: round.id, round: round.number, ...scoreDistribution(scores), team: mine?.occupancy == null || mine.adr == null ? null : (mine.occupancy + mine.adr) / 2 }
  })

  const marketGroups = new Map<string, typeof errors>()
  for (const error of errors) marketGroups.set(error.marketId, [...(marketGroups.get(error.marketId) || []), error])
  const markets = Array.from(marketGroups.entries()).map(([marketId, rows]) => {
    const rounds = [...new Set(rows.map((row) => row.round.number))].sort((a, b) => a - b).map((number) => ({ round: number, mape: average(rows.filter((row) => row.round.number === number).map((row) => row.apeError)) }))
    return { marketId, marketName: rows[0].market.name, mape: average(rows.map((row) => row.apeError)), occupancyMape: average(rows.filter((row) => row.metric === 'OCCUPANCY').map((row) => row.apeError)), adrMape: average(rows.filter((row) => row.metric === 'ADR').map((row) => row.apeError)), rounds }
  }).sort((a, b) => (a.mape ?? Infinity) - (b.mape ?? Infinity))

  return { biases, horizon, cohortBands, markets, takeaway: insightTakeaway({ bias: biases[0], horizonOne: horizon.week1, horizonTwo: horizon.week2 }) }
}
