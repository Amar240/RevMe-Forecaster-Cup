export const HOMEPAGE_DEFAULT_HERO_STATUS_LABEL = 'Forecasting Excellence Starts Here'

type SeasonStatusInput = { status: string; rounds: Array<{ number: number; status: string }> } | null

export function deriveHomepageHeroStatusLabel(season: SeasonStatusInput) {
  if (!season || season.rounds.length === 0) return HOMEPAGE_DEFAULT_HERO_STATUS_LABEL
  if (season.status === 'DRAFT') return 'Season Starts Soon'
  if (season.status === 'COMPLETED') return 'Season Complete'
  const openRound = season.rounds.find((round) => round.status === 'OPEN')
  if (openRound) return `Round ${openRound.number} Live — Season in Progress`
  if (season.rounds.some((round) => round.status === 'UPCOMING')) return 'Season Active — Next Round Soon'
  if (season.rounds.every((round) => round.status === 'CLOSED')) return 'Season Complete'
  return HOMEPAGE_DEFAULT_HERO_STATUS_LABEL
}
