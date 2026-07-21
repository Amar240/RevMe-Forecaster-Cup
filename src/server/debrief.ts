import { prisma } from '@/server/db'
import type { Role } from '@prisma/client'
import { competitionRanks, detectConsecutiveBias, detectHorizonGap, detectImprovingStreak, quantile, scoreDistribution, selectCalls, type DirectionalError } from '@/lib/learning-analytics'

function combinedRoundScores(aggregates: Array<{ teamId: string; metric: string; mape: number }>) {
  const teams = new Map<string, { occupancy?: number; adr?: number }>()
  for (const aggregate of aggregates) {
    const item = teams.get(aggregate.teamId) || {}
    if (aggregate.metric === 'OCCUPANCY') item.occupancy = aggregate.mape
    if (aggregate.metric === 'ADR') item.adr = aggregate.mape
    teams.set(aggregate.teamId, item)
  }
  return Array.from(teams.entries()).flatMap(([teamId, value]) => value.occupancy == null || value.adr == null ? [] : [{ teamId, score: (value.occupancy + value.adr) / 2 }])
}

export async function getAuthorizedDebrief(user: { id: string; role: Role }, roundId: string, requestedTeamId?: string | null) {
  const round = await prisma.round.findUnique({ where: { id: roundId }, select: { id: true, number: true, seasonId: true, leaderboardVisible: true } })
  if (!round || !round.leaderboardVisible) return null

  let team: { id: string; name: string } | null = null
  if (user.role === 'STUDENT') {
    const membership = await prisma.teamMember.findFirst({ where: { userId: user.id, team: { seasonId: round.seasonId, ...(requestedTeamId ? { id: requestedTeamId } : {}) } }, include: { team: { select: { id: true, name: true } } } })
    team = membership?.team ?? null
  } else if (user.role === 'SUPERVISOR') {
    team = requestedTeamId ? await prisma.team.findFirst({ where: { id: requestedTeamId, seasonId: round.seasonId, supervisorId: user.id }, select: { id: true, name: true } }) : null
  } else if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') {
    team = requestedTeamId ? await prisma.team.findFirst({ where: { id: requestedTeamId, seasonId: round.seasonId }, select: { id: true, name: true } }) : null
  }
  if (!team) return null

  const [roundAggregates, errors, cohortErrors, historicalErrors, updates, visibleRounds, teamRoundAggregates] = await Promise.all([
    prisma.scoreAggregate.findMany({
      where: { seasonId: round.seasonId, roundId, scopeType: 'ROUND', team: { status: { in: ['ACTIVE', 'APPROVED'] } } },
      select: { teamId: true, metric: true, mape: true },
    }),
    prisma.predictionError.findMany({ where: { seasonId: round.seasonId, roundId, teamId: team.id }, include: { market: { select: { name: true } } }, orderBy: [{ market: { name: 'asc' } }, { metric: 'asc' }, { weekOffset: 'asc' }] }),
    prisma.predictionError.findMany({ where: { seasonId: round.seasonId, roundId, team: { status: { in: ['ACTIVE', 'APPROVED'] } } }, select: { marketId: true, metric: true, weekOffset: true, apeError: true } }),
    prisma.predictionError.findMany({ where: { seasonId: round.seasonId, teamId: team.id, round: { leaderboardVisible: true, number: { lte: round.number } } }, include: { market: { select: { name: true } }, round: { select: { number: true } } } }),
    prisma.marketRoundUpdate.findMany({ where: { seasonId: round.seasonId, roundNumber: round.number }, include: { market: { select: { name: true } } }, orderBy: { market: { name: 'asc' } } }),
    prisma.round.findMany({ where: { seasonId: round.seasonId, leaderboardVisible: true, number: { lte: round.number } }, select: { id: true, number: true }, orderBy: { number: 'asc' } }),
    prisma.scoreAggregate.findMany({ where: { seasonId: round.seasonId, teamId: team.id, scopeType: 'ROUND', round: { leaderboardVisible: true, number: { lte: round.number } } }, select: { metric: true, mape: true, round: { select: { number: true } } } }),
  ])

  const ranked = competitionRanks(combinedRoundScores(roundAggregates))
  const mine = ranked.find((entry) => entry.teamId === team.id)
  if (!mine) return null

  let previousRank: number | null = null
  const previousRound = visibleRounds.filter((item) => item.number < round.number).at(-1)
  if (previousRound) {
    const previousAggregates = await prisma.scoreAggregate.findMany({ where: { seasonId: round.seasonId, roundId: previousRound.id, scopeType: 'ROUND', team: { status: { in: ['ACTIVE', 'APPROVED'] } } }, select: { teamId: true, metric: true, mape: true } })
    previousRank = competitionRanks(combinedRoundScores(previousAggregates)).find((entry) => entry.teamId === team.id)?.rank ?? null
  }

  const rows: DirectionalError[] = errors.map((error) => ({
    marketId: error.marketId, marketName: error.market.name, metric: error.metric, weekOffset: error.weekOffset,
    predictedValue: error.predictedValue, actualValue: error.actualValue, apeError: error.apeError,
  }))
  const historical: DirectionalError[] = historicalErrors.map((error) => ({
    marketId: error.marketId, marketName: error.market.name, metric: error.metric, weekOffset: error.weekOffset,
    predictedValue: error.predictedValue, actualValue: error.actualValue, apeError: error.apeError, roundNumber: error.round.number,
  }))
  const scoresByRound = new Map<number, { occupancy?: number; adr?: number }>()
  for (const aggregate of teamRoundAggregates) {
    if (!aggregate.round) continue
    const item = scoresByRound.get(aggregate.round.number) || {}
    if (aggregate.metric === 'OCCUPANCY') item.occupancy = aggregate.mape
    if (aggregate.metric === 'ADR') item.adr = aggregate.mape
    scoresByRound.set(aggregate.round.number, item)
  }
  const roundScores = Array.from(scoresByRound.entries()).flatMap(([roundNumber, value]) => value.occupancy == null || value.adr == null ? [] : [{ roundNumber, score: (value.occupancy + value.adr) / 2 }])

  return {
    round: { id: round.id, number: round.number }, team,
    summary: { mape: mine.score, rank: mine.rank, percentile: mine.percentile, cohort: ranked.length, distribution: scoreDistribution(ranked.map((entry) => entry.score)), rankMovement: previousRank == null ? null : previousRank - mine.rank },
    rows: rows.map((row) => ({ ...row, absoluteError: Math.abs(row.predictedValue - row.actualValue), signedDifference: row.predictedValue - row.actualValue, cohortMedianError: quantile(cohortErrors.filter((item) => item.marketId === row.marketId && item.metric === row.metric && item.weekOffset === row.weekOffset && item.apeError != null).map((item) => item.apeError!), 0.5) })),
    calls: selectCalls(rows), patterns: detectConsecutiveBias(historical), horizonPattern: detectHorizonGap(historical),
    improvement: detectImprovingStreak(roundScores),
    marketUpdates: updates.map((update) => ({ marketId: update.marketId, marketName: update.market.name, headline: update.headline, whatChanged: update.whatChanged })),
  }
}

export async function getStudentDebrief(userId: string, roundId: string) {
  return getAuthorizedDebrief({ id: userId, role: 'STUDENT' }, roundId)
}
