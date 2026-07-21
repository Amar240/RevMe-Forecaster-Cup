import { prisma } from '@/server/db'
import { detectBias, type DirectionalError } from '@/lib/learning-analytics'

export async function getSupervisorCoaching(supervisorId: string, requestedRoundId?: string | null) {
  const season = await prisma.season.findFirst({ where: { status: { in: ['ACTIVE', 'PAUSED'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true } })
  if (!season) return null
  const rounds = await prisma.round.findMany({ where: { seasonId: season.id }, orderBy: { number: 'asc' }, select: { id: true, number: true, closesAt: true, status: true, leaderboardVisible: true } })
  const round = rounds.find((item) => item.id === requestedRoundId) || rounds.find((item) => item.status === 'OPEN') || rounds.filter((item) => item.leaderboardVisible).at(-1) || rounds.at(-1)
  if (!round) return { season, round: null, rounds, teams: [], insights: null }
  const teams = await prisma.team.findMany({ where: { supervisorId, seasonId: season.id }, include: { members: { select: { user: { select: { firstName: true, lastName: true } } }, orderBy: { joinedAt: 'asc' } }, submissions: { where: { roundId: round.id }, select: { id: true } }, warnings: { select: { id: true } }, scoreAggregates: { where: { scopeType: 'ROUND', roundId: { in: rounds.filter((item) => item.leaderboardVisible).map((item) => item.id) } }, include: { round: { select: { number: true } } } }, predictionErrors: { where: { round: { leaderboardVisible: true } }, include: { market: { select: { name: true } }, round: { select: { number: true } } } } } })
  const health = teams.map((team) => {
    const roundScores = team.scoreAggregates.filter((item) => item.roundId === round.id)
    const occ = roundScores.find((item) => item.metric === 'OCCUPANCY')?.mape
    const adr = roundScores.find((item) => item.metric === 'ADR')?.mape
    const score = occ != null && adr != null ? (occ + adr) / 2 : null
    const publishedScores = rounds.filter((item) => item.leaderboardVisible).map((published) => { const values = team.scoreAggregates.filter((item) => item.roundId === published.id); const o = values.find((item) => item.metric === 'OCCUPANCY')?.mape; const a = values.find((item) => item.metric === 'ADR')?.mape; return o != null && a != null ? (o + a) / 2 : null }).filter((value): value is number => value !== null)
    const errors: DirectionalError[] = team.predictionErrors.map((error) => ({ marketId: error.marketId, marketName: error.market.name, metric: error.metric, weekOffset: error.weekOffset, predictedValue: error.predictedValue, actualValue: error.actualValue, apeError: error.apeError, roundNumber: error.round.number }))
    return { id: team.id, name: team.name, members: team.members.map((member) => `${member.user.firstName} ${member.user.lastName}`), submitted: team.submissions.length > 0, hoursRemaining: Math.max(0, (round.closesAt.getTime() - Date.now()) / 3_600_000), warnings: team.warnings.length, score, trend: publishedScores.length >= 2 ? publishedScores.at(-2)! - publishedScores.at(-1)! : null, bias: detectBias(errors)[0] || null }
  })
  const roundErrors = teams.flatMap((team) => team.predictionErrors.filter((error) => error.roundId === round.id).map((error) => ({ ...error, teamName: team.name })))
  const directionGroups = new Map<string, { marketName: string; metric: string; direction: string; teams: Set<string> }>()
  for (const error of roundErrors) { const direction = error.predictedValue > error.actualValue ? 'OVER' : error.predictedValue < error.actualValue ? 'UNDER' : 'EXACT'; const key = `${error.marketId}:${error.metric}:${direction}`; const group = directionGroups.get(key) || { marketName: error.market.name, metric: error.metric, direction, teams: new Set<string>() }; group.teams.add(error.teamName); directionGroups.set(key, group) }
  const common = Array.from(directionGroups.values()).sort((a, b) => b.teams.size - a.teams.size)[0]
  const best = roundErrors.filter((error) => error.apeError != null).sort((a, b) => a.apeError! - b.apeError!)[0]
  const missGroups = new Map<string, { marketName: string; metric: string; errors: number[] }>()
  for (const error of roundErrors) { if (error.apeError == null) continue; const key = `${error.marketId}:${error.metric}`; const item = missGroups.get(key) || { marketName: error.market.name, metric: error.metric, errors: [] }; item.errors.push(error.apeError); missGroups.set(key, item) }
  const commonMiss = Array.from(missGroups.values()).map((item) => ({ ...item, averageError: item.errors.reduce((sum, value) => sum + value, 0) / item.errors.length })).sort((a, b) => b.averageError - a.averageError)[0] || null
  const bins = [{ label: '<5%', min: 0, max: .05 }, { label: '5–10%', min: .05, max: .1 }, { label: '10–20%', min: .1, max: .2 }, { label: '20%+', min: .2, max: Infinity }].map((bin) => ({ label: bin.label, count: health.filter((team) => team.score != null && team.score >= bin.min && team.score < bin.max).length }))
  const updates = await prisma.marketRoundUpdate.findMany({ where: { seasonId: season.id, roundNumber: round.number }, include: { market: { select: { name: true } } }, orderBy: { market: { name: 'asc' } } })
  return { season, round, rounds, teams: health, insights: { common: common ? { marketName: common.marketName, metric: common.metric, direction: common.direction, teamCount: common.teams.size, totalTeams: teams.length } : null, bestCall: best ? { teamName: best.teamName, marketName: best.market.name, metric: best.metric, apeError: best.apeError } : null, commonMiss, histogram: bins, marketUpdates: updates.map((update) => ({ marketName: update.market.name, headline: update.headline, whatChanged: update.whatChanged })) } }
}
