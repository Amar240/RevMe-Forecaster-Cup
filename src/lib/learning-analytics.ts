export type RankedScore = { teamId: string; score: number }

export function competitionRanks(entries: RankedScore[]) {
  const sorted = [...entries].sort((a, b) => a.score - b.score || a.teamId.localeCompare(b.teamId))
  return sorted.map((entry, index) => ({
    ...entry,
    rank: sorted.findIndex((candidate) => candidate.score === entry.score) + 1,
    percentile: sorted.length <= 1
      ? 100
      : Math.round((sorted.filter((candidate) => candidate.score > entry.score).length / (sorted.length - 1)) * 100),
  }))
}

export function quantile(values: number[], fraction: number) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const remainder = position - lower
  return sorted[lower + 1] === undefined
    ? sorted[lower]
    : sorted[lower] + remainder * (sorted[lower + 1] - sorted[lower])
}

export function scoreDistribution(values: number[]) {
  return { q1: quantile(values, 0.25), median: quantile(values, 0.5), q3: quantile(values, 0.75) }
}

export function percentError(predicted: number, actual: number) {
  return actual === 0 ? null : Math.abs(predicted - actual) / Math.abs(actual)
}

export function signedPercentError(predicted: number, actual: number) {
  return actual === 0 ? null : (predicted - actual) / Math.abs(actual)
}

export function formatMape(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`
}

export function describeTrend(delta: number | null) {
  if (delta == null || delta === 0) return { direction: 'flat' as const, label: 'No rank change', symbol: '—' }
  return delta > 0
    ? { direction: 'up' as const, label: `Up ${delta} rank${delta === 1 ? '' : 's'}`, symbol: '▲' }
    : { direction: 'down' as const, label: `Down ${Math.abs(delta)} rank${delta === -1 ? '' : 's'}`, symbol: '▼' }
}

export type DirectionalError = {
  marketId: string
  marketName?: string
  metric: 'OCCUPANCY' | 'ADR'
  weekOffset: number
  predictedValue: number
  actualValue: number
  apeError: number | null
  roundNumber?: number
}

export function detectBias(errors: DirectionalError[], minimum = 3) {
  const groups = new Map<string, DirectionalError[]>()
  for (const error of errors) {
    const key = `${error.marketId}:${error.metric}`
    groups.set(key, [...(groups.get(key) || []), error])
  }
  return Array.from(groups.entries()).flatMap(([key, values]) => {
    if (values.length < minimum) return []
    const signs = values.map((value) => Math.sign(value.predictedValue - value.actualValue))
    const direction = signs.every((sign) => sign > 0) ? 'OVER' : signs.every((sign) => sign < 0) ? 'UNDER' : null
    if (!direction) return []
    const comparable = values.map((value) => signedPercentError(value.predictedValue, value.actualValue)).filter((value): value is number => value !== null)
    return [{
      key,
      marketId: values[0].marketId,
      marketName: values[0].marketName,
      metric: values[0].metric,
      direction,
      observations: values.length,
      averageSignedError: comparable.length ? comparable.reduce((sum, value) => sum + value, 0) / comparable.length : null,
    }]
  })
}

export function detectConsecutiveBias(errors: DirectionalError[], minimumRounds = 3) {
  const groups = new Map<string, DirectionalError[]>()
  for (const error of errors) {
    if (error.roundNumber == null) continue
    const key = `${error.marketId}:${error.metric}`
    groups.set(key, [...(groups.get(key) || []), error])
  }

  return Array.from(groups.entries()).flatMap(([key, values]) => {
    const byRound = new Map<number, DirectionalError[]>()
    for (const value of values) byRound.set(value.roundNumber!, [...(byRound.get(value.roundNumber!) || []), value])
    const observations = Array.from(byRound.entries()).sort(([a], [b]) => a - b).flatMap(([roundNumber, roundErrors]) => {
      const signs = roundErrors.map((error) => Math.sign(error.predictedValue - error.actualValue)).filter(Boolean)
      if (!signs.length || !signs.every((sign) => sign === signs[0])) return []
      return [{ roundNumber, direction: signs[0] > 0 ? 'OVER' as const : 'UNDER' as const, errors: roundErrors }]
    })
    const latest = observations.at(-1)
    if (!latest) return []
    let length = 0
    for (let index = observations.length - 1; index >= 0 && observations[index].direction === latest.direction; index -= 1) length += 1
    if (length < minimumRounds) return []
    const streakErrors = observations.slice(-length).flatMap((item) => item.errors)
    const comparable = streakErrors.map((value) => signedPercentError(value.predictedValue, value.actualValue)).filter((value): value is number => value !== null)
    return [{ key, marketId: values[0].marketId, marketName: values[0].marketName, metric: values[0].metric, direction: latest.direction, observations: length, averageSignedError: comparable.length ? comparable.reduce((sum, value) => sum + value, 0) / comparable.length : null }]
  })
}

export function detectHorizonGap(errors: DirectionalError[]) {
  const weekOne = errors.filter((error) => error.weekOffset === 1 && error.apeError != null).map((error) => error.apeError!)
  const weekTwo = errors.filter((error) => error.weekOffset === 2 && error.apeError != null).map((error) => error.apeError!)
  if (!weekOne.length || !weekTwo.length) return null
  const horizonOne = weekOne.reduce((sum, value) => sum + value, 0) / weekOne.length
  const horizonTwo = weekTwo.reduce((sum, value) => sum + value, 0) / weekTwo.length
  return { horizonOne, horizonTwo, gap: horizonTwo - horizonOne, needsAttention: horizonTwo > horizonOne * 1.25 }
}

export function detectImprovingStreak(roundScores: Array<{ roundNumber: number; score: number }>, minimumRounds = 3) {
  const ordered = [...roundScores].sort((a, b) => a.roundNumber - b.roundNumber)
  let length = ordered.length ? 1 : 0
  for (let index = ordered.length - 1; index > 0 && ordered[index].score < ordered[index - 1].score; index -= 1) length += 1
  return { length, improving: length >= minimumRounds }
}

export function selectCalls(errors: DirectionalError[]) {
  const comparable = errors.filter((error) => error.apeError !== null)
  const byError = [...comparable].sort((a, b) => (a.apeError ?? 0) - (b.apeError ?? 0))
  return { best: byError[0] ?? null, largestMiss: byError.at(-1) ?? null }
}

export function insightTakeaway(input: { bias?: ReturnType<typeof detectBias>[number]; horizonOne?: number | null; horizonTwo?: number | null }) {
  if (input.bias) {
    const verb = input.bias.direction === 'OVER' ? 'over-forecast' : 'under-forecast'
    return `You ${verb} ${input.bias.marketName || 'this market'} ${input.bias.metric === 'ADR' ? 'ADR' : 'occupancy'} in ${input.bias.observations} comparable forecasts.`
  }
  if (input.horizonOne != null && input.horizonTwo != null && input.horizonTwo > input.horizonOne * 1.25) {
    return 'Your week +2 forecasts are less accurate than week +1; widen your uncertainty range for the longer horizon.'
  }
  return 'Keep comparing each forecast with the outcome and adjust one assumption at a time.'
}
